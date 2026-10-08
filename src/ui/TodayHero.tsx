import { hms, todayDay } from "../training";
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

  if (!day) {
    const missed = wk.days.filter((x) => x.date < today && !state.done[x.ids[0]]);
    return (
      <button className="hero rest tap" onClick={() => { if (missed[0]) openSheet({ kind: "day", w: curWeek, d: missed[0].d }); }}>
        <span className="lbl">{rawWeek < 1 ? "Starting soon" : "Weekend"}</span>
        <div className="ht">Rest day</div>
        <p>{missed.length ? `${missed.length} session${missed.length > 1 ? "s" : ""} left this week. Tap to make one up.` : "Week complete. Recover, hydrate, sleep."}</p>
        <span className="go"><Icon.check /></span>
      </button>
    );
  }

  const c = day.c, lg = state.logs[day.ids[0]], dn = !!state.done[day.ids[0]];
  const { title, big, u } = splitTitle(c.t);
  const ht = <div className="ht">{title} {big && <span className="nw">{big}<small>{u}</small></span>}</div>;
  const open = () => openSheet({ kind: "cardio", w: curWeek, d: todayIdx });
  if (dn) {
    return (
      <button className="hero done tap" onClick={open}>
        <span className="lbl">Today's cardio, done</span>
        {ht}
        <div className="hstats">
          {lg?.dist ? <div><div className="num"><Num value={lg.dist} dec={2} /><span className="unit">mi</span></div><div className="lbl">Distance</div></div> : null}
          {lg?.time ? <div><div className="num">{hms(lg.time)}</div><div className="lbl">Time</div></div> : null}
          {lg?.dist && lg.time ? <div><div className="num">{c.kind === "bike" ? (lg.dist / (lg.time / 3600)).toFixed(1) : hms(lg.time / lg.dist)}</div><div className="lbl">{c.kind === "bike" ? "mph" : "Pace /mi"}</div></div> : null}
        </div>
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
