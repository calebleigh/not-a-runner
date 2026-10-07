import { Fragment, useState } from "react";
import { GEAR, START, addDays, fmtShort } from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { BUILT_AT, applyUpdate, checkForUpdate, useUpdateReady, type CheckResult } from "../updates";

const HOWTO: [string, string][] = [
  ["Every weekday", "Cardio and strength. The Home screen shows today's session; the Plan tab shows the whole year. Weekends are rest or a make-up day."],
  ["Logging", "Tap the orange button. Enter miles, time, how it felt, and heart rate if you have the band. The plan adjusts itself from that."],
  ["Swapping", "Bike broken or knees sore? Swap any cardio to bike, walk or walk/run. The time adjusts so it's still a fair workout."],
  ["Steps", "Each evening, enter your full step total from Samsung Health. Steps are tracked on their own and never added to miles or calories."],
  ["Weigh-ins", "Mondays, first thing in the morning. Watch the trend line, not a single number."],
  ["Gear", "Check off gear as you get it and your strength exercises upgrade to use it."],
  ["Slow is correct", "If you can't talk in full sentences on cardio, slow down or walk."],
  ["Sharp knee pain", "Swap that cardio for the bike. Dull tiredness is fine, sharp pain is not."],
  ["Bad day", "Do 10 minutes and log it. Showing up is the whole game."],
  ["Not medical advice", "This app is a training guide, not medical advice. Check with a doctor before starting, and stop if something hurts."],
];

const CHECK_TEXT: Record<CheckResult, string> = {
  ready: "Update ready.",
  current: "You're on the latest version.",
  offline: "You're offline. Try again later.",
  error: "Couldn't check. Try again later.",
  unsupported: "Updates install automatically in the installed app.",
};

function VersionRow() {
  const [status, setStatus] = useState<"idle" | "checking" | CheckResult>("idle");
  const ready = useUpdateReady() || status === "ready";
  const built = BUILT_AT.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + BUILT_AT.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const note = ready ? CHECK_TEXT.ready : status === "checking" ? "Checking for updates" : status === "idle" ? `Built ${built}` : CHECK_TEXT[status];
  return (
    <div className="setrow">
      <span>App version<small aria-live="polite">{note}</small></span>
      {ready ? (
        <button className="chip solid" onClick={applyUpdate}>Refresh</button>
      ) : (
        <button className="chip" disabled={status === "checking"} onClick={async () => { setStatus("checking"); setStatus(await checkForUpdate()); }}>
          {status === "checking" ? "Checking" : "Check"}
        </button>
      )}
    </div>
  );
}

function GearList() {
  const { model, state, update } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [openK, setOpenK] = useState<string | null>(null);
  const list = [...GEAR].sort((a, b) => a.wk - b.wk), owned = list.filter((g) => state.gear[g.k]).length;
  const shown = showAll ? list : list.filter((g) => !state.gear[g.k]).slice(0, 5);
  return <>
    <div className="sechead"><h3 style={{ fontSize: 24 }}>Gear</h3><span className="lbl">{owned} of {list.length} owned</span></div>
    <section className="card group" style={{ marginTop: 10 }}>
      {shown.map((g) => {
        const due = addDays(START, (g.wk - 1) * 7), have = !!state.gear[g.k], over = !have && g.wk < model.curWeek, soon = !have && !over && g.wk <= model.curWeek + 2;
        return (
          <Fragment key={g.k}>
            <div className={"grow" + (have ? " owned" : "") + (over ? " overdue" : "") + (soon ? " soon" : "")}>
              <span className="gcheck">
                <input type="checkbox" checked={have} aria-label={g.name} onChange={(e) => { const on = e.target.checked; update((s) => { if (on) s.gear[g.k] = 1; else delete s.gear[g.k]; }); }} />
                <span className="box"><Icon.box /></span>
              </span>
              <span className="gt"><b>{g.name}</b><small>{g.need ? "Need" : "Helpful"}, {g.cost}</small></span>
              <span className="due">{have ? "Owned" : over ? "Overdue" : fmtShort(due)}</span>
              <button className="ibtn" aria-label={`Why ${g.name}`} aria-expanded={openK === g.k} onClick={() => setOpenK(openK === g.k ? null : g.k)}>i</button>
            </div>
            {openK === g.k && <div className="gwhy">{g.why}{g.mp ? " Facebook Marketplace is fine for this one." : ""}</div>}
          </Fragment>
        );
      })}
      {!shown.length && <p className="setnote" style={{ padding: "14px 0" }}>You have everything on the list.</p>}
      <button className="more" onClick={() => setShowAll(!showAll)}>{showAll ? "Show only what's next" : `Show all ${list.length}, including owned`}</button>
    </section>
  </>;
}

export function Settings() {
  const { state, update, openSheet } = useApp();
  const [name, setName] = useState(state.settings.name || "");
  const [wt, setWt] = useState(state.settings.startWt ? String(state.settings.startWt) : "");
  return (
    <section className="view stack" aria-label="Settings">
      <h1 className="pagetitle">Settings</h1>
      <section className="card group">
        <label className="setrow" htmlFor="pName">
          <span>Name<small>For your greeting</small></span>
          <input className="txtin" id="pName" maxLength={20} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => update((s) => { const v = name.trim(); if (v) s.settings.name = v; else delete s.settings.name; })} />
        </label>
        <label className="setrow" htmlFor="startWt">
          <span>Starting weight<small>For calorie estimates</small></span>
          <span className="unitin">
            <input type="number" inputMode="decimal" id="startWt" min="80" max="500" placeholder="195" value={wt} onChange={(e) => setWt(e.target.value)}
              onBlur={() => update((s) => { const v = parseFloat(wt); if (v > 50 && v < 600) s.settings.startWt = v; else delete s.settings.startWt; })} />
            <em>lb</em>
          </span>
        </label>
        <div className="setrow"><span>Storage<small>Saved on this phone, works offline. Export a backup now and then.</small></span><span className="dot on" /></div>
        <div className="setrow">
          <span>Backup<small>Move progress between devices</small></span>
          <span className="btnpair"><button className="chip" onClick={() => openSheet({ kind: "export" })}>Export</button><button className="chip" onClick={() => openSheet({ kind: "import" })}>Import</button></span>
        </div>
        <VersionRow />
      </section>
      <GearList />
      <div className="sechead"><h3 style={{ fontSize: 24 }}>How it works</h3></div>
      <section className="card group" style={{ marginTop: 10 }}>
        {HOWTO.map(([t, d]) => <details className="acc" key={t}><summary>{t}</summary><p>{d}</p></details>)}
      </section>
    </section>
  );
}
