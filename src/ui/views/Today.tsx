import { ReactNode } from "react";
import { extraLine, todayList, type TodayTask } from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { Grow } from "../motion";
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

/** Today: everything on for today, as a list to check off, and what's already done. */
export function Today() {
  const { model, update, openSheet, now } = useApp();
  const { curWeek, todayIdx, today } = model;
  const l = todayList(model);
  const todo = l.tasks.filter((t) => !t.done), done = l.tasks.filter((t) => t.done);
  const pct = l.total ? Math.round((100 * l.done) / l.total) : 0;

  const open = (t: TodayTask) => {
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
    const I = t.kind === "cardio" && t.title.startsWith("Bike") ? Icon.bike : ICONS[t.kind];
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
      </section>

      <section className="panelc slist tdlist" aria-label="Done today">
        <div className="slhead"><span className="lbl">Done</span><b>{done.length + l.extras.length || ""}</b></div>
        {done.map(row)}
        {l.extras.map((x, i) => {
          const e = extraLine(x);
          return <Row key={x.id ?? i} done ic={null} title={e.title} detail={`Extra, ${e.detail}`} onClick={() => openSheet({ kind: "extra", date: today })} />;
        })}
        {!done.length && !l.extras.length && <p className="setnote tdempty">Nothing yet. Check things off as you go.</p>}
        <button className="more" onClick={() => openSheet({ kind: "log" })}>Did something else? Log it &rsaquo;</button>
      </section>
    </section>
  );
}
