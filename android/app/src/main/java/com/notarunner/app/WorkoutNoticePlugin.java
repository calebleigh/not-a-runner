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
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
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
import androidx.core.graphics.PathParser;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

/**
 * The workout being tracked, shown like a music player: the clock as the title, distance, pace and
 * steps under it, and one big Pause / Resume button. It's on the lock screen, in the notification
 * shade and in the quick settings player. WorkoutService keeps it ticking with the screen off, and
 * this also counts steps itself, since the step plugin stops listening when the app is in the
 * background.
 */
@CapacitorPlugin(name = "WorkoutNotice")
public class WorkoutNoticePlugin extends Plugin {
    private static final String CHANNEL = "workout_live";
    /** The same id as the GPS service's notification, so a workout only ever shows one. */
    static final int ID = 28351;
    private static final String ACTION = "com.notarunner.app.WORKOUT_NOTICE";
    private static final int CHARCOAL = 0xFF1B1A19, ORANGE = 0xFFFF6A13;

    private static WorkoutNoticePlugin instance;

    private BroadcastReceiver receiver;
    private MediaSessionCompat session;
    private boolean showing = false, serviceOn = false;
    // The last state from the app, so the clock and the button work without waiting for it.
    private String kind = "walk", title = "", status = "", line1 = "", line2 = "";
    private boolean paused = false;
    private long elapsedMs = 0, shownAt = 0;
    private String artKind = null;
    private Bitmap art;
    private String lastTitle = null;

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

    /** Pause or Resume from the notification, the lock screen player or a headset button. */
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
        Double ms = call.getDouble("elapsedMs", 0.0);
        elapsedMs = ms == null ? 0 : ms.longValue();
        shownAt = SystemClock.elapsedRealtime();
        showing = true;
        render();
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
        lastTitle = null;
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

    /** Once a second from WorkoutService: refresh the clock and let the app check auto-pause. */
    static void tick() {
        WorkoutNoticePlugin p = instance;
        if (p == null || !p.showing) return;
        if (!p.clock().equals(p.lastTitle)) p.render();
        p.notifyListeners("tick", new JSObject());
    }

    static Notification currentNotification() {
        WorkoutNoticePlugin p = instance;
        return p == null || !p.showing ? null : p.build();
    }

    private long elapsedNow() {
        return elapsedMs + (paused ? 0 : SystemClock.elapsedRealtime() - shownAt);
    }

    private String clock() {
        long s = elapsedNow() / 1000, h = s / 3600, m = (s / 60) % 60, sec = s % 60;
        return h > 0 ? String.format(Locale.US, "%d:%02d:%02d", h, m, sec) : String.format(Locale.US, "%d:%02d", m, sec);
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

        String what = title, time = clock();
        // Under the clock: distance and pace, then steps; while paused, say so first.
        StringBuilder sub = new StringBuilder();
        if (paused) sub.append(status);
        if (!line1.isEmpty()) sub.append(sub.length() > 0 ? "  ·  " : "").append(line1);
        if (!line2.isEmpty()) sub.append(sub.length() > 0 ? "  ·  " : "").append(line2);
        lastTitle = time;

        MediaSessionCompat s = session(content);
        s.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, time)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, sub.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, what + "  ·  " + status)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art())
            .build());
        s.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE)
            .setState(paused ? PlaybackStateCompat.STATE_PAUSED : PlaybackStateCompat.STATE_PLAYING, elapsedNow(), paused ? 0f : 1f)
            .build());

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_track)
            .setLargeIcon(art())
            .setColor(CHARCOAL)
            .setColorized(true)
            .setContentTitle(time)
            .setContentText(sub.toString())
            .setSubText(what + "  ·  " + status)
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

    /** The "album art": the activity's icon in orange on charcoal, with a soft orange glow. */
    private Bitmap art() {
        if (art != null && kind.equals(artKind)) return art;
        int size = 512;
        Bitmap bm = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bm);
        c.drawColor(CHARCOAL);
        Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
        glow.setShader(new RadialGradient(size / 2f, size / 2f, size * 0.48f,
            new int[] { 0x66FF6A13, 0x22FF6A13, Color.TRANSPARENT }, new float[] { 0f, 0.55f, 1f }, Shader.TileMode.CLAMP));
        c.drawRect(0, 0, size, size, glow);

        Path icon = new Path();
        if ("bike".equals(kind)) {
            Path g = new Path();
            g.addCircle(5.5f, 16.5f, 3.5f, Path.Direction.CW);
            g.addCircle(18.5f, 16.5f, 3.5f, Path.Direction.CW);
            g.addPath(PathParser.createPathFromPathData("M5.5 16.5L9 9h6l3.5 7.5M9 9l3 7.5L15 9M8 6h3"));
            Matrix m = new Matrix();
            m.setValues(new float[] { -0.9f, 0, 22.8f, 0, 0.9f, -1.5f, 0, 0, 1 });
            g.transform(m);
            icon.addPath(g);
        } else if ("run".equals(kind)) {
            icon.addPath(PathParser.createPathFromPathData("M15 16.5H21v-2.2a2 2 0 0 0-1.4-1.9L16.8 12 16.3 7.6 13.3 5.9 11.8 7.1 9.4 5.8 5.4 9 4.4 10.9z"));
        } else {
            icon.addPath(PathParser.createPathFromPathData("M3 16.5h18v-2.2a2 2 0 0 0-1.4-1.9l-5.1-1.6-2.5-4.3H8.5l-.8 2H5L3 14z"));
        }
        icon.addPath(PathParser.createPathFromPathData("M3 19h18"));
        // The icon is drawn on a 24-unit grid; scale it to half the art, centered.
        float scale = size * 0.5f / 24f;
        Matrix fit = new Matrix();
        fit.setScale(scale, scale);
        fit.postTranslate(size * 0.25f, size * 0.25f);
        icon.transform(fit);
        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(2f * scale);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setStrokeJoin(Paint.Join.ROUND);
        stroke.setColor(ORANGE);
        c.drawPath(icon, stroke);

        art = bm;
        artKind = kind;
        return bm;
    }
}
