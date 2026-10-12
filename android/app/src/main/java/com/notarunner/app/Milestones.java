package com.notarunner.app;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Spoken updates during a workout: every mile, every few minutes, every thousand steps. The same
 * rules as the app's (src/training/milestones.ts), run on the phone so they keep coming with the
 * screen off. A jump past several (the count caught up) only says the newest one.
 */
final class Milestones {
    /** How often to speak each one (0 is off). */
    double everyMi = 0;
    int everyMin = 0, everySteps = 0;
    /** The last level spoken for each. */
    private long mi = 0, min = 0, steps = 0;

    private static long level(double v, double every) {
        return every > 0 ? (long) Math.floor(v / every + 1e-9) : 0;
    }

    /** Starts from the levels reached so far, so a reopened app doesn't repeat one. */
    void start(double miles, long elapsedS, long stepCount) {
        mi = level(miles, everyMi);
        min = level(elapsedS / 60.0, everyMin);
        steps = level(stepCount, everySteps);
    }

    /** What to say now, or null. */
    String check(double miles, long elapsedS, long stepCount) {
        List<String> say = new ArrayList<>();
        long m = level(miles, everyMi), t = level(elapsedS / 60.0, everyMin), s = level(stepCount, everySteps);
        if (everyMi > 0 && m > mi) { say.add(milesText(m * everyMi)); mi = m; }
        if (everyMin > 0 && t > min) { say.add(minutesText(t * everyMin)); min = t; }
        if (everySteps > 0 && s > steps) { say.add(String.format(Locale.US, "%,d steps", s * everySteps)); steps = s; }
        return say.isEmpty() ? null : String.join(". ", say);
    }

    static String milesText(double v) {
        double n = Math.round(v * 10) / 10.0;
        if (n == 0.5) return "Half a mile";
        if (n == 1) return "1 mile";
        return (n == Math.floor(n) ? String.valueOf((long) n) : String.valueOf(n)) + " miles";
    }

    static String minutesText(long total) {
        long h = total / 60, m = total % 60;
        String hs = h == 0 ? "" : h + (h == 1 ? " hour" : " hours");
        String ms = m == 0 ? "" : m + (m == 1 ? " minute" : " minutes");
        return hs.isEmpty() ? ms : ms.isEmpty() ? hs : hs + " " + ms;
    }
}
