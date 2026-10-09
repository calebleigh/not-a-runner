import type { ReactElement } from "react";
import { daysBetween, recentActivity, type RecentItem } from "../training";
import { useApp } from "./app-state";
import { Icon } from "./icons";

const ICON: Record<RecentItem["icon"], () => ReactElement> = {
  run: Icon.run, walk: Icon.shoe, bike: Icon.bike, strength: Icon.dumbbell, extra: Icon.plus, steps: Icon.steps, weigh: Icon.scale,
};

/** Home: the last few things logged. Tap one to open it. */
export function Recent() {
  const { model, openSheet, setTab } = useApp();
  const items = recentActivity(model, 3);
  const when = (d: Date) => {
    const n = daysBetween(d, model.today);
    return n === 0 ? "Today" : n === 1 ? "Yesterday" : n > 1 && n < 7 ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const open = (t: RecentItem["target"]) => {
    if (t.kind === "cardio") openSheet({ kind: "day", w: t.w, d: t.d });
    else if (t.kind === "strength") openSheet({ kind: "strength", w: t.w, d: t.d });
    else if (t.kind === "extra") openSheet({ kind: "extra", date: t.date });
    else if (t.kind === "steps") openSheet({ kind: "steps", date: t.date });
    else if (t.week === model.curWeek) openSheet({ kind: "weigh" });
    else setTab("stats");
  };
  return (
    <section className="panelc recent">
      <div className="top"><span className="lbl">Recent</span><button className="more" onClick={() => setTab("stats")}>See all &rsaquo;</button></div>
      {items.length ? (
        <ul>
          {items.map((it) => {
            const I = ICON[it.icon];
            return (
              <li key={it.key}>
                <button onClick={() => open(it.target)}>
                  <span className="ric"><I /></span>
                  <span className="rtx"><b>{it.title}</b><small>{it.detail}</small></span>
                  <span className="rwhen">{when(it.date)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rempty">Nothing logged yet. Your workouts, steps and weigh-ins show up here.</p>
      )}
    </section>
  );
}
