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
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.PathParser;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The workout being tracked, on the lock screen and in the notification shade: a card in the
 * theme's accent with the app's drifting stripes, the clock (it counts on its own), distance, pace and steps, and a
 * Pause / Resume button. WorkoutService keeps it alive with the screen off, and this also counts
 * steps itself, since the step plugin stops listening when the app is in the background.
 */
@CapacitorPlugin(name = "WorkoutNotice")
public class WorkoutNoticePlugin extends Plugin {
    private static final String CHANNEL = "workout_live";
    /** The same id as the GPS service's notification, so a workout only ever shows one. */
    static final int ID = 28351;
    private static final String ACTION = "com.notarunner.app.WORKOUT_NOTICE";
    /** The theme's accent and the text that sits on it (the app sends them; Ember until then). */
    private int accent = 0xFFFF6A13, onAccent = 0xFF141210;

    private static WorkoutNoticePlugin instance;

    private BroadcastReceiver receiver;
    private boolean showing = false, serviceOn = false;
    // The last state from the app, so the clock and the button work without waiting for it.
    private String kind = "walk", title = "", status = "", line1 = "", line2 = "";
    private boolean paused = false;
    private long elapsedMs = 0, shownAt = 0;
    private String artKind = null;
    private Bitmap art;
    /** What the card shows, so it's only redrawn when that changes (a redraw restarts the stripes). */
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
        // Notification work happens on the main thread, like the tick.
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
        onAccent = color(call.getString("onAccent"), onAccent);
        Double ms = call.getDouble("elapsedMs", 0.0);
        elapsedMs = ms == null ? 0 : ms.longValue();
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

    /** Once a second from WorkoutService: let the app check auto-pause (the clock runs itself). */
    static void tick() {
        WorkoutNoticePlugin p = instance;
        if (p == null || !p.showing) return;
        p.notifyListeners("tick", new JSObject());
    }

    static Notification currentNotification() {
        WorkoutNoticePlugin p = instance;
        return p == null || !p.showing ? null : p.build();
    }

    private long elapsedNow() {
        return elapsedMs + (paused ? 0 : SystemClock.elapsedRealtime() - shownAt);
    }


    private void render() {
        try {
            NotificationManagerCompat.from(getContext()).notify(ID, build());
        } catch (SecurityException e) {
            // Notifications are off for the app; the workout still records.
        }
    }

    /** What the card shows; the clock's own count isn't part of it. */
    private String signature() {
        return kind + "|" + title + "|" + status + "|" + line1 + "|" + line2 + "|" + paused + "|" + accent + "|" + onAccent;
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

        // Under the clock: distance and pace, then steps; while paused, say so first.
        StringBuilder sub = new StringBuilder();
        if (paused) sub.append(status);
        if (!line1.isEmpty()) sub.append(sub.length() > 0 ? "  ·  " : "").append(line1);
        if (!line2.isEmpty()) sub.append(sub.length() > 0 ? "  ·  " : "").append(line2);
        shown = signature();

        // The big card says Paused in its header, so its bottom line doesn't repeat it.
        String detail = sub.toString(), bigDetail = paused && detail.startsWith(status) ? detail.substring(status.length()).replaceFirst("^  ·  ", "") : detail;
        RemoteViews big = card(R.layout.notif_workout, bigDetail, button);
        big.setTextViewText(R.id.nw_status, (title + "  ·  " + status).toUpperCase(java.util.Locale.US));
        RemoteViews small = card(R.layout.notif_workout_small, sub.toString(), button);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_track)
            .setColor(accent)
            .setContentTitle(title + "  ·  " + status)
            .setContentText(sub.toString())
            .setCustomContentView(small)
            .setCustomBigContentView(big)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
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

    /** One size of the card: the stripes drift while recording and hold still (faded) while paused. */
    private RemoteViews card(int layout, String sub, PendingIntent button) {
        RemoteViews v = new RemoteViews(getContext().getPackageName(), layout);
        // The theme's accent; faded toward grey while paused, like the app's card.
        v.setInt(R.id.nw_fill, "setColorFilter", paused ? mix(accent, 0xFF8F8A84, 0.5f) : accent);
        int text = paused ? mix(onAccent, 0xFF8F8A84, 0.25f) : onAccent;
        v.setTextColor(R.id.nw_time, text);
        v.setTextColor(R.id.nw_line, (text & 0x00FFFFFF) | 0xD9000000);
        if (layout == R.layout.notif_workout) v.setTextColor(R.id.nw_status, (text & 0x00FFFFFF) | 0xB8000000);
        v.setInt(R.id.nw_btn, "setColorFilter", accent);
        v.setViewVisibility(R.id.nw_stripes, paused ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.nw_stripes_still, paused ? View.VISIBLE : View.GONE);
        v.setImageViewBitmap(R.id.nw_icon, icon());
        v.setChronometer(R.id.nw_time, SystemClock.elapsedRealtime() - elapsedNow(), null, !paused);
        v.setTextViewText(R.id.nw_line, sub);
        v.setImageViewResource(R.id.nw_btn, paused ? R.drawable.ic_notif_play : R.drawable.ic_notif_pause);
        v.setContentDescription(R.id.nw_btn, paused ? "Resume" : "Pause");
        v.setOnClickPendingIntent(R.id.nw_btn, button);
        return v;
    }

    /** The activity's icon (the app's shoe, toes-up shoe or bike) in the accent, for the card's dark tile. */
    private Bitmap icon() {
        if (art != null && (kind + accent).equals(artKind)) return art;
        int size = 144;
        Bitmap bm = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bm);
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
        // Drawn on a 24-unit grid, with a little room for the stroke.
        float scale = size / 26f;
        Matrix fit = new Matrix();
        fit.setScale(scale, scale);
        fit.postTranslate(scale, scale);
        icon.transform(fit);
        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(2f * scale);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setStrokeJoin(Paint.Join.ROUND);
        stroke.setColor(accent);
        c.drawPath(icon, stroke);
        art = bm;
        artKind = kind + accent;
        return bm;
    }
}
