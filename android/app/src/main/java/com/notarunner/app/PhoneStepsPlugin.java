package com.notarunner.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.time.LocalDate;
import java.util.Map;

/**
 * All-day steps counted by the phone itself, so steps work without another app. The app asks for
 * the activity permission (through the pedometer plugin) before start.
 */
@CapacitorPlugin(name = "PhoneSteps")
public class PhoneStepsPlugin extends Plugin {
    /** Listens while the app is on screen, so today's count climbs as you walk. */
    private SensorEventListener live;


    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", PhoneStepCounter.hasSensor(getContext()));
        r.put("allowed", PhoneStepCounter.allowed(getContext()));
        call.resolve(r);
    }

    /** Starts the background readings and takes one now. */
    @PluginMethod
    public void start(PluginCall call) {
        new Thread(() -> {
            PhoneStepCounter.schedule(getContext());
            PhoneStepCounter.sample(getContext(), 3000);
            call.resolve();
        }).start();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        PhoneStepCounter.cancel(getContext());
        call.resolve();
    }

    /** Sends "today" ({date, steps}) as the counter moves, until unwatch. */
    @PluginMethod
    public void watch(PluginCall call) {
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor s = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (s == null || !PhoneStepCounter.allowed(getContext())) { call.resolve(); return; }
        stopLive();
        live = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent e) {
                DailySteps d = PhoneStepCounter.record(getContext(), (long) e.values[0]);
                String today = LocalDate.now().toString();
                JSObject o = new JSObject();
                o.put("date", today);
                o.put("steps", d.days.getOrDefault(today, 0L));
                notifyListeners("today", o);
            }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        sm.registerListener(live, s, SensorManager.SENSOR_DELAY_NORMAL);
        call.resolve();
    }

    @PluginMethod
    public void unwatch(PluginCall call) {
        stopLive();
        call.resolve();
    }

    private void stopLive() {
        if (live == null) return;
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm != null) sm.unregisterListener(live);
        live = null;
    }

    @Override
    protected void handleOnDestroy() {
        stopLive();
    }

    /** Takes a reading, then returns steps per day for the last `days` days. */
    @PluginMethod
    public void read(PluginCall call) {
        int n = call.getInt("days", 14);
        new Thread(() -> {
            // Keeps the background readings going (KEEP leaves a running schedule alone).
            PhoneStepCounter.schedule(getContext());
            DailySteps d = PhoneStepCounter.sample(getContext(), 3000);
            String from = LocalDate.now().minusDays(n - 1).toString();
            JSArray days = new JSArray();
            for (Map.Entry<String, Long> e : d.days.tailMap(from).entrySet()) {
                JSObject o = new JSObject();
                o.put("date", e.getKey());
                o.put("steps", e.getValue());
                days.put(o);
            }
            JSObject r = new JSObject();
            r.put("days", days);
            call.resolve(r);
        }).start();
    }
}
