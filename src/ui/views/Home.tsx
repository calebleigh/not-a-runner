import { ReactNode } from "react";
import {
  LONGDAY, WEEKS, coachTip, dayDoneFrac, dayKey, daysBetween, hms, idParts, kfmt, phaseOf, phases, timedCardioLogs, todayDay,
  dayAt, type Tip,
} from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { Grow, Num } from "../motion";

/** Splits "Bike 25 min" into a title and a big number. */
function splitTitle(t: string) {
  const m = t.match(/^(.*?)\s([\d.]+)\s(min|mi)$/);
  return m ? { title: m[1], big: m[2], u: m[3] } : { title: t, big: "", u: "" };
}

function Chip({ ok, ic, big, sub, onClick }: { ok: boolean; ic: ReactNode; big: string; sub: string; onClick: () => void }) {
  return (
    <button className={"qchip" + (ok ? " ok" : "")} onClick={onClick}>
      <span className="ic">{ok ? <Icon.check /> : ic}</span>
      <b>{big}</b>
      <span>{sub}</span>
    </button>
  );
}

export function Home() {
  const { model, state, openSheet, setTab, now } = useApp();
  const { curWeek, rawWeek, dow, todayIdx, today } = model;
  const wk = model.weeks[curWeek - 1];
  const name = (state.settings.name || "").trim();
  const ids = wk.days.flatMap((x) => x.ids);
  const doneN = ids.filter((i) => state.done[i]).length, pct = Math.round(100 * doneN / ids.length);
  const day = todayDay(model);
  const missed = wk.days.filter((x) => x.date < today && !state.done[x.ids[0]]);

  let hero: ReactNode;
  if (day) {
    const c = day.c, lg = state.logs[day.ids[0]], dn = !!state.done[day.ids[0]];
    const { title, big, u } = splitTitle(c.t);
    const ht = <div className="ht">{title} {big && <span className="nw">{big}<small>{u}</small></span>}</div>;
    hero = dn ? (
      <button className="hero done tap" onClick={() => openSheet({ kind: "cardio", w: curWeek, d: todayIdx })}>
        <span className="lbl">Today's cardio, done</span>
        {ht}
        <div className="hstats">
          {lg?.dist ? <div><div className="num"><Num value={lg.dist} dec={2} /><span className="unit">mi</span></div><div className="lbl">Distance</div></div> : null}
          {lg?.time ? <div><div className="num">{hms(lg.time)}</div><div className="lbl">Time</div></div> : null}
          {lg?.dist && lg.time ? <div><div className="num">{c.kind === "bike" ? (lg.dist / (lg.time / 3600)).toFixed(1) : hms(lg.time / lg.dist)}</div><div className="lbl">{c.kind === "bike" ? "mph" : "Pace /mi"}</div></div> : null}
        </div>
        <span className="go"><Icon.check /></span>
      </button>
    ) : (
      <button className="hero tap" onClick={() => openSheet({ kind: "cardio", w: curWeek, d: todayIdx })}>
        <span className="lbl">Today's cardio{c.orig ? ", swapped" : ""}</span>
        {ht}
        <p>{c.d}</p>
        <span className="go"><Icon.play /></span>
      </button>
    );
  } else {
    hero = (
      <button className="hero rest tap" onClick={() => { if (missed[0]) openSheet({ kind: "day", w: curWeek, d: missed[0].d }); }}>
        <span className="lbl">{rawWeek < 1 ? "Starting soon" : "Weekend"}</span>
        <div className="ht">Rest day</div>
        <p>{missed.length ? `${missed.length} session${missed.length > 1 ? "s" : ""} left this week. Tap to make one up.` : "Week complete. Recover, hydrate, sleep."}</p>
        <span className="go"><Icon.check /></span>
      </button>
    );
  }

  const chips: ReactNode[] = [];
  if (day?.st) {
    const sd = !!state.done[day.ids[1]];
    chips.push(<Chip key="str" ok={sd} ic={<Icon.dumbbell />} big={sd ? "Done" : "Strength"} sub={`${day.st.title}, ${day.st.min} min`} onClick={() => openSheet({ kind: "strength", w: curWeek, d: todayIdx })} />);
  }
  const st = state.steps[dayKey(today)];
  chips.push(<Chip key="steps" ok={!!st} ic={<Icon.steps />} big={st ? kfmt(st) : "Add"} sub="Steps today" onClick={() => openSheet({ kind: "steps", date: today })} />);
  if (dow === 0 && rawWeek >= 1) {
    const wv = state.weights[curWeek];
    chips.push(<Chip key="wt" ok={!!wv} ic={<Icon.scale />} big={wv ? wv + " lb" : "Weigh in"} sub="Monday check-in" onClick={() => openSheet({ kind: "weigh" })} />);
  }
  const xs = state.extras[dayKey(today)] || [];
  const xmi = xs.reduce((a, x) => a + (x.dist || 0), 0);
  chips.push(<Chip key="extra" ok={xs.length > 0} ic={<Icon.plus />} big={xs.length ? xmi.toFixed(1) + " mi" : "Extra"} sub={xs.length ? `${xs.length} extra logged` : "Walk, hike, ride"} onClick={() => openSheet({ kind: "extra", date: today })} />);

  const tip = coachTip(model, now.getHours());
  const runTip = (t: Tip) => {
    if (t.action?.type === "steps") openSheet({ kind: "steps", date: t.action.date });
    else if (t.action?.type === "profile") setTab("profile");
  };

  const last = timedCardioLogs(state).pop();

  return (
    <section className="view stack" aria-label="Home">
      <div className="greet">
        <div>
          <div className="lbl">{now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
          <h1>{name ? `Ready, ${name}?` : "Ready to move?"}</h1>
        </div>
        <div className="wkbadge" style={{ ["--p" as string]: `${Math.round(100 * (curWeek - 1) / WEEKS)}%` }} title={`Week ${curWeek} of ${WEEKS}`}>
          <span>W{curWeek}</span>
        </div>
      </div>

      <section className="panelc vol">
        <div className="top"><span className="lbl">This week</span><b>{doneN} / {ids.length} done</b></div>
        <div className="meter">
          <Grow pct={pct} />
          <div className="mtxt"><span className="num"><Num value={pct} /><span className="unit">%</span></span><em>{phases[phaseOf(curWeek)].name}</em></div>
        </div>
        <div className="days7">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const planned = d < wk.days.length && (d < 5 || (curWeek === WEEKS && d === 5));
            const f = planned ? dayDoneFrac(model, curWeek, d) : -1;
            const isT = rawWeek >= 1 && d === dow;
            return (
              <button key={d} className={"d7" + (isT ? " today" : "")} aria-label={LONGDAY[d]}
                onClick={() => { if (planned) openSheet({ kind: "day", w: curWeek, d }); else if (isT) openSheet({ kind: "log" }); }}>
                <span className={"t" + (f < 0 ? " rest" : "")}><Grow dir="h" pct={f > 0 ? Math.round(f * 100) : 0} /></span>
                <small>{"MTWTFSS"[d]}</small>
              </button>
            );
          })}
        </div>
      </section>

      {hero}

      <div className="chips" style={{ ["--n" as string]: chips.length === 4 ? 2 : chips.length }}>{chips}</div>

      {tip && (
        <div className={"coach" + (tip.adj ? " adj" : "")}>
          <span className="dot2" />
          <span>{tip.t}</span>
          {tip.a && <button onClick={() => runTip(tip)}>{tip.a}</button>}
        </div>
      )}

      {last && (() => {
        const [id, l] = last, p = idParts(id), b = dayAt(model, p.w, p.d)?.c;
        if (!b) return null;
        const when = dayAt(model, p.w, p.d)!.date, dd = daysBetween(when, today);
        const whenTxt = dd === 0 ? "Today" : dd === 1 ? "Yesterday" : when.toLocaleDateString("en-US", { weekday: "long" });
        const bike = b.kind === "bike";
        return <>
          <div className="sechead"><span className="lbl">Last session</span><button onClick={() => setTab("stats")}>History ›</button></div>
          <section className="panelc last">
            <svg className="route" viewBox="0 0 100 100" aria-hidden="true"><path d="M10 80 L30 55 L22 40 L48 30 L62 12 L70 40 L88 52 L72 78 L50 70 Z" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" /></svg>
            <span className="tag">{whenTxt}, {b.t}</span>
            <div className="row">
              <div><div className="lbl">Distance</div><div className="num">{l.dist ? <Num value={l.dist} dec={2} /> : "0"}<span className="unit">mi</span></div></div>
              <div style={{ textAlign: "right" }}>
                <div className="lbl">{bike ? "Speed" : "Pace"}</div>
                <div className="num">{l.dist ? (bike ? (l.dist / (l.time! / 3600)).toFixed(1) : hms(l.time! / l.dist)) : hms(l.time!)}<span className="unit">{l.dist ? (bike ? "mph" : "/mi") : ""}</span></div>
              </div>
            </div>
          </section>
        </>;
      })()}
    </section>
  );
}
