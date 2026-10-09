import { addDays, dayAt, daysBetween, homeTotals, kfmt, nextMilestones, statKind, type Milestone, type SumUp } from "../training";
import { useApp } from "./app-state";
import { Icon } from "./icons";
import { Grow, Num } from "./motion";

/** "3h 05m", or "45m" under an hour. */
export function hoursMin(secs: number): string {
  const m = Math.round(secs / 60), h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

const MS_UNIT: Record<Milestone["kind"], string> = { steps: "steps", miles: "miles", hours: "hours" };
const msNum = (m: Milestone, v: number) => (m.kind === "steps" ? Math.round(v).toLocaleString("en-US") : m.kind === "miles" ? v.toFixed(1) : v.toFixed(1));

/** Home: lifetime steps, miles and hours in big type, and the next round number to chase. */
export function TotalsCard() {
  const { model, setTab } = useApp();
  const t = homeTotals(model).all, hours = t.secs / 3600;
  const next = nextMilestones({ steps: t.steps, miles: t.miles, hours })[0];
  return (
    <button className="panelc totals tap" aria-label="All time totals. Open stats." onClick={() => setTab("stats")}>
      <div className="top"><span className="lbl">All time</span><span className="more">Stats &rsaquo;</span></div>
      <div className="totbig"><span className="num"><Num value={t.steps} comma /></span><small>Steps</small></div>
      <div className="totrow">
        <div><b className="num"><Num value={t.miles} dec={1} /></b><small>Miles</small></div>
        <div><b className="num"><Num value={hours} dec={hours < 100 ? 1 : 0} /></b><small>Hours active</small></div>
      </div>
      {next && (
        <div className="totnext">
          <span className="totbar"><Grow pct={Math.round(next.frac * 100)} /></span>
          <small>Next: <b>{next.target.toLocaleString("en-US")} {MS_UNIT[next.kind]}</b>, {msNum(next, next.left)} to go</small>
        </div>
      )}
    </button>
  );
}

function Delta({ now, before, fmt }: { now: number; before: number; fmt: (v: number) => string }) {
  const d = now - before;
  if (Math.abs(d) < 1e-6) return <em className="dl">same</em>;
  return <em className={"dl " + (d > 0 ? "up" : "down")}>{d > 0 ? "▲" : "▼"} {fmt(Math.abs(d))}</em>;
}

/** Home "This week": this week's numbers against last week's. */
export function WeekCompare() {
  const { model } = useApp();
  if (model.rawWeek < 2) return null;
  const { week: w, lastWeek: l } = homeTotals(model);
  const row = (k: keyof SumUp, label: string, fmt: (v: number) => string) => (
    <div><b>{fmt(w[k])}</b><small>{label}</small><Delta now={w[k]} before={l[k]} fmt={fmt} /></div>
  );
  return (
    <div className="wkcmp" aria-label="This week compared with last week">
      {row("miles", "Miles", (v) => v.toFixed(1))}
      {row("secs", "Active", hoursMin)}
      {row("steps", "Steps", kfmt)}
    </div>
  );
}

/** Home: the next planned session and the race countdown. */
export function ComingUp() {
  const { model, openSheet } = useApp();
  const { spec, today } = model;
  let next = null;
  for (let k = 1; k <= 14 && !next; k++) {
    const n = daysBetween(spec.start, addDays(today, k));
    if (n < 0) continue;
    const day = dayAt(model, Math.floor(n / 7) + 1, n % 7);
    if (day && day.c.kind !== "rest") next = { day, w: Math.floor(n / 7) + 1, k };
  }
  const toRace = spec.race ? daysBetween(today, spec.race) : null;
  if (!next && (toRace === null || toRace < 0)) return null;
  const when = next ? (next.k === 1 ? "Tomorrow" : next.day.date.toLocaleDateString("en-US", { weekday: "long" })) : "";
  return (
    <section className="panelc coming">
      <span className="lbl">Coming up</span>
      {next && (
        <button className="cnext" onClick={() => openSheet({ kind: "day", w: next.w, d: next.day.d })}>
          <span className="ric">{next.day.c.kind === "bike" ? <Icon.bike /> : statKind(next.day.c.kind) === "run" ? <Icon.run /> : <Icon.shoe />}</span>
          <span className="rtx"><b>{next.day.c.t}</b><small>{when}{next.day.st && !next.day.st.light ? `, plus ${next.day.st.title.toLowerCase()}` : ""}</small></span>
        </button>
      )}
      {toRace !== null && toRace >= 0 && (
        <div className="crace"><span className="num">{toRace}</span><small>{toRace === 1 ? "day" : "days"} to {spec.raceName}</small></div>
      )}
    </section>
  );
}
