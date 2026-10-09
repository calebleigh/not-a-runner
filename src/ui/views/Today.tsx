import { ReactNode } from "react";
import { statKind, todayDay, todayList, todayLogs, type TodayLog, type TodayTask } from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { Grow } from "../motion";
import { RouteThumb } from "../RouteMap";
import { TodayHero } from "../TodayHero";

const ICONS: Record<TodayTask["kind"], () => React.JSX.Element> = {
  cardio: Icon.shoe, strength: Icon.dumbbell, steps: Icon.steps, weigh: Icon.scale, todo: Icon.today,
};

function Row({ done, ic, title, detail, onClick, check }: { done: boolean; ic: ReactNode; title: string; detail: string; onClick: () => void; check?: () => void }) {
  return (
    <div className={"tdrow" + (done ? " done" : "")}>
      {check
        ? <button className="tdic tdbox" aria-label={done ? `Uncheck ${title}` : `Check off ${title}`} onClick={check}>{done ? <Icon.check /> : null}</button>
        : <span className="tdic">{done ? <Icon.check /> : ic}</span>}
      <button className="tdbody" onClick={onClick}>
        <b>{title}</b><small>{detail}</small>
        <span className="tdgo" aria-hidden="true">&rsaquo;</span>
      </button>
    </div>
  );
}

const LOG_ICONS: Record<TodayLog["icon"], () => React.JSX.Element> = {
  walk: Icon.shoe, run: Icon.run, bike: Icon.bike, strength: Icon.dumbbell, steps: Icon.steps, weigh: Icon.scale, extra: Icon.plus,
};
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** One thing logged today: its numbers up top, then what you entered. Tap to open or edit it. */
function LogCard({ x, onOpen }: { x: TodayLog; onOpen: () => void }) {
  const I = LOG_ICONS[x.icon];
  return (
    <article className="panelc tdlog">
      <button className="tdlhead" onClick={onOpen}>
        <span className="tdic"><I /></span>
        <span className="tdlt"><b>{x.title}</b>{x.at && x.at > 1e12 ? <small>Logged {clock(x.at)}</small> : null}</span>
        <span className="tdgo" aria-hidden="true">&rsaquo;</span>
      </button>
      {(x.stats.length > 0 || x.route) && (
        <div className="tdlbody">
          <div className="tdlstats">{x.stats.map((s) => <div key={s.u}><b>{s.v}</b><small>{s.u}</small></div>)}</div>
          <RouteThumb route={x.route} size={56} title={x.title} detail={x.stats.map((s) => `${s.v} ${s.u}`).join(", ")} />
        </div>
      )}
      {x.tags.length > 0 && <div className="tdltags">{x.tags.map((t) => <span key={t}>{t}</span>)}</div>}
    </article>
  );
}

/** Today: everything on for today, as a list to check off, and what's already done. */
export function Today() {
  const { model, update, openSheet, now } = useApp();
  const { curWeek, todayIdx, today } = model;
  const l = todayList(model);
  const todo = l.tasks.filter((t) => !t.done), checked = l.tasks.filter((t) => t.done && t.kind === "todo");
  const logs = todayLogs(model);
  const pct = l.total ? Math.round((100 * l.done) / l.total) : 0;

  const openLog = (x: TodayLog) => {
    if (x.kind === "extra") openSheet({ kind: "extra", date: today });
    else open({ kind: x.kind } as TodayTask);
  };
  const open = (t: Pick<TodayTask, "kind">) => {
    if (t.kind === "cardio") openSheet({ kind: "cardio", w: curWeek, d: todayIdx });
    else if (t.kind === "strength") openSheet({ kind: "strength", w: curWeek, d: todayIdx });
    else if (t.kind === "steps") openSheet({ kind: "steps", date: today });
    else if (t.kind === "weigh") openSheet({ kind: "weigh" });
  };
  const toggle = (t: TodayTask) => update((s) => {
    const x = s.todos[t.todoId!];
    if (!x) return;
    if (x.done) delete x.done; else x.done = Date.now();
  });
  const row = (t: TodayTask) => {
    const ck = t.kind === "cardio" ? statKind(todayDay(model)?.c.kind ?? "walk") : null;
    const I = ck === "bike" ? Icon.bike : ck === "run" ? Icon.run : ICONS[t.kind];
    return <Row key={t.key} done={t.done} ic={<I />} title={t.title} detail={t.detail}
      onClick={() => (t.kind === "todo" ? toggle(t) : open(t))} check={t.kind === "todo" ? () => toggle(t) : undefined} />;
  };

  return (
    <section className="view stack" aria-label="Today">
      <div className="greet">
        <div>
          <div className="lbl">{now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
          <h1>{todo.length ? "Your day" : "All done"}</h1>
        </div>
        <div className="tdcount"><b>{l.done}</b><span>of {l.total}</span></div>
      </div>
      <div className="meter tdmeter"><Grow pct={pct} /></div>

      <TodayHero />

      <section className="panelc slist tdlist" aria-label="To do today">
        <div className="slhead"><span className="lbl">To do</span><b>{todo.length ? `${todo.length} left` : "Nothing left"}</b></div>
        {todo.map(row)}
        {!todo.length && <p className="setnote tdempty">Everything for today is done. Nice work.</p>}
        {checked.map(row)}
      </section>

      <section className="tdlogs" aria-label="Logged today">
        <div className="slhead"><span className="lbl">Logged today</span><b>{logs.length || ""}</b></div>
        {logs.map((x) => <LogCard key={x.key} x={x} onOpen={() => openLog(x)} />)}
        {!logs.length && <p className="setnote tdempty">Nothing yet. What you log shows up here.</p>}
        <button className="btn" onClick={() => openSheet({ kind: "log" })}>+ Log something</button>
      </section>
    </section>
  );
}
