import {
  LONGDAY, birthdayInfo, dateOf, isBirthdayOn, quoteForWeek, weekProgress, dayDoneFrac, phaseOf, phases,
  dayAt, whyForDay, todayList,
} from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { Recent } from "../Recent";
import { TodoCard } from "../TodoList";
import { ComingUp, TotalsCard, WeekCompare } from "../Totals";
import { TodayHero } from "../TodayHero";
import { Grow, Num } from "../motion";

export function Home() {
  const { model, state, openSheet, setTab, now } = useApp();
  const { curWeek, rawWeek, dow } = model;
  const wk = model.weeks[curWeek - 1];
  const name = (state.settings.name || "").trim();
  const prog = weekProgress(state, wk);
  const pct = prog.cardioTotal ? Math.round(100 * prog.cardioDone / prog.cardioTotal) : 0;

  const tl = todayList(model), left = tl.total - tl.done;

  const bday = birthdayInfo(state.settings.birthday, now);
  const why = whyForDay(state.settings, now);

  return (
    <section className="view stack" aria-label="Home">
      <div className="greet">
        <div>
          <div className="lbl">{now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
          {bday?.isToday ? (
            <h1 className="bdayhello"><Icon.cake />{name ? `Happy birthday, ${name}!` : "Happy birthday!"}</h1>
          ) : (
            <h1>{name ? `Ready, ${name}?` : "Ready to move?"}</h1>
          )}
          {why && <p className="nudge why">{why}</p>}
        </div>
        <div className="wkbadge" style={{ ["--p" as string]: `${Math.round(100 * (curWeek - 1) / model.spec.weeks)}%` }} title={`Week ${curWeek} of ${model.spec.weeks}`}>
          <span>W{curWeek}</span>
        </div>
      </div>

      <div className="cols homecols">
      <div className="col">
      <section className="panelc vol o1">
        <div className="top">
          <span className="lbl">This week</span>
          <span className="wkcounts">
            <b>{prog.cardioDone} / {prog.cardioTotal} cardio</b>
            {prog.strengthTotal > 0 && <small>{prog.strengthDone} / {prog.strengthTotal} strength</small>}
          </span>
        </div>
        <div className="meter">
          <Grow pct={pct} />
          <div className="mtxt"><span className="num"><Num value={pct} /><span className="unit">%</span></span><em>{phases[phaseOf(model.spec, curWeek)].name}</em></div>
        </div>
        <div className="days7">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const planned = !!dayAt(model, curWeek, d);
            const f = planned ? dayDoneFrac(model, curWeek, d) : -1;
            const isT = rawWeek >= 1 && d === dow;
            return (
              <button key={d} className={"d7" + (isT ? " today" : "")} aria-label={LONGDAY[d]}
                onClick={() => openSheet({ kind: "day", w: curWeek, d })}>
                <span className={"t" + (f < 0 ? " rest" : "")}><Grow dir="h" pct={f > 0 ? Math.round(f * 100) : 0} />{isBirthdayOn(state.settings.birthday, dateOf(model.spec, curWeek, d)) && <span className="daycake"><Icon.cake /></span>}</span>
                <small>{"MTWTFSS"[d]}</small>
              </button>
            );
          })}
        </div>
        <WeekCompare />
      </section>

      <div className="o2"><TodayHero onTap={() => setTab("today")} /></div>
      <button className="tdstrip o3" onClick={() => setTab("today")}>
        <span className="tdstrip-ic"><Icon.today /></span>
        <span className="tdstrip-t"><b>{left ? `${left} left today` : "Today is done"}</b><small>{tl.done} of {tl.total} checked off</small></span>
        <span className="tdstrip-dots" aria-hidden="true">{tl.tasks.map((t, i) => <i key={t.key} className={i < tl.done ? "on" : ""} />)}</span>
        <span className="tdgo" aria-hidden="true">&rsaquo;</span>
      </button>
      <div className="o4"><ComingUp /></div>
      {(() => {
        const q = quoteForWeek(curWeek);
        return (
          <figure className="panelc quote o7">
            <span className="lbl">Quote of the week</span>
            <blockquote>{q.text}</blockquote>
            <figcaption>{q.by}</figcaption>
          </figure>
        );
      })()}
      </div>

      <div className="col">
      <div className="o0"><TotalsCard /></div>
      <div className="o6"><Recent /></div>
      <div className="o5"><TodoCard /></div>



      </div>
      </div>
    </section>
  );
}
