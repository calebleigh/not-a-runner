package com.notarunner.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.time.LocalDateTime;
import java.time.ZoneId;

import org.junit.Test;

/** All-day steps from the phone's step counter. */
public class DailyStepsTest {
    private static final ZoneId Z = ZoneId.of("America/New_York");

    private static long at(int day, int hour, int min) {
        return LocalDateTime.of(2026, 10, day, hour, min).atZone(Z).toInstant().toEpochMilli();
    }

    @Test
    public void firstReadingIsTheStartingPoint() {
        DailySteps d = new DailySteps();
        d.sample(50_000, at(12, 9, 0), at(1, 8, 0), Z);
        assertNull(d.days.get("2026-10-12"));
        d.sample(51_200, at(12, 9, 30), at(1, 8, 0), Z);
        assertEquals(Long.valueOf(1200), d.days.get("2026-10-12"));
    }

    @Test
    public void stepsSinceARestartThisMorningCountToday() {
        DailySteps d = new DailySteps();
        d.sample(3000, at(12, 11, 0), at(12, 7, 0), Z);
        assertEquals(Long.valueOf(3000), d.days.get("2026-10-12"));
    }

    @Test
    public void aRestartStartsTheCounterOver() {
        DailySteps d = new DailySteps();
        d.sample(50_000, at(12, 9, 0), at(1, 8, 0), Z);
        d.sample(400, at(12, 10, 0), at(12, 9, 50), Z);
        assertEquals(Long.valueOf(400), d.days.get("2026-10-12"));
    }

    @Test
    public void aGapOverMidnightIsSplitByTime() {
        DailySteps d = new DailySteps();
        d.sample(1000, at(12, 23, 0), at(1, 8, 0), Z);
        d.sample(1400, at(13, 1, 0), at(1, 8, 0), Z);
        assertEquals(Long.valueOf(200), d.days.get("2026-10-12"));
        assertEquals(Long.valueOf(200), d.days.get("2026-10-13"));
    }

    @Test
    public void glitchesAreIgnored() {
        DailySteps d = new DailySteps();
        d.sample(1000, at(12, 9, 0), at(1, 8, 0), Z);
        d.sample(900_000, at(12, 9, 15), at(1, 8, 0), Z);
        assertNull(d.days.get("2026-10-12"));
    }

    @Test
    public void keepsTwoMonthsAndRoundTrips() {
        DailySteps d = new DailySteps();
        d.days.put("2026-07-01", 5000L);
        d.days.put("2026-10-11", 7412L);
        d.sample(10, at(12, 9, 0), at(1, 8, 0), Z);
        assertNull(d.days.get("2026-07-01"));
        DailySteps e = new DailySteps();
        e.decodeDays(d.encodeDays());
        assertEquals(d.days, e.days);
    }
}
