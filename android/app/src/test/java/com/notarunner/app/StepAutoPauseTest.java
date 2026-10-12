package com.notarunner.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** The phone's auto-pause, walking and standing with a faked clock (like src/ui/tracker.test.ts). */
public class StepAutoPauseTest {
    private final StepAutoPause ap = new StepAutoPause();
    private long t = 1_000_000, steps = 0;
    private boolean paused = false;

    /** Walks for a while, two steps a second; resumes if auto-paused. */
    private void walk(int secs) {
        for (int i = 0; i < secs; i++) {
            steps += 2;
            t += 1000;
            if (ap.step(t, steps)) paused = false;
        }
    }

    /** Stands for a while (with one stray step partway), checking each second like the service. */
    private void stand(int secs, int autoSecs) {
        for (int i = 0; i < secs; i++) {
            t += 1000;
            if (i == 3) ap.step(t, ++steps);
            if (ap.due(t, autoSecs, paused)) paused = true;
        }
    }

    @Test
    public void pausesEachStandAndResumesEachWalk() {
        ap.reset(t);
        walk(30);
        assertFalse(paused);
        for (int round = 0; round < 3; round++) {
            stand(12, 5);
            assertTrue("stand " + round, paused);
            walk(5);
            assertFalse("walk " + round, paused);
        }
    }

    @Test
    public void pausesAgainAfterResumingByHand() {
        ap.reset(t);
        walk(10);
        stand(10, 5);
        assertTrue(paused);
        paused = false;
        ap.restart(t);
        stand(4, 5);
        assertFalse("not yet", paused);
        stand(3, 5);
        assertTrue(paused);
    }

    @Test
    public void strayStepsDontCountAsMoving() {
        ap.reset(t);
        assertFalse(ap.step(t += 30_000, 1));
        assertFalse(ap.step(t += 10_000, 2));
        assertTrue(ap.step(t += 1_000, 4));
        assertTrue("a late batch counts", ap.step(t += 30_000, 16));
    }

    @Test
    public void erasesOnlyAPauseYouWalkedThrough() {
        assertTrue(StepAutoPause.erase(20_000, 34));
        assertFalse(StepAutoPause.erase(60_000, 4));
        assertFalse(StepAutoPause.erase(1_000, 2));
    }
}
