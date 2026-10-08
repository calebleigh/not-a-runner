import type { RaceGoal, TooSoon } from "../training";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const GOAL_LABEL: Record<RaceGoal, string> = { "5k": "5K", "10k": "10K", half: "half marathon", full: "marathon", fitness: "fitness" };

/** Explains why a race date is too soon, with one-tap fixes: the earliest date that works, or a shorter goal. */
export function TooSoonNote({ soon, onDate, onGoal }: { soon: TooSoon; onDate: (ymd: string) => void; onGoal: (g: RaceGoal) => void }) {
  return (
    <div className="planwarn toosoon">
      <p>{soon.message}</p>
      <div className="toosoonfix">
        <button className="chip" onClick={() => onDate(ymd(soon.earliest))}>Use {soon.earliest.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</button>
        {soon.shorter && <button className="chip" onClick={() => onGoal(soon.shorter!)}>Switch to {GOAL_LABEL[soon.shorter]}</button>}
      </div>
    </div>
  );
}
