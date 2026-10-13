package com.notarunner.app;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.TreeMap;

/**
 * All-day steps from the phone's step counter, which counts in hardware and only resets when the
 * phone restarts. Each sample adds the steps since the last one to the day they were taken (split by
 * time when the gap crosses midnight). Pure, so it's tested without a phone.
 */
public class DailySteps {
    /** More than this between two samples is a glitch, not walking. */
    static final long MAX_GAP_STEPS = 100_000;
    /** Days kept on the phone (the app imports the last two weeks). */
    static final int KEEP_DAYS = 60;

    /** Steps per local day, "YYYY-MM-DD". */
    public final TreeMap<String, Long> days = new TreeMap<>();
    /** The counter at the last sample, or -1 before the first. */
    public long lastCount = -1;
    public long lastAt = 0;

    /**
     * Adds a reading of the counter. The first one only sets the starting point, except that steps
     * since a restart earlier today are all today's.
     */
    public void sample(long count, long at, long bootAt, ZoneId zone) {
        if (lastCount < 0) {
            if (count > 0 && count <= MAX_GAP_STEPS && day(bootAt, zone).equals(day(at, zone))) add(day(at, zone), count);
        } else if (at > lastAt) {
            long delta = count >= lastCount ? count - lastCount : count; // smaller: the phone restarted
            if (delta > 0 && delta <= MAX_GAP_STEPS) spread(delta, lastAt, at, zone);
        }
        lastCount = count;
        lastAt = at;
        trim(day(at, zone));
    }

    private static LocalDate day(long at, ZoneId zone) {
        return Instant.ofEpochMilli(at).atZone(zone).toLocalDate();
    }

    /** Shares `steps` taken between `from` and `to` across the days in between, by time. */
    private void spread(long steps, long from, long to, ZoneId zone) {
        long left = steps, t = from;
        while (left > 0) {
            LocalDate d = day(t, zone);
            long end = d.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();
            if (end >= to) { add(d, left); return; }
            long part = Math.min(left, Math.round((double) steps * (end - t) / (to - from)));
            add(d, part);
            left -= part;
            t = end;
        }
    }

    private void add(LocalDate d, long n) {
        if (n > 0) days.merge(d.toString(), n, Long::sum);
    }

    private void trim(LocalDate today) {
        days.headMap(today.minusDays(KEEP_DAYS).toString()).clear();
    }

    /** "2026-10-11=7412;2026-10-12=5812" */
    public String encodeDays() {
        StringBuilder b = new StringBuilder();
        for (Map.Entry<String, Long> e : days.entrySet()) {
            if (b.length() > 0) b.append(';');
            b.append(e.getKey()).append('=').append(e.getValue());
        }
        return b.toString();
    }

    public void decodeDays(String s) {
        days.clear();
        if (s == null || s.isEmpty()) return;
        for (String part : s.split(";")) {
            int i = part.indexOf('=');
            if (i <= 0) continue;
            try { days.put(part.substring(0, i), Long.parseLong(part.substring(i + 1))); } catch (NumberFormatException ignored) { }
        }
    }
}
