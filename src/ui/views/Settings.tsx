import { useEffect, useState } from "react";
import { birthdayInfo, parseBirthday } from "../../training";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { Logo } from "../Logo";
import { DEFAULT_PRESET, PRESETS, presetFor, sameAccent, type Accent, type Preset, type Shape } from "../theme";
import { BUILT_AT, applyUpdate, checkForUpdate, useUpdateReady, type CheckResult } from "../updates";

const HOWTO: [string, string][] = [
  ["Every weekday", "Cardio and strength. The Home screen shows today's session; the Plan tab shows the whole year and your gear list. Weekends are rest or a make-up day."],
  ["Logging", "Tap the orange button. Enter miles, time, how it felt, and heart rate if you have the band. The plan adjusts itself from that."],
  ["Swapping", "Bike broken or knees sore? Swap any cardio to bike, walk or walk/run. The time adjusts so it's still a fair workout."],
  ["Steps", "Each evening, enter your full step total from Samsung Health. Steps are tracked on their own and never added to miles or calories."],
  ["Weigh-ins", "Mondays, first thing in the morning. Watch the trend line, not a single number."],
  ["Gear", "On the Plan tab. Check off gear as you get it and your strength exercises upgrade to use it."],
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
        <button className="chip solid" onClick={() => applyUpdate()}>Refresh</button>
      ) : (
        <button className="chip" disabled={status === "checking"} onClick={async () => { setStatus("checking"); setStatus(await checkForUpdate()); }}>
          {status === "checking" ? "Checking" : "Check"}
        </button>
      )}
    </div>
  );
}

/** Shape (rounded or squared, with the matching logo) and accent color. */
function LookPicker() {
  const { state, update } = useApp();
  const cur: Accent = state.settings.accent ?? DEFAULT_PRESET;
  const preset = presetFor(cur);
  const shape: Shape = state.settings.shape ?? "square";
  const setShape = (v: Shape) => update((s) => { if (v === "round") s.settings.shape = v; else delete s.settings.shape; });
  const setColor = (p: Preset) => update((s) => {
    if (sameAccent(p, DEFAULT_PRESET)) delete s.settings.accent;
    else s.settings.accent = { hi: p.hi, lo: p.lo };
  });

  return (
    <div className="area-look">
      <div className="sechead"><h3 className="sectitle">Look</h3><span className="lbl">{shape === "square" ? "Squared" : "Rounded"}, {(preset ?? DEFAULT_PRESET).name}</span></div>
      <section className="card lookcard">
        <div className="shapes" role="radiogroup" aria-label="Shape">
          {(["square", "round"] as Shape[]).map((v) => (
            <button key={v} role="radio" aria-checked={shape === v} className={"shapebtn " + v + (shape === v ? " sel" : "")} onClick={() => setShape(v)}>
              <span className="shapeprev" /><b>{v === "round" ? "Rounded" : "Squared"}</b>
            </button>
          ))}
        </div>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {PRESETS.map((p) => {
            const sel = (preset ?? DEFAULT_PRESET) === p;
            return (
              <button key={p.name} role="radio" aria-checked={sel} className={"swatch" + (sel ? " sel" : "")} onClick={() => setColor(p)}
                style={{ ["--a" as string]: p.hi, ["--b" as string]: p.lo }}>
                <span className="sw" /><small>{p.name}</small>
              </button>
            );
          })}
        </div>
        <p className="setnote">Changes the whole app, logo included. The home screen icon stays as it is.</p>
      </section>
    </div>
  );
}

/** Text field state that follows the saved value when it changes elsewhere (import, the other preview screen, sync). */
function useField(saved: string): [string, (v: string) => void] {
  const [v, setV] = useState(saved);
  useEffect(() => { setV(saved); }, [saved]);
  return [v, setV];
}

