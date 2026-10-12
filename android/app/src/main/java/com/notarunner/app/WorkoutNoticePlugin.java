package com.notarunner.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The workout being tracked, shown as a music player so it fills the whole player on the lock
 * screen and in the shade: the theme's striped card as the "album art", what you're doing and how
 * far as the song, the workout clock as the song's time, today's session length as its length,
 * and one Pause / Resume button. WorkoutService keeps it alive with the screen off, and this also
 * counts steps itself, since the step plugin stops listening when the app is in the background.
 */
@CapacitorPlugin(name = "WorkoutNotice")
public class WorkoutNoticePlugin extends Plugin {
    private static final String CHANNEL = "workout_live";
    /** The same id as the GPS service's notification, so a workout only ever shows one. */
    static final int ID = 28351;
    private static final String ACTION = "com.notarunner.app.WORKOUT_NOTICE";

    private static WorkoutNoticePlugin instance;

    private BroadcastReceiver receiver;
    private MediaSessionCompat session;
    private boolean showing = false, serviceOn = false;
    // The last state from the app, so the clock and the button work without waiting for it.
    private String kind = "walk", title = "", status = "", line1 = "", line2 = "";
    private boolean paused = false;
    private long elapsedMs = 0, shownAt = 0, goalMs = 0;
    /** The theme's accent (the app sends it; Ember until then). */
    private int accent = 0xFFFF6A13;
    private String artKey = null;
    private Bitmap art;
    /** What the player shows, so it's only updated when that changes. */
    private String shown = null;

    // Steps: counted from the phone's step counter, which keeps counting with the screen off.
    private SensorEventListener stepListener;
    private float stepBase = -1;

