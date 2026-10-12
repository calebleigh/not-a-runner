package com.notarunner.app;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.ServiceCompat;

/**
 * Keeps a workout alive with the phone locked in a pocket: it holds the workout notification as a
 * foreground service, keeps the processor awake, and ticks once a second so the notification's
 * numbers and auto-pause keep going (the app's own timers slow to a crawl in the background).
 */
public class WorkoutService extends Service {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            WorkoutNoticePlugin.tick();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NotARunner:workout");
        wakeLock.setReferenceCounted(false);
        // A long workout is fine; this is only a backstop if the app dies without stopping it.
        wakeLock.acquire(6 * 60 * 60 * 1000L);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = WorkoutNoticePlugin.currentNotification();
        if (n == null) { stopSelf(); return START_NOT_STICKY; }
        try {
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
            ServiceCompat.startForeground(this, WorkoutNoticePlugin.ID, n, type);
        } catch (Exception e) {
            // Not allowed right now; the notification still shows, just without the service.
        }
        handler.removeCallbacks(tick);
        handler.post(tick);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(tick);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
