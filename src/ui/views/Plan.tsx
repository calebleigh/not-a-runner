import { useEffect, useState, type ReactNode } from "react";
import {
  DN, dateOf, dayGrade, isBirthdayOn, daysBetween, extrasFor, fmtShort, hms, monthGrid, phaseOf, phases, planMonths, sameDay, weekProgress,
  type CardioKind, type Day, type MonthCell,
} from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { useMirroredState } from "../mirror";
import { Grow, Num, reducedMotion } from "../motion";
import { TodoList } from "../TodoList";

const KC: Record<CardioKind, string> = { bike: "var(--accent-hi)", walk: "var(--muted)", run: "var(--accent)", long: "var(--accent)", test: "var(--gold)", race: "var(--gold)", rest: "var(--bar)" };
const DAY_SHORT = DN.map((d) => d.toUpperCase());

type Status = "great" | "done" | "today" | "missed" | "up" | "rest";

const STATUS: Record<Status, () => ReactNode> = {
  done: () => <span className="sstat done" aria-label="Done"><Icon.check /></span>,
  great: () => <span className="sstat done great" aria-label="Great day, all done"><Icon.star /></span>,
  today: () => <span className="sstat todaytag">Today</span>,
  missed: () => <span className="sstat missed">Missed</span>,
  up: () => <span className="sstat up" aria-hidden="true">›</span>,
  rest: () => null,
};

export function Plan() {
  const { model, state, openSheet } = useApp();
  const { curWeek, today } = model;
  const [planWeek, setPlanWeek] = useMirroredState("planWeek", curWeek);
  const [jump, setJump] = useState(0);

  const race = model.spec.race;
  const daysLeft = race ? Math.max(0, daysBetween(today, race)) : 0;
  const w = model.weeks[planWeek - 1], weekEnd = dateOf(model.spec, planWeek, 6);
  const prog = weekProgress(state, w);
  const isCur = planWeek === curWeek;
  const ph = phaseOf(model.spec, curWeek), P = phases[ph];

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
    const c = day.c, lg = state.logs[day.ids[0]], sd = day.ids[1] ? !!state.done[day.ids[1]] : true;
    // Cardio done is a good day (a check); everything done is a great one (a star).
    const g = dayGrade(model, day, date);
    const status: Status = g === "great" ? "great" : g ? "done" : isToday ? "today" : date < today ? "missed" : "up";
    const parts: string[] = [];
    if (lg?.time) parts.push(lg.dist ? `${lg.dist} mi in ${hms(lg.time)}` : hms(lg.time));
    else if (c.m && c.kind !== "rest") parts.push(`${c.m} min`);
    if (day.st) parts.push(day.st.light ? "Stretch" : `${day.st.title}${sd ? ", done" : ""}`);
    return { d, date, isToday, status, kind: c.kind, title: c.t, sub: parts.join(" · "), rest: false };
  });

  return (
    <section className="view stack" aria-label="Plan">
      <div className="greet racehead">
        <div>
          <div className="lbl">{race ? `Race day, ${race.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}` : `${model.spec.weeks}-week fitness plan`}</div>
          <h2 className="racename">{model.spec.raceName}</h2>
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

      <MonthCalendar planWeek={planWeek} onDay={(c) => { setPlanWeek(c.w); openSheet({ kind: "day", w: c.w, d: c.d }); }}
        onToday={() => { setPlanWeek(curWeek); setJump((j) => j + 1); }} />

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

const KIND_ICON: Partial<Record<CardioKind, () => React.JSX.Element>> = {
  walk: Icon.shoe, run: Icon.run, long: Icon.run, test: Icon.run, bike: Icon.bike, race: Icon.flag,
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A month at a time: what's planned each day and how it went. Tap a day to open it. */
function MonthCalendar({ planWeek, onDay, onToday }: { planWeek: number; onDay: (c: MonthCell) => void; onToday: () => void }) {
  const { model, state } = useApp();
  const { today } = model;
  const months = planMonths(model);
  const nowIdx = Math.max(0, months.findIndex(([y, m]) => y === today.getFullYear() && m === today.getMonth()));
  const [idx, setIdx] = useMirroredState("planMonth", nowIdx);
  const i = Math.min(Math.max(idx, 0), months.length - 1);
  const [y, m] = months[i];
  const grid = monthGrid(model, y, m);
  const isNow = i === nowIdx;
  return (
    <section className="panelc calp" aria-label="Calendar">
      <div className="calhead">
        <button className="calnav" aria-label="Previous month" disabled={i === 0} onClick={() => setIdx(i - 1)}>&lsaquo;</button>
        <h3>{MONTHS[m]} <small>{y}</small></h3>
        <button className="calnav" aria-label="Next month" disabled={i === months.length - 1} onClick={() => setIdx(i + 1)}>&rsaquo;</button>
        <button className={"todaybtn" + (isNow ? " on" : "")} onClick={() => { setIdx(nowIdx); onToday(); }}>Today</button>
      </div>
      <div className="calgrid" role="grid">
        {"MTWTFSS".split("").map((l, k) => <span key={"h" + k} className="calh" aria-hidden="true">{l}</span>)}
        {grid.flat().map((c) => {
          const inPlan = c.status !== "out" && c.w >= 1 && c.w <= model.spec.weeks;
          const I = c.race ? Icon.flag : c.status === "rest" || c.status === "extra" || c.status === "out" ? null : KIND_ICON[c.kind];
          const cls = ["calc", c.status, c.great ? "great" : "", c.inMonth ? "" : "dim", c.today ? "today" : "", inPlan && c.w === planWeek ? "wk" : "", c.race ? "race" : ""].filter(Boolean).join(" ");
          return (
            <button key={c.date.getTime()} className={cls} disabled={!inPlan}
              aria-label={`${c.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${c.race ? "race day" : c.status === "rest" ? "rest" : c.great ? "great day" : c.status === "done" ? "good day" : c.status}`}
              onClick={() => onDay(c)}>
              <b>{c.date.getDate()}</b>
              <span className="calic">{I ? <I /> : c.status === "extra" ? <i className="caldot" /> : null}</span>
              {c.great && <span className="calstar" aria-hidden="true"><Icon.star /></span>}
              {isBirthdayOn(state.settings.birthday, c.date) && <span className="calcake"><Icon.cake /></span>}
            </button>
          );
        })}
      </div>
      <div className="calkey" aria-hidden="true">
        <span><i className="k done" />Good</span><span><i className="k done great" />Great</span><span><i className="k missed" />Missed</span><span><i className="k up" />Planned</span><span><i className="caldot" />Extra</span>
      </div>
    </section>
  );
}
