import { useState } from "react";
import {
  FEEL, GOALS, START, TARGET_PACE, WEEKS, addDays, dayAt, dayKey, hms, idParts, kfmt, mph, pace, pctTxt, phaseOf, predict, bestFor,
  runLogs, stepStats, timedCardioLogs, totals, weekFrac, type AdaptKey,
} from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { Grow, Num } from "../motion";

const RANGE_KEY = "sgOvRange";
type Range = "month" | "all";
function loadRange(): Range {
  try { return localStorage.getItem(RANGE_KEY) === "all" ? "all" : "month"; } catch { return "month"; }
}

export function Stats() {
  const { model, state, openSheet } = useApp();
  const { today, curWeek } = model;
  const [range, setRangeRaw] = useState<Range>(loadRange);
  const [showAll, setShowAll] = useState(false);
  const setRange = (r: Range) => { setRangeRaw(r); try { localStorage.setItem(RANGE_KEY, r); } catch { /* per-device preference only */ } };

  const mStart = new Date(today.getFullYear(), today.getMonth(), 1), mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const inR = range === "month" ? (d: Date) => d >= mStart && d < mEnd : () => true;
  const T = totals(model, inR), S = stepStats(state, inR), mi = T.walk + T.run + T.bike;
  const wDone = Object.keys(state.done).filter((id) => { const p = idParts(id); return inR(addDays(START, (p.w - 1) * 7 + p.d)); }).length;

  return (
    // Remount on range change so the big numbers count up again.
    <section className="view stack" aria-label="Stats" key={range}>
      <h1 className="pagetitle">Stats</h1>
      <div className="seg" role="group" aria-label="Range">
        <button className={range === "month" ? "sel" : ""} aria-pressed={range === "month"} onClick={() => setRange("month")}>{today.toLocaleDateString("en-US", { month: "long" })}</button>
        <button className={range === "all" ? "sel" : ""} aria-pressed={range === "all"} onClick={() => setRange("all")}>All time</button>
      </div>

      <section className="panelc bigstat">
        <span className="lbl">Total distance</span>
        <div><span className="num"><Num value={mi} dec={1} /></span><span className="unit">mi</span></div>
        <div className="split"><span>Walk <b>{T.walk.toFixed(1)}</b></span><span>Walk/run <b>{T.run.toFixed(1)}</b></span><span>Bike <b>{T.bike.toFixed(1)}</b></span></div>
      </section>

      <div className="tiles">
        <div className="tile"><span className="ti"><Icon.clock /></span><span className="lbl">Active time</span><span className="num"><Num value={T.secs / 3600} dec={1} /><span className="unit">hr</span></span></div>
        <div className="tile"><span className="ti"><Icon.flame /></span><span className="lbl">Calories</span><span className="num"><Num value={T.cal} k /></span></div>
        <div className="tile"><span className="ti"><Icon.bolt /></span><span className="lbl">Workouts</span><span className="num"><Num value={wDone} /></span></div>
        <div className="tile"><span className="ti"><Icon.steps /></span><span className="lbl">Steps</span><span className="num"><Num value={S.sum} k /></span></div>
      </div>

      {yearChart()}
      {stepsStrip((dt) => openSheet({ kind: "steps", date: dt }))}
      {goals()}
      {weight()}
      {adjustments()}

      {(() => {
        const all = timedCardioLogs(state).reverse();
        return (
          <section className="ocard">
            <div className="ohead"><h3>History</h3><span>{all.length} sessions</span></div>
            {!all.length && <p className="foot" style={{ margin: 0 }}>Nothing logged yet. Tap the orange button after your next session.</p>}
            {(showAll ? all : all.slice(0, 4)).map(([id, l]) => {
              const p = idParts(id), day = dayAt(model, p.w, p.d);
              if (!day) return null;
              const b = day.c;
              return (
                <div className="adjrow" key={id}>
                  <div>
                    <b>{day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}: {b.t}</b>
                    <small>{[l.dist ? `${l.dist} mi in ${hms(l.time!)}` : hms(l.time!), l.dist ? (b.kind === "bike" ? mph(l.time!, l.dist) : pace(l.time!, l.dist)) : null, l.hr ? `${l.hr} bpm` : null].filter(Boolean).join(", ")}</small>
                  </div>
                  <span className={"pill " + (l.feel === "easy" ? "up" : l.feel === "hard" ? "down" : "")}>{l.feel ? FEEL[l.feel] : ""}</span>
                </div>
              );
            })}
            {all.length > 4 && <button className="more" onClick={() => setShowAll(!showAll)}>{showAll ? "Show less" : `Show all ${all.length}`}</button>}
          </section>
        );
      })()}
    </section>
  );

  function yearChart() {
    const max = Math.max(...model.weeks.map((w) => w.load)), bw = 520 / WEEKS, H = 90;
    return (
      <section className="ocard chartc">
        <div className="ohead"><h3>The year</h3><span>Week {curWeek} of {WEEKS}</span></div>
        <svg viewBox={`0 0 520 ${H}`} preserveAspectRatio="none" style={{ height: H }} role="img" aria-label="Planned training load by week, completed portion filled">
          <defs><linearGradient id="og" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF8A3D" /><stop offset="1" stopColor="#E5540A" /></linearGradient></defs>
          {model.weeks.map((w, i) => {
            const hh = 8 + (H - 14) * w.load / max, x = i * bw + 1, f = weekFrac(state, w);
            return (
              <g key={w.n}>
                <rect x={x} y={H - hh} width={bw - 2} height={hh} rx={2} fill="#33302D" />
                {f > 0 && <rect x={x} y={H - hh * f} width={bw - 2} height={hh * f} rx={2} fill="url(#og)" />}
                {w.n === curWeek && <rect x={x + bw / 2 - 1} y={0} width={2} height={H} fill="#F4F1EC" opacity={0.7} />}
              </g>
            );
          })}
        </svg>
        <div className="split" style={{ justifyContent: "space-between", marginTop: 6 }}><span>Oct</span><span>Jan</span><span>Apr</span><span>Jul</span><span>Race</span></div>
      </section>
    );
  }

  function stepsStrip(onPick: (d: Date) => void) {
    const days = [6, 5, 4, 3, 2, 1, 0].map((i) => addDays(today, -i));
    const mx = Math.max(8000, ...days.map((dt) => state.steps[dayKey(dt)] || 0)), SA = stepStats(state);
    return (
      <section className="ocard">
        <div className="ohead"><h3>Steps</h3><span>{SA.days ? `${kfmt(SA.avg)} avg a day` : "Tap a day to add"}</span></div>
        <div className="weekstrip">
          {days.map((dt, i) => {
            const before = dt < START, v = before ? 0 : state.steps[dayKey(dt)] || 0;
            return (
              <button key={i} className={(i === 6 ? "today " : "") + (!v && !before ? "missing" : "")} disabled={before} onClick={() => onPick(dt)}
                aria-label={`${dt.toLocaleDateString("en-US", { weekday: "long" })}: ${v ? v + " steps" : "not logged"}`}>
                <span className="v">{v ? kfmt(v) : ""}</span>
                <span className="bar"><Grow dir="h" pct={Math.round(100 * v / mx)} /></span>
                <span className="lbl2">{i === 6 ? "Today" : dt.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}</span>
              </button>
            );
          })}
        </div>
        <p className="foot">Striped days are missing. Tap one to fill it in.</p>
      </section>
    );
  }

  function goals() {
    const hp = predict(state, 13.1);
    return (
      <section className="ocard">
        <div className="ohead"><h3>Goal times</h3><span>{hp ? `Half outlook ${hms(hp)}` : "Log runs for a prediction"}</span></div>
        {GOALS.map((g) => {
          const best = bestFor(state, g.dist), pr = predict(state, g.dist);
          return (
            <div className="goal" key={g.k}>
              <b>{g.name}</b>
              <small>{best ? `Best ${hms(best)}` : pr ? `Predicted ${hms(pr)}` : `By week ${g.by}`}</small>
              <div className="tiers">
                {["Finish", "Solid", "Stretch"].map((n, i) => (
                  <span key={n} className={best && best <= g.tiers[i] ? "hit" : ""}><em>{n}</em>{hms(g.tiers[i])}</span>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  function weight() {
    const ws = Object.entries(state.weights).map(([w, v]) => [+w, v] as const).sort((a, b) => a[0] - b[0]);
    const start = state.settings.startWt || ws[0]?.[1];
    let body;
    if (!ws.length || !start) body = <p className="foot" style={{ margin: 0 }}>No weigh-ins yet. Use the orange button on a Monday.</p>;
    else {
      const last = ws[ws.length - 1][1], ch = last - start;
      let chart = null;
      if (ws.length >= 2) {
        const all = [start, ...ws.map((x) => x[1])], mn = Math.min(...all) - 2, mx = Math.max(...all) + 2;
        const X = (w: number) => ((w - 1) / 51) * 500 + 10, Y = (v: number) => 100 - (v - mn) / (mx - mn) * 90;
        chart = (
          <svg viewBox="0 0 520 110" preserveAspectRatio="none" style={{ width: "100%", height: 100, marginTop: 8 }} role="img" aria-label="Weight by week">
            <line x1={10} x2={510} y1={Y(start)} y2={Y(start)} stroke="#2E2B28" strokeDasharray="4 4" />
            <polyline points={ws.map(([w, v]) => `${X(w).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" stroke="#FF6A13" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          </svg>
        );
      }
      body = <>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="big"><Num value={last} dec={1} /><span className="unit">lb</span></span>
          <span style={{ fontWeight: 700, color: ch < 0 ? "var(--accent)" : "var(--muted)" }}>{ch > 0 ? "+" : ""}{ch.toFixed(1)} lb</span>
        </div>
        {chart}
        <p className="foot">{ws.length >= 4 ? "A steady 0.5 to 1.5 lb a week is a healthy pace." : "Give it a few weeks before reading much into it."}</p>
      </>;
    }
    return (
      <section className="ocard">
        <div className="ohead"><h3>Weight</h3><span>{ws.length ? `Start ${start} lb` : "Weigh in on Mondays"}</span></div>
        {body}
      </section>
    );
  }

  function adjustments() {
    const rows: [AdaptKey, string][] = [["run", "Running and walking"], ["bike", "Biking"], ["str", "Strength"]];
    const hrs = runLogs(state).map(([, l]) => l.hr).filter((x): x is number => !!x).slice(-6);
    const notes: string[] = [];
    if (hrs.length) { const avg = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length); notes.push(`Avg heart rate ${avg} bpm${avg > 150 ? ", high for easy days." : ", a good easy range."}`); }
    const tp = TARGET_PACE[phaseOf(curWeek)];
    if (tp) notes.push(`Strong pace this phase: ${hms(tp)}/mi.`);
    return (
      <section className="ocard">
        <div className="ohead"><h3>Plan adjustments</h3><span>From your logs</span></div>
        {rows.map(([k, lab]) => {
          const v = model.adapt[k];
          const pill = k === "str" ? (v === 0 ? "On plan" : v > 0 ? `+${v * 2} reps` : `${v * 2} reps`) : pctTxt(v);
          return (
            <div className="adjrow" key={k}>
              <div><b>{lab}</b><small>{model.adapt.msg[k]}</small></div>
              <span className={"pill " + (v > 0 ? "up" : v < 0 ? "down" : "")}>{pill}</span>
            </div>
          );
        })}
        <p className="foot">{notes.join(" ") || "Three strong sessions step it up 10%. Two tough ones ease it back."}</p>
      </section>
    );
  }
}
