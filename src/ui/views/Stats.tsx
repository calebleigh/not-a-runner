import {
  GOALS, PERIODS, TARGET_PACE, ACT_TYPES, activities, bestFor, canGoBack, change, hms, pctTxt, periodOf, phaseOf, predict, runLogs, stepsByDay,
  summarize, weekFrac, inPeriod, type ActType, type AdaptKey, type PeriodKind,
} from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { useMirroredState } from "../mirror";
import { Num } from "../motion";
import { BreakdownCard, ConsistencyCard, HistoryCard, RecordsCard, RoutesCard, SpeedCard, TrendCard } from "../StatsCards";
import { hoursMin } from "../Totals";

const PERIOD_KEY = "statsPeriod";
function loadPeriod(): PeriodKind {
  try { const v = localStorage.getItem(PERIOD_KEY) as PeriodKind; return PERIODS.some(([k]) => k === v) ? v : "month"; } catch { return "month"; }
}

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const c = change(now, before);
  if (c === null) return null;
  const pct = Math.round(c * 100);
  return <span className={"sdelta " + (pct > 0 ? "up" : pct < 0 ? "down" : "")}>{pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct)}% <em>vs {label}</em></span>;
}

export function Stats() {
  const { model, state } = useApp();
  const { curWeek } = model;
  const [kind, setKindRaw] = useMirroredState<PeriodKind>("statsPeriod", loadPeriod);
  const [offset, setOffset] = useMirroredState<number>("statsOffset", 0);
  const [type, setType] = useMirroredState<ActType | "all">("statsType", "all");
  const setKind = (k: PeriodKind) => { setKindRaw(k); setOffset(0); try { localStorage.setItem(PERIOD_KEY, k); } catch { /* per-device preference only */ } };

  const all = activities(model), steps = stepsByDay(model);
  const first = [model.spec.start, ...all.map((a) => a.date), ...[...steps.keys()].map((ms) => new Date(ms))].reduce((a, b) => (b < a ? b : a));
  const p = periodOf(kind, model.today, offset, first), prev = periodOf(kind, model.today, offset - 1, first);
  const types = ACT_TYPES.filter(([t]) => all.some((a) => a.type === t));
  const picked = type === "all" || types.some(([t]) => t === type) ? type : "all";
  const ofType = picked === "all" ? all : all.filter((a) => a.type === picked);
  const inP = inPeriod(p), acts = ofType.filter((a) => inP(a.date));
  const withSteps = picked === "all";
  const S = summarize(ofType, withSteps ? steps : new Map(), p), B = summarize(ofType, withSteps ? steps : new Map(), prev);
  const prevLabel = kind === "week" ? "last week" : kind === "month" ? "last month" : kind === "quarter" ? "the 3 months before" : "last year";
  const cmp = kind !== "all";

  return (
    <section className="view stack" aria-label="Stats">
      <div className="stfilters">
        <div className="seg" role="radiogroup" aria-label="Period">
          {PERIODS.map(([k, l]) => <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? "sel" : ""} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        <div className="stnav">
          <button className="hicon" aria-label="Earlier" disabled={!canGoBack(p, first)} onClick={() => setOffset(offset - 1)}><span aria-hidden="true">&lsaquo;</span></button>
          <b>{p.label}</b>
          <button className="hicon" aria-label="Later" disabled={offset >= 0 || kind === "all"} onClick={() => setOffset(offset + 1)}><span aria-hidden="true">&rsaquo;</span></button>
        </div>
        {types.length > 1 && (
          <div className="stchips" role="radiogroup" aria-label="Activity">
            <button role="radio" aria-checked={picked === "all"} className={"chip" + (picked === "all" ? " on" : "")} onClick={() => setType("all")}>All</button>
            {types.map(([t, l]) => <button key={t} role="radio" aria-checked={picked === t} className={"chip" + (picked === t ? " on" : "")} onClick={() => setType(t)}>{l}</button>)}
          </div>
        )}
      </div>

      {/* Remount on filter change so the numbers count up again. */}
      <div className="stack" key={`${kind}:${offset}:${picked}`}>
        <div className="cols statstop">
          <section className="panelc bigstat">
            <span className="lbl">{picked === "all" ? "Distance" : `${ACT_TYPES.find(([t]) => t === picked)![1]} distance`}</span>
            <div><span className="num"><Num value={S.miles} dec={1} /></span><span className="unit">mi</span></div>
            {cmp && <Delta now={S.miles} before={B.miles} label={prevLabel} />}
          </section>
          <div className="tiles">
            <div className="tile"><span className="ti"><Icon.clock /></span><span className="lbl">Active time</span><span className="num tsmall">{hoursMin(S.secs)}</span>{cmp && <Delta now={S.secs} before={B.secs} label="before" />}</div>
            <div className="tile"><span className="ti"><Icon.bolt /></span><span className="lbl">Workouts</span><span className="num"><Num value={S.workouts} /></span>{cmp && <Delta now={S.workouts} before={B.workouts} label="before" />}</div>
            <div className="tile"><span className="ti"><Icon.flame /></span><span className="lbl">Calories</span><span className="num"><Num value={S.cal} k /></span>{cmp && <Delta now={S.cal} before={B.cal} label="before" />}</div>
            {withSteps
              ? <div className="tile"><span className="ti"><Icon.steps /></span><span className="lbl">Steps</span><span className="num"><Num value={S.steps} k /></span>{cmp && <Delta now={S.steps} before={B.steps} label="before" />}</div>
              : <div className="tile"><span className="ti"><Icon.check /></span><span className="lbl">Active days</span><span className="num"><Num value={S.activeDays} /></span>{cmp && <Delta now={S.activeDays} before={B.activeDays} label="before" />}</div>}
          </div>
        </div>

        <div className="statgrid">
          <TrendCard acts={ofType} steps={steps} p={p} withSteps={withSteps} />
          <ConsistencyCard acts={ofType} p={p} />
          <BreakdownCard acts={acts} />
          <RecordsCard acts={acts} steps={withSteps ? steps : new Map()} p={p} />
          <SpeedCard acts={acts} />
          <RoutesCard acts={acts} />
        </div>
        <HistoryCard acts={acts} />
      </div>

      <h2 className="stsec">Your plan</h2>
      {yearChart()}
      <div className="statgrid">
        {goals()}
        {weight()}
        {adjustments()}
      </div>
    </section>
  );

  function yearChart() {
    const max = Math.max(...model.weeks.map((w) => w.load)), bw = 520 / model.spec.weeks, H = 90;
    return (
      <section className="ocard chartc">
        <div className="ohead"><h3>Plan progress</h3><span>Week {curWeek} of {model.spec.weeks}</span></div>
        <svg viewBox={`0 0 520 ${H}`} preserveAspectRatio="none" style={{ height: H }} role="img" aria-label="Planned training load by week, completed portion filled">
          <defs><linearGradient id="og" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--accent-hi)" }} /><stop offset="1" style={{ stopColor: "var(--accent-lo)" }} /></linearGradient></defs>
          {model.weeks.map((w, i) => {
            const hh = 8 + (H - 14) * w.load / max, x = i * bw + 1, f = weekFrac(state, w);
            return (
              <g key={w.n}>
                <rect x={x} y={H - hh} width={bw - 2} height={hh} rx={2} style={{ fill: "var(--bar)" }} />
                {f > 0 && <rect x={x} y={H - hh * f} width={bw - 2} height={hh * f} rx={2} fill="url(#og)" />}
                {w.n === curWeek && <rect x={x + bw / 2 - 1} y={0} width={2} height={H} style={{ fill: "var(--ink)" }} opacity={0.7} />}
              </g>
            );
          })}
        </svg>
        <div className="split" style={{ justifyContent: "space-between", marginTop: 6 }}><span>Oct</span><span>Jan</span><span>Apr</span><span>Jul</span><span>Race</span></div>
      </section>
    );
  }

  function goals() {
    const hp = predict(state, 13.1);
    return (
      <section className="ocard goals">
        <div className="ohead"><h3>Goal times</h3><span>{hp ? `Half outlook ${hms(hp)}` : "Log runs for a prediction"}</span></div>
        <div className="goal goalhead" aria-hidden="true"><span /><em>Finish</em><em>Solid</em><em>Stretch</em></div>
        {GOALS.map((g) => {
          const best = bestFor(state, g.dist), pr = predict(state, g.dist);
          return (
            <div className="goal" key={g.k}>
              <span className="gname"><b>{g.name}</b><small>{best ? `Best ${hms(best)}` : pr ? `Predicted ${hms(pr)}` : `By week ${g.by}`}</small></span>
              {["Finish", "Solid", "Stretch"].map((n, i) => (
                <span key={n} className={"tier" + (best && best <= g.tiers[i] ? " hit" : "")} aria-label={`${n} ${hms(g.tiers[i])}`}>{hms(g.tiers[i])}</span>
              ))}
            </div>
          );
        })}
      </section>
    );
  }

  function weight() {
    const ws = Object.entries(state.weights).map(([w, v]) => [+w, v] as const).sort((a, b) => a[0] - b[0]);
    const start = state.settings.startWt || ws[0]?.[1];
    const goal = state.settings.goalWt;
    let body;
    if (!ws.length || !start) body = <p className="foot" style={{ margin: 0 }}>No weigh-ins yet. Use the orange button on a Monday.</p>;
    else {
      const last = ws[ws.length - 1][1], ch = last - start;
      let chart = null;
      if (ws.length >= 2) {
        const all = [start, ...ws.map((x) => x[1]), ...(goal ? [goal] : [])], mn = Math.min(...all) - 2, mx = Math.max(...all) + 2;
        const X = (w: number) => ((w - 1) / 51) * 500 + 10, Y = (v: number) => 100 - (v - mn) / (mx - mn) * 90;
        chart = (
          <svg viewBox="0 0 520 110" preserveAspectRatio="none" style={{ width: "100%", height: 100, marginTop: 8 }} role="img" aria-label="Weight by week">
            <line x1={10} x2={510} y1={Y(start)} y2={Y(start)} style={{ stroke: "var(--line)" }} strokeDasharray="4 4" />
            {goal ? <line x1={10} x2={510} y1={Y(goal)} y2={Y(goal)} style={{ stroke: "var(--good)" }} strokeDasharray="6 5" opacity={0.7} /> : null}
            <polyline points={ws.map(([w, v]) => `${X(w).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          </svg>
        );
      }
      body = <>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="big"><Num value={last} dec={1} /><span className="unit">lb</span></span>
          <span style={{ fontWeight: 700, color: ch < 0 ? "var(--accent)" : "var(--muted)" }}>{ch > 0 ? "+" : ""}{ch.toFixed(1)} lb</span>
        </div>
        {chart}
        <p className="foot">{goal && last > goal ? `${(last - goal).toFixed(1)} lb to your goal of ${goal}. ` : goal ? `You reached your goal of ${goal} lb. ` : ""}{ws.length >= 4 ? "A steady 0.5 to 1.5 lb a week is a healthy pace." : "Give it a few weeks before reading much into it."}</p>
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
    const tp = TARGET_PACE[phaseOf(model.spec, curWeek)];
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
