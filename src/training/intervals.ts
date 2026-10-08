// Walk/run interval coaching: turns a session's instructions ("Walk 5 min to warm up, then jog 1 min,
// walk 2 min, 7 rounds") into a timed schedule, and says where you are in it.

export interface Segment {
  kind: "warmup" | "jog" | "walk" | "cooldown";
  /** Seconds. 0 for the open-ended cool-down after the last round. */
  secs: number;
  round?: number;
}

export interface IntervalPlan {
  segments: Segment[];
  rounds: number;
}

/** The interval schedule in a session's instructions, or null if it doesn't have one. */
export function intervalPlan(instructions: string): IntervalPlan | null {
  const m = /jog ([\d.]+) min, walk ([\d.]+) min, (\d+) rounds/i.exec(instructions);
  if (!m) return null;
  const jog = Math.round(parseFloat(m[1]) * 60), walk = Math.round(parseFloat(m[2]) * 60), rounds = parseInt(m[3]);
  const warm = /walk (\d+) min to warm up/i.exec(instructions);
  const segments: Segment[] = [];
  if (warm) segments.push({ kind: "warmup", secs: parseInt(warm[1]) * 60 });
  for (let r = 1; r <= rounds; r++) {
    segments.push({ kind: "jog", secs: jog, round: r });
    // The last walk is the start of the cool-down.
    if (r < rounds) segments.push({ kind: "walk", secs: walk, round: r });
  }
  segments.push({ kind: "cooldown", secs: 0 });
  return { segments, rounds };
}

export interface IntervalNow {
  index: number;
  segment: Segment;
  /** Seconds left in this segment (null in the open-ended cool-down). */
  left: number | null;
}

/** Where the schedule is after `elapsedS` seconds of (unpaused) workout time. */
export function intervalAt(plan: IntervalPlan, elapsedS: number): IntervalNow {
  let t = 0;
  for (let i = 0; i < plan.segments.length; i++) {
    const s = plan.segments[i];
    if (s.kind === "cooldown") return { index: i, segment: s, left: null };
    if (elapsedS < t + s.secs) return { index: i, segment: s, left: t + s.secs - elapsedS };
    t += s.secs;
  }
  const last = plan.segments.length - 1;
  return { index: last, segment: plan.segments[last], left: null };
}

/** What to say when a segment starts. */
export function intervalCue(plan: IntervalPlan, s: Segment): string {
  if (s.kind === "warmup") return `Walk to warm up, ${Math.round(s.secs / 60)} minutes.`;
  if (s.kind === "cooldown") return "Intervals done. Walk easy to cool down, then finish.";
  const mins = s.secs % 60 ? `${(s.secs / 60).toFixed(1)} minutes` : `${s.secs / 60} ${s.secs === 60 ? "minute" : "minutes"}`;
  if (s.kind === "jog") return s.round === plan.rounds ? `Last one. Jog now, ${mins}.` : `Jog now, ${mins}. Round ${s.round} of ${plan.rounds}.`;
  return `Walk now, ${mins}.`;
}
