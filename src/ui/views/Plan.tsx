import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  DN, dateOf, isBirthdayOn, daysBetween, extrasFor, fmtShort, hms, phaseOf, phases, sameDay, weekFrac, weekProgress,
  type CardioKind, type Day,
} from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { useMirroredState } from "../mirror";
import { Grow, Num, reducedMotion } from "../motion";
import { TodoList } from "../TodoList";

const KC: Record<CardioKind, string> = { bike: "var(--accent-hi)", walk: "var(--muted)", run: "var(--accent)", long: "var(--accent)", test: "var(--gold)", race: "var(--gold)", rest: "var(--bar)" };
const DAY_SHORT = DN.map((d) => d.toUpperCase());

type Status = "done" | "part" | "today" | "missed" | "up" | "rest";

const STATUS: Record<Status, () => ReactNode> = {
  done: () => <span className="sstat done" aria-label="Done"><Icon.check /></span>,
  part: () => <span className="sstat part" aria-label="Partly done" />,
  today: () => <span className="sstat todaytag">Today</span>,
  missed: () => <span className="sstat missed">Missed</span>,
  up: () => <span className="sstat up" aria-hidden="true">›</span>,
  rest: () => null,
};

export function Plan() {
  const { model, state, openSheet } = useApp();
  const { curWeek, today } = model;
  const [planWeek, setPlanWeek] = useMirroredState("planWeek", curWeek);
  const stripRef = useRef<HTMLDivElement>(null);
  const [jump, setJump] = useState(0);

  const race = model.spec.race;
  const daysLeft = race ? Math.max(0, daysBetween(today, race)) : 0;
  const w = model.weeks[planWeek - 1], weekEnd = dateOf(model.spec, planWeek, 6);
  const prog = weekProgress(state, w);
  const isCur = planWeek === curWeek;
  const ph = phaseOf(model.spec, curWeek), P = phases[ph];

  // Keep the selected week tile in view.
  useLayoutEffect(() => {
    const P = stripRef.current, sel = P?.querySelector<HTMLElement>(".wt.sel");
    if (!P || !sel) return;
    P.style.scrollBehavior = "auto";
    P.scrollLeft = sel.offsetLeft - P.clientWidth / 2 + sel.offsetWidth / 2;
    P.style.scrollBehavior = "";
  }, [planWeek]);

  // "Today": back to this week, bring today's row into view and flash it.
  useEffect(() => {
    if (!jump) return;
    const row = document.querySelector<HTMLElement>(".srow.today") || document.querySelector<HTMLElement>(".slist");
    row?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    if (row?.classList.contains("today")) {
      row.classList.remove("flash");
      void row.offsetWidth;
      row.classList.add("flash");
    }
  }, [jump]);

  const rows = [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const date = dateOf(model.spec, planWeek, d), day: Day | undefined = w.days.find((x) => x.d === d);
    const isToday = sameDay(date, today);
    if (!day) {
      const xs = extrasFor(state, planWeek, d), mi = xs.reduce((a, x) => a + (x.dist || 0), 0);
      const status: Status = xs.length ? "done" : isToday ? "today" : "rest";
      return { d, date, isToday, status, kind: "rest" as CardioKind, title: "Rest", sub: xs.length ? `${xs.length} extra, ${mi.toFixed(1)} mi` : "Log a walk if you go", rest: true };
    }
    const c = day.c, lg = state.logs[day.ids[0]], cd = !!state.done[day.ids[0]], sd = day.ids[1] ? !!state.done[day.ids[1]] : true;
    const status: Status = cd && sd ? "done" : isToday ? "today" : cd || sd ? "part" : date < today ? "missed" : "up";
    const parts: string[] = [];
    if (lg?.time) parts.push(lg.dist ? `${lg.dist} mi in ${hms(lg.time)}` : hms(lg.time));
    else if (c.m && c.kind !== "rest") parts.push(`${c.m} min`);
    if (day.st) parts.push(day.st.light ? "Stretch" : `${day.st.title}${sd ? ", done" : ""}`);
    return { d, date, isToday, status, kind: c.kind, title: c.t, sub: parts.join(" · "), rest: false };
  });

  return (
    <section className="view stack" aria-label="Plan">
      <div className="greet">
        <div>
          <div className="lbl">{race ? `Race day, ${race.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}` : `${model.spec.weeks}-week fitness plan`}</div>
          <h1>{model.spec.raceName}</h1>
        </div>
        <div className="countdown">
          {race
            ? <><span className="num"><Num value={daysLeft} /></span><span className="lbl">days to go</span></>
            : <><span className="num"><Num value={model.spec.weeks - curWeek + 1} /></span><span className="lbl">weeks left</span></>}
        </div>
      </div>

      <section className="panelc phasep">
        <div className="top"><span className="lbl">Phase {ph + 1} of {phases.length}</span><b>{P.to - curWeek + 1} weeks left</b></div>
        <h3 className="phname">{P.name}</h3>
        <p className="phnote">{P.note}</p>
        <div className="phbar" aria-hidden="true">
          {phases.map((p, i) => (
            <span key={p.name}><Grow pct={i < ph ? 100 : i === ph ? Math.round(100 * (curWeek - p.from + 1) / (p.to - p.from + 1)) : 0} /></span>
          ))}
        </div>
        <div className="phlabels">{phases.map((p, i) => <small key={p.name} className={i === ph ? "now" : ""}>{p.name}</small>)}</div>
      </section>

      <section className="panelc weeksp">
        <div className="top">
          <span className="lbl">Weeks</span>
          <button className="todaybtn" onClick={() => { setPlanWeek(curWeek); setJump((j) => j + 1); }}>Today</button>
        </div>
        <div className="wstrip" ref={stripRef}>
          {phases.map((p) => (
            <div className="wphase" key={p.name}>
              <small className="wpname">{p.name}</small>
              <div className="wrow">
                {model.weeks.slice(p.from - 1, p.to).map((wk) => {
                  const f = weekFrac(state, wk);
                  return (
                    <button key={wk.n} className={"wt" + (wk.n === planWeek ? " sel" : "") + (wk.n === curWeek ? " cur" : "")}
                      aria-label={`Week ${wk.n}`} aria-pressed={wk.n === planWeek} onClick={() => setPlanWeek(wk.n)}>
                      <span className="t"><Grow dir="h" pct={Math.round(f * 100)} />{[0, 1, 2, 3, 4, 5, 6].some((d) => isBirthdayOn(state.settings.birthday, dateOf(model.spec, wk.n, d))) && <span className="daycake"><Icon.cake /></span>}</span>
                      <small>{wk.n}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="cols plancols">
        <div className="col">
          <section className="panelc slist" aria-label="Sessions">
            <div className="slhead">
              <span className="lbl">{isCur ? "This week" : `Week ${planWeek}`}<span className="sub2">{fmtShort(w.s)} to {fmtShort(weekEnd)}, {phases[phaseOf(model.spec, planWeek)].name}</span></span>
              <span className="wkcounts">
                <b>{prog.cardioDone} / {prog.cardioTotal} cardio</b>
                {prog.strengthTotal > 0 && <small>{prog.strengthDone} / {prog.strengthTotal} strength</small>}
              </span>
            </div>
            {rows.map((r) => (
              <button key={r.d} className={"srow " + r.status + (r.isToday ? " today" : "") + (r.rest ? " rest" : "")}
                style={{ ["--kc" as string]: KC[r.kind] }} onClick={() => openSheet({ kind: "day", w: planWeek, d: r.d })}>
                <span className="sday"><small>{DAY_SHORT[r.d]}</small><b>{r.date.getDate()}</b></span>
                <span className="sbody"><b>{r.title}{isBirthdayOn(state.settings.birthday, r.date) && <span className="inlinecake" title="Your birthday"><Icon.cake /></span>}</b><small>{r.sub}</small></span>
                {STATUS[r.status]()}
              </button>
            ))}
          </section>
        </div>
        <div className="col"><TodoList /></div>
      </div>
    </section>
  );
}
