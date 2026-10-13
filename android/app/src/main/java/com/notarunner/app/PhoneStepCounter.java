package com.notarunner.app;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;

import androidx.core.content.ContextCompat;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.time.ZoneId;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Reads the phone's step counter now and then (every 15 minutes in the background, and whenever the
 * app asks) and keeps steps per day in DailySteps. Call off the main thread: a reading waits for
 * the sensor's first value.
 */
final class PhoneStepCounter {
    private static final String PREFS = "phoneSteps", WORK = "phoneSteps";

    private PhoneStepCounter() { }

    static boolean hasSensor(Context ctx) {
        SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        return sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    static boolean allowed(Context ctx) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            || ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    static void schedule(Context ctx) {
        PeriodicWorkRequest r = new PeriodicWorkRequest.Builder(StepWorker.class, 15, TimeUnit.MINUTES).build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, r);
    }

    static void cancel(Context ctx) {
        WorkManager.getInstance(ctx).cancelUniqueWork(WORK);
    }

    /** Takes a reading (when allowed) and returns the days so far. */
    static synchronized DailySteps sample(Context ctx, long timeoutMs) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        DailySteps d = new DailySteps();
        d.lastCount = p.getLong("count", -1);
        d.lastAt = p.getLong("at", 0);
        d.decodeDays(p.getString("days", ""));
        long count = allowed(ctx) ? read(ctx, timeoutMs) : -1;
        if (count >= 0) {
            long now = System.currentTimeMillis();
            d.sample(count, now, now - SystemClock.elapsedRealtime(), ZoneId.systemDefault());
            p.edit().putLong("count", d.lastCount).putLong("at", d.lastAt).putString("days", d.encodeDays()).apply();
        }
        return d;
    }

    /** The counter's current value (steps since the phone started), or -1. */
    private static long read(Context ctx, long timeoutMs) {
        SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        Sensor s = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (s == null) return -1;
        HandlerThread th = new HandlerThread("phoneSteps");
        th.start();
        CountDownLatch got = new CountDownLatch(1);
        long[] v = { -1 };
        SensorEventListener l = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent e) { v[0] = (long) e.values[0]; got.countDown(); }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        // An on-change sensor reports its current value right after it's turned on.
        sm.registerListener(l, s, SensorManager.SENSOR_DELAY_NORMAL, new Handler(th.getLooper()));
        try { got.await(timeoutMs, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        sm.unregisterListener(l);
        th.quitSafely();
        return v[0];
    }
}
