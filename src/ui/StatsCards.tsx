import { useState } from "react";
import {
  ACT_TYPES, FEEL, addDays, dayKey, parseDayKey, breakdown, bucketsOf, consistency, feelCounts, hms, mph, pace, recordsOf, seriesOf, speedSeries, inPeriod,
  type Activity, type ActType, type Metric, type Period,
} from "../training";
import { useApp } from "./app-state";
import { Icon } from "./icons";
import { useMirroredState } from "./mirror";
import { Grow, Num } from "./motion";
import { RouteThumb } from "./RouteMap";
import { hoursMin } from "./Totals";

export const TYPE_LABEL = Object.fromEntries(ACT_TYPES) as Record<ActType, string>;
const TYPE_ICON: Record<ActType, () => React.JSX.Element> = { walk: Icon.shoe, run: Icon.run, bike: Icon.bike, strength: Icon.dumbbell, other: Icon.bolt };
const dayTxt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Distance, time, pace or speed, heart rate: whatever the session has. */
export function actDetail(a: Activity): string {
  return [
    a.dist ? `${a.dist} mi` : "",
    a.secs ? (a.type === "strength" ? `${Math.round(a.secs / 60)} min` : hms(a.secs)) : "",
    a.dist && a.secs && a.type !== "strength" ? (a.type === "bike" ? mph(a.secs, a.dist) : pace(a.secs, a.dist)) : "",
    a.hr ? `${a.hr} bpm` : "",
  ].filter(Boolean).join(", ");
}

function useOpen() {
  const { openSheet } = useApp();
  return (a: Activity) => {
    const t = a.target;
    if (t.kind === "extra") openSheet({ kind: "extra", date: t.date });
    else if (t.kind === "strength") openSheet({ kind: "strength", w: t.w, d: t.d });
    else openSheet({ kind: "day", w: t.w, d: t.d });
  };
}

// Trend ----------------------------------------------------------------------------------------

const METRICS: [Metric, string][] = [["miles", "Miles"], ["time", "Time"], ["workouts", "Workouts"], ["steps", "Steps"]];
const fmtMetric = (m: Metric, v: number) => (m === "miles" ? `${v.toFixed(1)} mi` : m === "time" ? hoursMin(v) : m === "steps" ? `${Math.round(v).toLocaleString("en-US")} steps` : `${v} ${v === 1 ? "workout" : "workouts"}`);

