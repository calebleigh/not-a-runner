package com.notarunner.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.SystemClock;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The workout being tracked, on the lock screen and in the notification shade: the clock (it keeps
 * counting on its own), distance and pace, steps, and a Pause / Resume button. The button flips the
 * notification right away and tells the app, which pauses the workout and sends back the truth.
 */
@CapacitorPlugin(name = "WorkoutNotice")
public class WorkoutNoticePlugin extends Plugin {
    private static final String CHANNEL = "workout_live";
    private static final int ID = 7301;
    private static final String ACTION = "com.notarunner.app.WORKOUT_NOTICE";

    private BroadcastReceiver receiver;
    private boolean showing = false;
    // The last state shown, so the button can flip it without waiting for the app.
    private String title = "", status = "", line1 = "", line2 = "";
    private boolean paused = false;
    private long elapsedMs = 0, shownAt = 0;

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) {
                String action = i.getStringExtra("action");
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
                    }
                    shownAt = now;
                    render();
                }
                JSObject d = new JSObject();
                d.put("action", action);
                notifyListeners("action", d, true);
            }
        };
        ContextCompat.registerReceiver(getContext(), receiver, new IntentFilter(ACTION), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void handleOnDestroy() {
        try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) { }
        NotificationManagerCompat.from(getContext()).cancel(ID);
    }

    @PluginMethod
    public void show(PluginCall call) {
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
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        showing = false;
        NotificationManagerCompat.from(getContext()).cancel(ID);
        call.resolve();
    }

    private void render() {
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Workout in progress", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Your workout's time, pace and steps, with a Pause button, while you track.");
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }

        RemoteViews v = new RemoteViews(pkg, R.layout.notif_workout);
        // The clock: counts up from the elapsed time, or holds still while paused.
        v.setChronometer(R.id.nw_time, SystemClock.elapsedRealtime() - elapsedMs, null, !paused);
        v.setTextViewText(R.id.nw_status, title + "  ·  " + status);
        v.setTextViewText(R.id.nw_line1, line1);
        v.setTextViewText(R.id.nw_line2, line2);

        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(pkg);
        if (open != null) open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent content = open == null ? null
            : PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent act = new Intent(ACTION).setPackage(pkg).putExtra("action", paused ? "resume" : "pause");
        PendingIntent button = PendingIntent.getBroadcast(ctx, 1, act, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_track)
            .setColor(0xFFFF6A13)
            .setContentTitle(title + "  ·  " + status)
            .setContentText(line1)
            .setCustomContentView(v)
            .setCustomBigContentView(v)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .addAction(0, paused ? "Resume" : "Pause", button);
        if (content != null) b.setContentIntent(content);
        try {
            NotificationManagerCompat.from(ctx).notify(ID, b.build());
        } catch (SecurityException e) {
            // Notifications are off for the app; the workout still records.
        }
    }
}
