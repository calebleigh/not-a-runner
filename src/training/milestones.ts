// Spoken updates during a workout: every mile, every few minutes, every thousand steps. Pure, and
// the Android app runs the same rules itself (Milestones.java) so they keep coming with the screen off.

/** How often to speak each one (0 is off): miles, minutes, steps. `pause` says pauses and resumes (1 is on). */
export interface MilestonePrefs { mi: number; min: number; steps: number; pause: number }

export const MILESTONE_CHOICES = {
  mi: [0, 0.5, 1],
  min: [0, 5, 10, 15],
  steps: [0, 1000, 2000, 5000],
  pause: [0, 1],
} as const;
export const MILESTONES_DEFAULT: MilestonePrefs = { mi: 1, min: 5, steps: 1000, pause: 1 };

/** Where the workout is now. */
export interface MilestoneAt { miles: number; elapsedS: number; steps: number }
/** The last level spoken for each (how many miles, minutes or steps chunks). */
export interface MilestoneMarks { mi: number; min: number; steps: number }

const level = (v: number, every: number) => (every > 0 ? Math.floor(v / every + 1e-9) : 0);

/** The levels reached so far (to start from, so a reopened app doesn't repeat one). */
export function milestoneMarks(p: MilestonePrefs, at: MilestoneAt): MilestoneMarks {
  return { mi: level(at.miles, p.mi), min: level(at.elapsedS / 60, p.min), steps: level(at.steps, p.steps) };
}

/**
 * What to say now, if anything, and the new marks. A jump past several (the count caught up) only
 * says the newest one.
 */
export function milestoneCue(p: MilestonePrefs, marks: MilestoneMarks, at: MilestoneAt): { text: string; marks: MilestoneMarks } | null {
  const now = milestoneMarks(p, at);
  const say: string[] = [];
  if (p.mi && now.mi > marks.mi) say.push(milesText(now.mi * p.mi));
  if (p.min && now.min > marks.min) say.push(minutesText(now.min * p.min));
  if (p.steps && now.steps > marks.steps) say.push(`${(now.steps * p.steps).toLocaleString("en-US")} steps`);
  if (!say.length) return null;
  return { text: say.join(". "), marks: { mi: Math.max(now.mi, marks.mi), min: Math.max(now.min, marks.min), steps: Math.max(now.steps, marks.steps) } };
}

export function milesText(mi: number): string {
  const n = Math.round(mi * 10) / 10;
  return n === 0.5 ? "Half a mile" : n === 1 ? "1 mile" : `${n} miles`;
}

export function minutesText(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  const hs = h ? `${h} ${h === 1 ? "hour" : "hours"}` : "";
  const ms = m ? `${m} ${m === 1 ? "minute" : "minutes"}` : "";
  return [hs, ms].filter(Boolean).join(" ");
}