export function TrendCard({ acts, steps, p, withSteps }: { acts: Activity[]; steps: Map<number, number>; p: Period; withSteps: boolean }) {
  const [metricRaw, setMetric] = useMirroredState<Metric>("statsMetric", "miles");
  const metric = !withSteps && metricRaw === "steps" ? "miles" : metricRaw;
  const [pick, setPick] = useState<number | null>(null);
  const bs = bucketsOf(p), vals = seriesOf(acts, steps, bs, metric);
  const { model } = useApp();
  // Average over bars that have started, so future days or months don't drag it down.
  const sofar = Math.max(1, bs.filter((b) => b.start <= model.today).length);
  const max = Math.max(...vals, 0), total = vals.reduce((a, b) => a + b, 0), avg = total / sofar;
  const W = 520, H = 120, gap = bs.length > 40 ? 1 : 3, bw = W / bs.length;
  const labelEvery = Math.ceil(bs.length / 8);
  const sel = pick !== null && pick < bs.length ? pick : null;
  const unit = bs.length && bs[0].end.getTime() - bs[0].start.getTime() <= 86400000 * 1.5 ? "day" : bs.length && bs[0].end.getTime() - bs[0].start.getTime() <= 86400000 * 8 ? "week" : "month";
  const selLabel = sel === null ? null : unit === "day" ? dayTxt(bs[sel].start) : unit === "week" ? `Week of ${bs[sel].start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : bs[sel].start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <section className="ocard trendc">
      <div className="ohead"><h3>Trend</h3><span>{sel === null ? `Avg ${fmtMetric(metric, metric === "workouts" ? Math.round(avg * 10) / 10 : avg)} a ${unit}` : `${selLabel}: ${fmtMetric(metric, vals[sel])}`}</span></div>
      <div className="seg trendseg" role="radiogroup" aria-label="Chart shows">
        {METRICS.filter(([m]) => withSteps || m !== "steps").map(([m, l]) => (
          <button key={m} role="radio" aria-checked={metric === m} className={metric === m ? "sel" : ""} onClick={() => { setMetric(m); setPick(null); }}>{l}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} preserveAspectRatio="none" className="trendsvg" role="img" aria-label={`${METRICS.find((x) => x[0] === metric)![1]} per ${unit}`}>
        <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--accent-hi)" }} /><stop offset="1" style={{ stopColor: "var(--accent-lo)" }} /></linearGradient></defs>
        {max > 0 && <line x1={0} x2={W} y1={H - (H - 6) * avg / max} y2={H - (H - 6) * avg / max} className="trendavg" />}
        {vals.map((v, i) => {
          const h = max ? Math.max(v ? 3 : 0, (H - 6) * v / max) : 0, x = i * bw + gap / 2;
          return (
            <g key={i} onClick={() => setPick(sel === i ? null : i)} className="trendbar">
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              <rect x={x} y={H - h} width={Math.max(1, bw - gap)} height={h} rx={Math.min(3, bw / 4)} fill={sel === null || sel === i ? "url(#tg)" : "var(--bar)"} />
              {!v && <rect x={x} y={H - 2} width={Math.max(1, bw - gap)} height={2} style={{ fill: "var(--bar)" }} />}
            </g>
          );
        })}
      </svg>
      <div className="trendlbl" aria-hidden="true">
        {bs.map((b, i) => <span key={i} style={{ width: `${100 / bs.length}%` }}>{i % labelEvery === 0 ? b.label : ""}</span>)}
      </div>
      <p className="foot">Total {fmtMetric(metric, metric === "miles" ? Math.round(total * 10) / 10 : total)}. Tap a bar for its number.</p>
    </section>
  );
}

// Consistency ----------------------------------------------------------------------------------

export function ConsistencyCard({ acts, p }: { acts: Activity[]; p: Period }) {
  const { model, openSheet } = useApp();
  const c = consistency(model, acts, p);
  const lvl = (m: number) => (!m ? 0 : m < 20 ? 1 : m < 40 ? 2 : m < 60 ? 3 : 4);
  const open = (d: Date) => {
    const [w, dd] = parseDayKey(dayKey(model.spec, d));
    if (w >= 1) openSheet({ kind: "day", w, d: dd });
  };
  const pct = c.planned ? Math.round(100 * c.plannedDone / c.planned) : null;
  // A strip of weeks, one column per week, Monday on top (the Plan tab has the calendar). Short periods get bigger squares.
  const big = c.days.length <= 62;
  const lead = c.days.length ? (c.days[0].date.getDay() + 6) % 7 : 0;
  // Newest week first, on the left; each column still runs Monday to Sunday (empty slots pad the ends).
  const weeks: (typeof c.days[number] | null)[][] = [];
  c.days.forEach((x, i) => {
    const k = Math.floor((lead + i) / 7);
    (weeks[k] ??= Array(7).fill(null))[(lead + i) % 7] = x;
  });
  weeks.reverse();
  return (
    <section className="ocard consc">
      <div className="ohead"><h3>Consistency</h3><span>{c.activeDays} of {c.dayCount} days active</span></div>
      <div className="constiles">
        <div><b className="num"><Num value={c.currentRun} /></b><small>Day streak now</small></div>
        <div><b className="num"><Num value={c.bestRun} /></b><small>Best streak here</small></div>
        <div><b className="num">{pct === null ? "None" : <><Num value={pct} />%</>}</b><small>Planned done</small></div>
      </div>
      {c.days.length > 0 && (
        <div className={c.days.length <= 7 ? "heat row" : "heat strip" + (big ? " big" : "")} role="img" aria-label={`${c.activeDays} active days`}>
          {(c.days.length > 7 ? weeks.flat() : c.days).map((x, i) => x ? (
            <button key={x.date.getTime()} className={"hc l" + lvl(x.mins)} title={`${dayTxt(x.date)}: ${x.mins ? x.mins + " min" : "rest"}`}
              aria-label={`${dayTxt(x.date)}: ${x.mins ? x.mins + " minutes" : "nothing logged"}`} onClick={() => open(x.date)}>
            </button>
          ) : <span key={"p" + i} className="hc pad" />)}
        </div>
      )}
      <div className="heatkey" aria-hidden="true"><span>Less</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={"hc l" + l} />)}<span>More</span></div>
      <p className="foot">{c.days.length <= 7 ? "Tap a day to open it." : "Newest week on the left. Each column is a week, Monday on top. Tap a day to open it."}</p>
    </section>
  );
}

// Breakdown ------------------------------------------------------------------------------------

export function BreakdownCard({ acts }: { acts: Activity[] }) {
  const shares = breakdown(acts), feel = feelCounts(acts);
  const maxSecs = Math.max(1, ...shares.map((s) => s.secs));
  const fTot = feel.easy + feel.ok + feel.hard;
  return (
    <section className="ocard brkc">
      <div className="ohead"><h3>Breakdown</h3><span>By time spent</span></div>
      {shares.map((s) => {
        const I = TYPE_ICON[s.type];
        return (
          <div className="brow" key={s.type}>
            <span className="ric"><I /></span>
            <div className="bmain">
              <div className="btop"><b>{TYPE_LABEL[s.type]}</b><small>{s.count} {s.count === 1 ? "session" : "sessions"}{s.miles ? `, ${s.miles} mi` : ""}, {hoursMin(s.secs)}</small></div>
              <span className="bbar"><Grow pct={Math.round(100 * s.secs / maxSecs)} /></span>
            </div>
          </div>
        );
      })}
      {fTot > 0 && (
        <div className="feelbar">
          <span className="lbl">How it felt</span>
          <div className="fbar">
            {(["easy", "ok", "hard"] as const).map((k) => feel[k] ? <span key={k} className={"f " + k} style={{ flex: feel[k] }}>{FEEL[k]} {feel[k]}</span> : null)}
          </div>
        </div>
      )}
    </section>
  );
}

// Records --------------------------------------------------------------------------------------

export function RecordsCard({ acts, steps, p }: { acts: Activity[]; steps: Map<number, number>; p: Period }) {
  const open = useOpen();
  const rs = recordsOf(acts, steps, inPeriod(p));
  return (
    <section className="ocard recc">
      <div className="ohead"><h3>Records</h3><span>{p.kind === "all" ? "All time" : p.label}</span></div>
      {!rs.length && <p className="foot" style={{ margin: 0 }}>Log a few sessions and your bests show up here.</p>}
      <div className="recgrid">
        {rs.map((r) => (
          <button key={r.key} className="rec" disabled={!r.act} onClick={() => r.act && open(r.act)}>
            <small className="lbl">{r.label}</small>
            <b>{r.value}</b>
            <span>{r.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Speed ----------------------------------------------------------------------------------------

export function SpeedCard({ acts }: { acts: Activity[] }) {
  const hasFoot = speedSeries(acts, "foot").length > 0, hasBike = speedSeries(acts, "bike").length > 0;
  const [kindRaw, setKind] = useMirroredState<"foot" | "bike">("statsSpeed", "foot");
  if (!hasFoot && !hasBike) return null;
  const kind = kindRaw === "bike" ? (hasBike ? "bike" : "foot") : hasFoot ? "foot" : "bike";
  const pts = speedSeries(acts, kind);
  const W = 520, H = 110, P = 8;
  const vs = pts.map((x) => x.value), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const X = (i: number) => (pts.length < 2 ? W / 2 : P + (W - 2 * P) * i / (pts.length - 1));
  // Faster is higher: low pace numbers and high mph both sit at the top.
  const Y = (v: number) => kind === "bike" ? H - P - (H - 2 * P) * (v - lo) / span : P + (H - 2 * P) * (v - lo) / span;
  const hrs = pts.filter((x) => x.hr).map((x) => x.hr!), hlo = Math.min(...hrs), hhi = Math.max(...hrs), hspan = hhi - hlo || 1;
  const HY = (h: number) => H - P - (H - 2 * P) * (h - hlo) / hspan;
  const fmtV = (v: number) => (kind === "bike" ? `${v.toFixed(1)} mph` : `${hms(v)}/mi`);
  const first = pts[0]?.value, last = pts[pts.length - 1]?.value;
  const better = pts.length >= 2 && (kind === "bike" ? last > first : last < first);
  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
  return (
    <section className="ocard speedc">
      <div className="ohead"><h3>{kind === "bike" ? "Ride speed" : "Pace"}</h3><span>{pts.length} {pts.length === 1 ? "session" : "sessions"}</span></div>
      {hasFoot && hasBike && (
        <div className="seg trendseg" role="radiogroup" aria-label="Show">
          <button role="radio" aria-checked={kind === "foot"} className={kind === "foot" ? "sel" : ""} onClick={() => setKind("foot")}>On foot</button>
          <button role="radio" aria-checked={kind === "bike"} className={kind === "bike" ? "sel" : ""} onClick={() => setKind("bike")}>Bike</button>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="speedsvg" role="img" aria-label={`${kind === "bike" ? "Speed" : "Pace"} by session`}>
        {hrs.length >= 2 && <polyline className="hrline" points={pts.map((x, i) => (x.hr ? `${X(i).toFixed(1)},${HY(x.hr).toFixed(1)}` : "")).filter(Boolean).join(" ")} />}
        {pts.length >= 2 && <polyline className="spline" points={pts.map((x, i) => `${X(i).toFixed(1)},${Y(x.value).toFixed(1)}`).join(" ")} />}
        {pts.map((x, i) => <circle key={i} cx={X(i)} cy={Y(x.value)} r={3.5} className="spdot" />)}
      </svg>
      <div className="speedsum">
        <div><small className="lbl">Best</small><b>{fmtV(kind === "bike" ? hi : lo)}</b></div>
        <div><small className="lbl">Latest</small><b>{fmtV(last)}</b></div>
        {avgHr > 0 && <div><small className="lbl">Avg heart rate</small><b>{avgHr} bpm</b></div>}
      </div>
      <p className="foot">{pts.length < 2 ? "Log a couple more to see a trend." : better ? "Trending faster. Nice." : "Speed goes up and down. Easy days are supposed to be slow."}{hrs.length >= 2 ? " The faint line is heart rate." : ""}</p>
    </section>
  );
}

// Routes ---------------------------------------------------------------------------------------

export function RoutesCard({ acts }: { acts: Activity[] }) {
  const rs = acts.filter((a) => a.route).slice(-12).reverse();
  if (!rs.length) return null;
  return (
    <section className="ocard routesc">
      <div className="ohead"><h3>Routes</h3><span>Tap one to see the map</span></div>
      <div className="routegrid">
        {rs.map((a) => (
          <div key={a.key} className="rcell">
            <RouteThumb route={a.route} size={84} title={a.title} detail={actDetail(a)} />
            <small>{a.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

// History --------------------------------------------------------------------------------------

export function HistoryCard({ acts }: { acts: Activity[] }) {
  const open = useOpen();
  const [n, setN] = useState(25);
  const list = [...acts].reverse(), shown = list.slice(0, n);
  const groups: { mon: Date; items: Activity[] }[] = [];
  for (const a of shown) {
    const mon = addDays(a.date, -((a.date.getDay() + 6) % 7));
    const g = groups[groups.length - 1];
    if (g && g.mon.getTime() === mon.getTime()) g.items.push(a); else groups.push({ mon, items: [a] });
  }
  const weekMiles = (mon: Date) => acts.filter((a) => a.date >= mon && a.date < addDays(mon, 7)).reduce((x, a) => x + a.dist, 0);
  return (
    <section className="ocard histc">
      <div className="ohead"><h3>History</h3><span>{list.length} {list.length === 1 ? "session" : "sessions"}</span></div>
      {!list.length && <p className="foot" style={{ margin: 0 }}>Nothing here yet. Try a different period or activity.</p>}
      {groups.map((g) => (
        <div key={g.mon.getTime()} className="hgroup">
          <div className="hweek"><span>Week of {g.mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><span>{weekMiles(g.mon).toFixed(1)} mi</span></div>
          {g.items.map((a) => {
            const I = TYPE_ICON[a.type];
            return (
              <button key={a.key} className="hrow" onClick={() => open(a)}>
                <span className="ric"><I /></span>
                <span className="rtx"><b>{a.title}</b><small>{actDetail(a) || (a.type === "strength" ? "Done" : "Logged")}</small></span>
                <span className="hright">
                  <span className="rwhen">{a.date.toLocaleDateString("en-US", { weekday: "short" })} {a.date.getDate()}</span>
                  {a.feel && <span className={"pill " + (a.feel === "easy" ? "up" : a.feel === "hard" ? "down" : "")}>{FEEL[a.feel]}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      {list.length > n && <button className="more" onClick={() => setN(n + 50)}>Show more ({list.length - n} left)</button>}
    </section>
  );
}