/** Name, birthday, your why, starting and goal weight. */
function AboutYou() {
  const { state, update, now } = useApp();
  const st = state.settings;
  const [name, setName] = useField(st.name || "");
  const [bday, setBday] = useField(st.birthday || "");
  const [why, setWhy] = useField(st.why || "");
  const [wt, setWt] = useField(st.startWt ? String(st.startWt) : "");
  const [goal, setGoal] = useField(st.goalWt ? String(st.goalWt) : "");
  const b = birthdayInfo(st.birthday, now);
  const bdayNote = !b ? "We'll have cake on the day" : b.isToday ? `Happy birthday! ${b.age} today` : `Turning ${b.turning} in ${b.daysUntil} day${b.daysUntil === 1 ? "" : "s"}`;
  const weight = (v: string, key: "startWt" | "goalWt") => update((s) => { const n = parseFloat(v); if (n > 50 && n < 600) s.settings[key] = n; else delete s.settings[key]; });
  return (
    <div className="area-you">
      <div className="sechead"><h3 className="sectitle">About you</h3>{b && <span className="lbl">{b.age} years</span>}</div>
      <section className="card group yougrid">
        <label className="setrow" htmlFor="pName">
          <span>Name<small>For your greeting</small></span>
          <input className="txtin" id="pName" maxLength={20} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => update((s) => { const v = name.trim(); if (v) s.settings.name = v; else delete s.settings.name; })} />
        </label>
        <label className={"setrow" + (b?.isToday ? " bdaytoday" : "")} htmlFor="pBday">
          <span className="withicon">{b?.isToday && <Icon.cake />}<span>Birthday<small>{bdayNote}</small></span></span>
          <input className="txtin" id="pBday" type="date" max={new Date().toISOString().slice(0, 10)} value={bday}
            onChange={(e) => setBday(e.target.value)}
            onBlur={() => update((s) => { if (parseBirthday(bday)) s.settings.birthday = bday; else delete s.settings.birthday; })} />
        </label>
        <label className="setrow wide" htmlFor="pWhy">
          <span>Your why<small>Shows on Home when there's no tip for the day</small></span>
          <input className="txtin whyin" id="pWhy" maxLength={80} placeholder="Finish a half before I turn 40" value={why} onChange={(e) => setWhy(e.target.value)}
            onBlur={() => update((s) => { const v = why.trim(); if (v) s.settings.why = v; else delete s.settings.why; })} />
        </label>
        <label className="setrow" htmlFor="startWt">
          <span>Starting weight<small>For calorie estimates</small></span>
          <span className="unitin">
            <input type="number" inputMode="decimal" id="startWt" min="80" max="500" placeholder="195" value={wt} onChange={(e) => setWt(e.target.value)} onBlur={() => weight(wt, "startWt")} />
            <em>lb</em>
          </span>
        </label>
        <label className="setrow" htmlFor="goalWt">
          <span>Goal weight<small>Optional, shown on your weight chart</small></span>
          <span className="unitin">
            <input type="number" inputMode="decimal" id="goalWt" min="80" max="500" placeholder="none" value={goal} onChange={(e) => setGoal(e.target.value)} onBlur={() => weight(goal, "goalWt")} />
            <em>lb</em>
          </span>
        </label>
      </section>
    </div>
  );
}

/** Plan options. Race name, date and training days join this section with the plan generator. */
function YourPlan() {
  const { state, update } = useApp();
  const on = state.settings.strength !== false;
  return (
    <div className="area-plan">
      <div className="sechead"><h3 className="sectitle">Your plan</h3></div>
      <section className="card group">
        <div className="setrow">
          <span>Strength workouts<small>{on ? "About 13 minutes on training days. Tracked on its own, never counted against your week." : "Off. Not scheduled and not shown."}</small></span>
          <button role="switch" aria-checked={on} aria-label="Strength workouts" className={"switch" + (on ? " on" : "")}
            onClick={() => update((s) => { if (on) s.settings.strength = false; else delete s.settings.strength; })}><span /></button>
        </div>
      </section>
    </div>
  );
}

export function Settings() {
  const { openSheet } = useApp();
  return (
    <section className="view stack" aria-label="Settings">
      <h1 className="pagetitle">Settings</h1>
      <div className="setgrid">
      <AboutYou />
      <YourPlan />
      <LookPicker />
      <div className="area-how">
      <div className="sechead"><h3 className="sectitle">How it works</h3></div>
      <section className="card group howlist">
        {HOWTO.map(([t, d]) => <details className="acc" key={t}><summary>{t}</summary><p>{d}</p></details>)}
      </section>
      </div>
      <div className="area-data">
      <div className="sechead"><h3 className="sectitle">App and data</h3></div>
      <section className="card group datagrid">
        <div className="setrow">
          <span>Backup<small>Saved on this phone. Export a copy now and then.</small></span>
          <span className="btnpair"><button className="chip" onClick={() => openSheet({ kind: "export" })}>Export</button><button className="chip" onClick={() => openSheet({ kind: "import" })}>Import</button></span>
        </div>
        <VersionRow />
      </section>
      </div>
      </div>
      <section className="about">
        <Logo size={64} />
        <h3>Not a Runner</h3>
        <p>Train for a race even if you hate running.</p>
      </section>
    </section>
  );
}
