import { useLayoutEffect, useRef, useState } from "react";
import { DN, RACE, WEEKS, daysBetween, fmtShort, hms, phaseOf, phases, totals, weekFrac, type CardioKind } from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { Grow, Num } from "../motion";

const KC: Record<CardioKind, string> = { bike: "#FFA35C", walk: "#9A958F", run: "#FF6A13", long: "#FF6A13", test: "#FFD08A", race: "#FFD08A", rest: "#33302D" };

export function Plan() {
  const { model, state, openSheet } = useApp();
  const { curWeek, todayIdx, isWeekend, today } = model;
  const [planWeek, setPlanWeek] = useState(curWeek);
  const pillsRef = useRef<HTMLDivElement>(null);

  const T = totals(model), totMi = T.walk + T.run + T.bike;
  const daysLeft = Math.max(0, daysBetween(today, RACE));
  const w = model.weeks[planWeek - 1], vp = phases[phaseOf(planWeek)];

  // Keep the selected week pill centered.
  useLayoutEffect(() => {
    const P = pillsRef.current, sel = P?.querySelector<HTMLElement>(".wp.sel");
    if (!P || !sel) return;
    P.style.scrollBehavior = "auto";
    P.scrollLeft = sel.offsetLeft - P.clientWidth / 2 + 26;
    P.style.scrollBehavior = "";
  }, [planWeek]);

  return (
    <section className="view stack" aria-label="Plan">
      <section className="planhead">
        <span className="pill2">Current training</span>
        <h1>St. George Half</h1>
        <div className="trio">
          <div><span className="num"><Num value={daysLeft} /></span><span className="lbl">Days to race</span></div>
          <div><span className="num"><Num value={totMi} dec={1} /></span><span className="lbl">Miles logged</span></div>
          <div><span className="num"><Num value={Object.keys(state.done).length} /></span><span className="lbl">Workouts</span></div>
        </div>
        <div className="prog"><span className="bar"><Grow pct={Math.round(100 * (curWeek - 1) / WEEKS)} /></span><b>{curWeek}/{WEEKS} weeks</b></div>
      </section>

      <div className="wpills" ref={pillsRef}>
        {model.weeks.map((wk) => {
          const f = weekFrac(state, wk);
          const cls = (wk.n === planWeek ? " sel" : "") + (wk.n === curWeek ? " cur" : "") + (f >= 1 ? " full" : f > 0 ? " part" : "");
          return (
            <button key={wk.n} className={"wp" + cls} style={{ ["--p" as string]: `${Math.round(f * 100)}%` }} aria-label={`Week ${wk.n}`} aria-pressed={wk.n === planWeek} onClick={() => setPlanWeek(wk.n)}>
              <span>W{wk.n}</span>
              <span className="st">{f >= 1 && <Icon.check />}</span>
            </button>
          );
        })}
      </div>

      <div className="sechead"><span className="lbl">{vp.name}</span><span className="lbl">{fmtShort(w.s)} to {fmtShort(w.days[w.days.length - 1].date)}</span></div>

      {w.days.map((x) => {
        const c = x.c, lg = state.logs[x.ids[0]], cd = !!state.done[x.ids[0]], sd = x.ids[1] ? !!state.done[x.ids[1]] : true, all = cd && sd;
        const isT = planWeek === curWeek && x.d === todayIdx && !isWeekend && model.rawWeek >= 1;
        const s1 = lg?.time ? [hms(lg.time), "Time"] : [c.m ? `${c.m}` : "0", "Minutes"];
        const s2 = lg?.dist ? [lg.dist, "Miles"] : [c.kind === "bike" ? "Bike" : c.kind === "rest" ? "Rest" : "On foot", "Type"];
        const s3 = x.st ? [x.st.light ? "Stretch" : x.st.title.split(" ")[0], sd ? "Strength done" : "Strength"] : ["None", "Strength"];
        return (
          <button key={x.d} className={"sess" + (isT ? " today" : "")} style={{ ["--kc" as string]: KC[c.kind] }} onClick={() => openSheet({ kind: "day", w: planWeek, d: x.d })}>
            <div className="r1">
              <h3>{c.t}{all && <span className="ck"><Icon.check /></span>}</h3>
              <span className="dt">{isT ? "Today" : `${DN[x.d]} ${x.date.getDate()}`}</span>
            </div>
            <div className="r2">
              {[s1, s2, s3].map(([v, l], i) => <div key={i}><b>{String(v)}</b><span>{l}</span></div>)}
            </div>
          </button>
        );
      })}
    </section>
  );
}
