package com.notarunner.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

/** The phone's spoken updates (the same cases as src/training/milestones.test.ts). */
public class MilestonesTest {
    private Milestones fresh() {
        Milestones m = new Milestones();
        m.everyMi = 1;
        m.everyMin = 5;
        m.everySteps = 1000;
        m.start(0, 0, 0);
        return m;
    }

    @Test
    public void speaksEachOnce() {
        Milestones m = fresh();
        assertNull(m.check(0.9, 299, 999));
        assertEquals("1 mile", m.check(1.01, 120, 400));
        assertNull(m.check(1.2, 130, 500));
        assertEquals("5 minutes. 1,000 steps", m.check(1.3, 300, 1000));
    }

    @Test
    public void onlyTheNewestAfterAJump() {
        assertEquals("4 miles. 3,000 steps", fresh().check(4.1, 0, 3200));
    }

    @Test
    public void startsFromWhereAReopenedWorkoutIs() {
        Milestones m = fresh();
        m.start(2.5, 1500, 4200);
        assertNull(m.check(2.6, 1510, 4300));
    }

    @Test
    public void readsPlainly() {
        assertEquals("Half a mile", Milestones.milesText(0.5));
        assertEquals("2.5 miles", Milestones.milesText(2.5));
        assertEquals("2 miles", Milestones.milesText(2));
        assertEquals("1 hour 15 minutes", Milestones.minutesText(75));
        assertEquals("2 hours", Milestones.minutesText(120));
    }
}