    @Override
    public void load() {
        instance = this;
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) { act(i.getStringExtra("action")); }
        };
        ContextCompat.registerReceiver(getContext(), receiver, new IntentFilter(ACTION), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void handleOnDestroy() {
        try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) { }
        stop();
        stopStepsNow();
        if (instance == this) instance = null;
    }

    /** Pause or Resume from the player, the lock screen or a headset button. */
    private void act(String action) {
        if (action == null) return;
        if (showing) {
            long now = SystemClock.elapsedRealtime();
            if ("pause".equals(action) && !paused) {
                elapsedMs += now - shownAt;
                paused = true;
                status = "Paused";
            } else if ("resume".equals(action) && paused) {
                paused = false;
                status = "Recording";
            } else return;
            shownAt = now;
            render();
        }
        JSObject d = new JSObject();
        d.put("action", action);
        notifyListeners("action", d, true);
    }

    @PluginMethod
    public void show(PluginCall call) {
        // Notification and media session work happens on the main thread, like the tick.
        getBridge().executeOnMainThread(() -> showNow(call));
    }

    private void showNow(PluginCall call) {
        kind = call.getString("kind", "walk");
        title = call.getString("title", "Workout");
        status = call.getString("status", "Recording");
        line1 = call.getString("line1", "");
        line2 = call.getString("line2", "");
        paused = Boolean.TRUE.equals(call.getBoolean("paused", false));
        accent = color(call.getString("accent"), accent);
        Double ms = call.getDouble("elapsedMs", 0.0);
        elapsedMs = ms == null ? 0 : ms.longValue();
        Double goal = call.getDouble("goalMs", 0.0);
        goalMs = goal == null ? 0 : goal.longValue();
        shownAt = SystemClock.elapsedRealtime();
        showing = true;
        if (!signature().equals(shown)) render();
        if (!serviceOn) {
            serviceOn = true;
            try {
                ContextCompat.startForegroundService(getContext(), new Intent(getContext(), WorkoutService.class));
            } catch (Exception e) {
                serviceOn = false; // The app is in the background; the notification still shows.
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getBridge().executeOnMainThread(() -> { stop(); call.resolve(); });
    }

    private void stop() {
        showing = false;
        shown = null;
        if (serviceOn) {
            serviceOn = false;
            getContext().stopService(new Intent(getContext(), WorkoutService.class));
        }
        if (session != null) { session.setActive(false); session.release(); session = null; }
        NotificationManagerCompat.from(getContext()).cancel(ID);
    }

    @PluginMethod
    public void startSteps(PluginCall call) {
        stopStepsNow();
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor s = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (s == null) { call.reject("No step counter"); return; }
        stepBase = -1;
        stepListener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent e) {
                float total = e.values[0];
                if (stepBase < 0) stepBase = total;
                JSObject d = new JSObject();
                d.put("steps", (int) (total - stepBase));
                notifyListeners("steps", d);
            }
            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        // No batching: steps arrive as they happen, so auto-pause can trust them.
        sm.registerListener(stepListener, s, SensorManager.SENSOR_DELAY_NORMAL, 0);
        call.resolve();
    }

    @PluginMethod
    public void stopSteps(PluginCall call) {
        stopStepsNow();
        call.resolve();
    }

    private void stopStepsNow() {
        if (stepListener == null) return;
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm != null) sm.unregisterListener(stepListener);
        stepListener = null;
    }

    /**
     * Once a second from WorkoutService: let the app check auto-pause (the player runs the clock
     * itself), and stretch the bar once you go past its end.
     */
    static void tick() {
        WorkoutNoticePlugin p = instance;
        if (p == null || !p.showing) return;
        if (!p.signature().equals(p.shown)) p.render();
        p.notifyListeners("tick", new JSObject());
    }

    static Notification currentNotification() {
        WorkoutNoticePlugin p = instance;
        return p == null || !p.showing ? null : p.build();
    }

    private long elapsedNow() {
        return elapsedMs + (paused ? 0 : SystemClock.elapsedRealtime() - shownAt);
    }

    /**
     * The bar's length: today's session, then the next 5 minutes once you're past it. With no
     * session, the next 5 minutes, so the bar always has an end to count toward.
     */
    private long barMs() {
        long e = elapsedNow(), step = 5 * 60_000L;
        if (goalMs > 0 && e < goalMs) return goalMs;
        return (e / step + 1) * step;
    }

    /** What the player shows; the clock's own count isn't part of it. */
    private String signature() {
        return kind + "|" + title + "|" + status + "|" + line1 + "|" + line2 + "|" + paused + "|" + accent + "|" + barMs();
    }

    private static int color(String hex, int fallback) {
        try { return hex == null ? fallback : android.graphics.Color.parseColor(hex.trim()); } catch (Exception e) { return fallback; }
    }

    /** a blended toward b by t (0 is a, 1 is b). */
    private static int mix(int a, int b, float t) {
        int r = (int) (((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t));
        int g = (int) (((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t));
        int bl = (int) ((a & 255) + (((b & 255) - (a & 255)) * t));
        return 0xFF000000 | (r << 16) | (g << 8) | bl;
    }

    private void render() {
        try {
            NotificationManagerCompat.from(getContext()).notify(ID, build());
        } catch (SecurityException e) {
            // Notifications are off for the app; the workout still records.
        }
    }

    private Notification build() {
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Workout in progress", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Your workout's time, pace and steps, with a Pause button, while you track.");
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }

        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(pkg);
        if (open != null) open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent content = open == null ? null
            : PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent act = new Intent(ACTION).setPackage(pkg).putExtra("action", paused ? "resume" : "pause");
        PendingIntent button = PendingIntent.getBroadcast(ctx, 1, act, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // The "song": what you're doing (or that it's paused), then distance, pace and steps.
        String doing = paused ? status : "bike".equals(kind) ? "Riding" : "run".equals(kind) ? "Walk/run" : "Walking";
        StringBuilder sub = new StringBuilder(line1);
        if (!line2.isEmpty()) sub.append(sub.length() > 0 ? "  ·  " : "").append(line2);
        long bar = barMs();
        shown = signature();

        MediaSessionCompat s = session(content);
        s.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, doing)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, sub.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, title)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, bar)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art())
            .build());
        // Only play and pause: no seeking (the bar can't be dragged) and no skip buttons.
        s.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE)
            .setState(paused ? PlaybackStateCompat.STATE_PAUSED : PlaybackStateCompat.STATE_PLAYING, elapsedNow(), paused ? 0f : 1f)
            .build());

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_track)
            .setLargeIcon(art())
            .setColor(accent)
            .setContentTitle(doing)
            .setContentText(sub.toString())
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(s.getSessionToken())
                .setShowActionsInCompactView(0))
            .addAction(paused ? R.drawable.ic_notif_play : R.drawable.ic_notif_pause, paused ? "Resume" : "Pause", button)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        if (content != null) b.setContentIntent(content);
        return b.build();
    }

    private MediaSessionCompat session(PendingIntent content) {
        if (session != null) return session;
        session = new MediaSessionCompat(getContext(), "NotARunnerWorkout");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { act("resume"); }
            @Override public void onPause() { act("pause"); }
        });
        if (content != null) session.setSessionActivity(content);
        session.setActive(true);
        return session;
    }

    /**
     * The "album art", which fills the player: the theme's accent gradient with the app's diagonal
     * stripes, faded toward grey while paused (like the app's card).
     */
    private Bitmap art() {
        String key = accent + "|" + paused;
        if (art != null && key.equals(artKey)) return art;
        int size = 640;
        int base = paused ? mix(accent, 0xFF8F8A84, 0.5f) : accent;
        Bitmap bm = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bm);
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setShader(new LinearGradient(0, 0, size, size, mix(base, 0xFFFFFFFF, 0.18f), mix(base, 0xFF000000, 0.14f), Shader.TileMode.CLAMP));
        c.drawRect(0, 0, size, size, fill);
        // "/" stripes at 45 degrees, half stripe and half gap, like the app's cards.
        Paint stripe = new Paint(Paint.ANTI_ALIAS_FLAG);
        stripe.setColor(0x24000000);
        Path p = new Path();
        float gap = 56, w = 28;
        for (float x = -size; x < size * 2; x += gap) {
            p.moveTo(x, size);
            p.lineTo(x + w, size);
            p.lineTo(x + w + size, 0);
            p.lineTo(x + size, 0);
            p.close();
        }
        c.drawPath(p, stripe);
        art = bm;
        artKey = key;
        return bm;
    }
}
