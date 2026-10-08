import { useEffect, useRef, useState } from "react";
import { useApp } from "../app-state";
import { Logo } from "../Logo";
import { DEFAULT_PRESET, PRESETS, applyAccent, presetFor, sameAccent, type Accent } from "../theme";
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
        <button className="chip solid" onClick={applyUpdate}>Refresh</button>
      ) : (
        <button className="chip" disabled={status === "checking"} onClick={async () => { setStatus("checking"); setStatus(await checkForUpdate()); }}>
          {status === "checking" ? "Checking" : "Check"}
        </button>
      )}
    </div>
  );
}

/** Accent gradient: presets, or a custom light and dark end. Recolors the whole app. */
function ColorPicker() {
  const { state, update } = useApp();
  const cur: Accent = state.settings.accent ?? DEFAULT_PRESET;
  const preset = presetFor(cur);
  const [custom, setCustom] = useState<Accent>({ hi: cur.hi, lo: cur.lo });
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { setCustom({ hi: cur.hi, lo: cur.lo }); }, [cur.hi, cur.lo]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (a: Accent) => update((s) => {
    if (sameAccent(a, DEFAULT_PRESET)) delete s.settings.accent;
    else s.settings.accent = { hi: a.hi.toUpperCase(), lo: a.lo.toUpperCase() };
  });
  // Dragging a color picker fires constantly: recolor live, save once it settles.
  const pickCustom = (a: Accent) => {
    setCustom(a);
    applyAccent(a);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(a), 400);
  };

  return (
    <div className="area-look">
      <div className="sechead"><h3 className="sectitle">Color</h3><span className="lbl">{preset ? preset.name : "Custom"}</span></div>
      <section className="card lookcard">
        <div className="swatches" role="radiogroup" aria-label="Accent gradient">
          {PRESETS.map((p) => {
            const sel = preset === p;
            return (
              <button key={p.name} role="radio" aria-checked={sel} className={"swatch" + (sel ? " sel" : "")} onClick={() => save(p)}
                style={{ ["--a" as string]: p.hi, ["--b" as string]: p.lo }}>
                <span className="sw" /><small>{p.name}</small>
              </button>
            );
          })}
        </div>
        <div className="custom">
          <span className="cprev" style={{ background: `linear-gradient(135deg, ${custom.hi}, ${custom.lo})` }} />
          <span className="lbl">Custom</span>
          <label className="cpick"><input type="color" value={custom.hi.toLowerCase()} onChange={(e) => pickCustom({ ...custom, hi: e.target.value })} /><small>Light</small></label>
          <label className="cpick"><input type="color" value={custom.lo.toLowerCase()} onChange={(e) => pickCustom({ ...custom, lo: e.target.value })} /><small>Dark</small></label>
        </div>
        <p className="setnote">Recolors the whole app, logo included. The home screen icon stays orange.</p>
      </section>
    </div>
  );
}

export function Settings() {
  const { state, update, openSheet } = useApp();
  const [name, setName] = useState(state.settings.name || "");
  const [wt, setWt] = useState(state.settings.startWt ? String(state.settings.startWt) : "");
  return (
    <section className="view stack" aria-label="Settings">
      <h1 className="pagetitle">Settings</h1>
      <div className="setgrid">
      <div className="area-you">
      <div className="sechead"><h3 className="sectitle">About you</h3></div>
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
      </section>
      </div>
      <div className="area-data">
      <div className="sechead"><h3 className="sectitle">App and data</h3></div>
      <section className="card group">
        <div className="setrow">
          <span>Backup<small>Saved on this phone. Export a copy now and then.</small></span>
          <span className="btnpair"><button className="chip" onClick={() => openSheet({ kind: "export" })}>Export</button><button className="chip" onClick={() => openSheet({ kind: "import" })}>Import</button></span>
        </div>
        <VersionRow />
      </section>
      </div>
      <ColorPicker />
      <div className="area-how">
      <div className="sechead"><h3 className="sectitle">How it works</h3></div>
      <section className="card group howlist">
        {HOWTO.map(([t, d]) => <details className="acc" key={t}><summary>{t}</summary><p>{d}</p></details>)}
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
