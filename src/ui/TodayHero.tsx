import { dayCardio, dayKey, hms, kfmt, todayDay } from "../training";
import { useApp } from "./app-state";
import { Icon } from "./icons";
import { Num } from "./motion";

/** Splits "Bike 25 min" into a title and a big number. */
function splitTitle(t: string) {
  const m = t.match(/^(.*?)\s([\d.]+)\s(min|mi)$/);
  return m ? { title: m[1], big: m[2], u: m[3] } : { title: t, big: "", u: "" };
}

/** The orange card for today's cardio, shared by Home and Plan. */
export function TodayHero() {
  const { model, state, openSheet } = useApp();
  const { curWeek, rawWeek, todayIdx, today } = model;
  const wk = model.weeks[curWeek - 1];
  const day = todayDay(model);

  if (!day && rawWeek < 1) {
    // Before the plan starts: when it starts and what comes first.
    const first = model.weeks[0]?.days[0];
    return (
      <button className="hero rest tap" onClick={() => { if (first) openSheet({ kind: "day", w: 1, d: first.d }); }}>
        <span className="lbl">Starting soon</span>
        <div className="ht">Starts {model.spec.start.toLocaleDateString("en-US", { weekday: "long" })}</div>
        <p>{first ? `First up: ${first.c.t}, ${first.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}.` : "Your plan is ready."}</p>
        <span className="go"><Icon.play /></span>
      </button>
    );
  }
  if (!day) {
    const missed = wk.days.filter((x) => x.date < today && !state.done[x.ids[0]]);
    return (
      <button className="hero rest tap" onClick={() => { if (missed[0]) openSheet({ kind: "day", w: curWeek, d: missed[0].d }); }}>
        <span className="lbl">{rawWeek < 1 ? "Starting soon" : model.dow > 4 ? "Weekend" : "Day off"}</span>
        <div className="ht">Rest day</div>
        <p>{missed.length ? `${missed.length} session${missed.length > 1 ? "s" : ""} left this week. Tap to make one up.` : "Week complete. Recover, hydrate, sleep."}</p>
        <span className="go"><Icon.check /></span>
      </button>
    );
  }

  const c = day.c, dn = !!state.done[day.ids[0]];
  const { title, big, u } = splitTitle(c.t);
  const ht = <div className="ht">{title} {big && <span className="nw">{big}<small>{u}</small></span>}</div>;
  const open = () => openSheet({ kind: "cardio", w: curWeek, d: todayIdx });
  if (dn) {
    // Once today's session is in, the card sums up the whole day: the planned session plus every extra.
    const day = dayCardio(model, curWeek, todayIdx), steps = state.steps[dayKey(model.spec, today)];
    const planLine = `Planned ${c.t.toLowerCase()}: done.` + (day.extras ? ` Plus ${day.extras} extra${day.extras > 1 ? "s" : ""}.` : "");
    return (
      <button className="hero done tap" onClick={open}>
        <span className="lbl">Today, done</span>
        {day.dist ? <div className="ht"><span className="nw"><Num value={day.dist} dec={1} /><small>mi today</small></span></div> : ht}
        <div className="hstats">
          {day.secs ? <div><div className="num">{hms(day.secs)}</div><div className="lbl">Moving</div></div> : null}
          {steps ? <div><div className="num">{kfmt(steps)}</div><div className="lbl">Steps</div></div> : null}
          {day.cal ? <div><div className="num"><Num value={day.cal} /></div><div className="lbl">Calories</div></div> : null}
        </div>
        <p>{planLine}</p>
        <span className="go"><Icon.check /></span>
      </button>
    );
  }
  return (
    <button className="hero tap" onClick={open}>
      <span className="lbl">Today's cardio{c.orig ? ", swapped" : ""}</span>
      {ht}
      <p>{c.d}</p>
      <span className="go"><Icon.play /></span>
    </button>
  );
}
