package com.notarunner.app;

import java.util.ArrayDeque;
import java.util.Iterator;

/**
 * Auto-pause on steps, decided on the phone so it keeps working with the screen off. The same rules
 * as the app's (src/training/autopause.ts): moving is 3 or more steps in about 6 seconds, so a stray
 * step while standing doesn't count; pause after the set time without moving; and on resuming, a
 * pause you walked straight through (as many steps as seconds) is erased.
 */
final class StepAutoPause {
    static final long WINDOW_MS = 6_000;
    static final int MOVING_STEPS = 3;

    /** Counts with their times: one from before the window as the starting point, then the rest. */
    private final ArrayDeque<long[]> log = new ArrayDeque<>();
    private long lastMoveAt = 0;

    void reset(long now) {
        log.clear();
        lastMoveAt = now;
    }

    /** Started or resumed by hand: the wait starts over. */
    void restart(long now) {
        lastMoveAt = now;
    }

    /** A new step count. True when it means you're moving. */
    boolean step(long now, long total) {
        log.addLast(new long[] { now, total });
        while (log.size() > 1) {
            Iterator<long[]> it = log.iterator();
            it.next();
            if (it.next()[0] <= now - WINDOW_MS) log.pollFirst(); else break;
        }
        if (total - log.peekFirst()[1] < MOVING_STEPS) return false;
        lastMoveAt = now;
        return true;
    }

    /** Time to pause: recording, auto-pause on, and no moving for that long. */
    boolean due(long now, int secs, boolean paused) {
        return secs > 0 && !paused && now - lastMoveAt >= secs * 1000L;
    }

    /** Walked the whole pause (at least a step a second): it was a mistake, so it's erased. */
    static boolean erase(long pausedMs, long steps) {
        return steps >= MOVING_STEPS && steps >= Math.max(pausedMs / 1000.0, 1);
    }
}
