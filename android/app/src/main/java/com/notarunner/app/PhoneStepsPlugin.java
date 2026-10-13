package com.notarunner.app;

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
