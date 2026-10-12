import { useEffect, useState } from "react";
import { AccountSheetBody } from "../SyncSection";
import { AUTO_PAUSE_CHOICES, MILESTONE_CHOICES, WALK_MINUTES, addDays, isRaceGoal, isWalkGoal, birthdayInfo, changePlan, changeWeek, formatWhy, parseBirthday, tooSoon, whyList, type PlanProfile, type RaceGoal } from "../../training";
import { TooSoonNote } from "../TooSoonNote";
import { TapLogo } from "../Splash";
import { HealthSection } from "../HealthSection";
import { useApp } from "../app-state";
import { Icon } from "../icons";
import { LookControls, useLook } from "../LookControls";
import { DateWheels, fmtBirthday } from "../DateWheels";
import { BUILT_AT, applyUpdate, checkForUpdate, useUpdateReady, type CheckResult } from "../updates";
import { APP_VERSION, IS_NATIVE } from "../apk";
import { trackLogText } from "../trackLog";
import { autoPausePref, milestonePrefs, setAutoPause, setMilestonePrefs } from "../tracker";

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
const APK_READY = "New version ready. Tap Update, then Install.";

function VersionRow() {
  const [status, setStatus] = useState<"idle" | "checking" | CheckResult>("idle");
  const ready = useUpdateReady() || status === "ready";
  const built = BUILT_AT.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + BUILT_AT.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const note = ready ? (IS_NATIVE ? APK_READY : CHECK_TEXT.ready) : status === "checking" ? "Checking for updates" : status === "idle" ? (IS_NATIVE ? `Version ${APP_VERSION}` : `Built ${built}`) : CHECK_TEXT[status];
  return (
    <div className="setrow">
      <span>App version<small aria-live="polite">{note}</small></span>
      {ready ? (
        <button className="chip solid" onClick={() => applyUpdate()}>{IS_NATIVE ? "Update" : "Refresh"}</button>
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
  const { preset, shape, mode } = useLook();
  return (
    <div className="area-look">
      <div className="sechead"><h3 className="sectitle">Look</h3><span className="lbl">{mode === "light" ? "Light" : mode === "system" ? "Auto" : "Dark"}, {shape === "square" ? "Squared" : "Rounded"}, {preset.name}</span></div>
      <section className="card lookcard">
        <LookControls />
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
  const { state, update, now, openSheet } = useApp();
  const st = state.settings;
  const [name, setName] = useField(st.name || "");
  const [bday, setBday] = useField(st.birthday || "");
  const [bdayOpen, setBdayOpen] = useState(false);
  const whys = whyList(st);
  const [wt, setWt] = useField(st.startWt ? String(st.startWt) : "");
  const [goal, setGoal] = useField(st.goalWt ? String(st.goalWt) : "");
  const [stepGoal, setStepGoal] = useField(st.stepGoal ? String(st.stepGoal) : "");
  const [activeGoal, setActiveGoal] = useField(st.activeGoal ? String(st.activeGoal) : "");
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
        <div className={"setrow" + (bdayOpen ? " col" : "") + (b?.isToday ? " bdaytoday" : "")}>
          <span className="withicon">{b?.isToday && <Icon.cake />}<span>Birthday<small>{bdayNote}</small></span></span>
          {!bdayOpen
            ? <button className="chip" onClick={() => setBdayOpen(true)}>{st.birthday ? fmtBirthday(st.birthday) : "Add"}</button>
            : <>
              <DateWheels value={bday} onChange={setBday} />
              <span className="btnpair">
                <button className="chip" onClick={() => { update((s) => { if (parseBirthday(bday)) s.settings.birthday = bday; }); setBdayOpen(false); }}>Done</button>
                {st.birthday && <button className="chip" onClick={() => { update((s) => { delete s.settings.birthday; }); setBday(""); setBdayOpen(false); }}>Remove</button>}
              </span>
            </>}
        </div>
        <button className="setrow whybtn" onClick={() => openSheet({ kind: "why" })}>
          <span>Your why<small>{whys.length ? `${whys.length} ${whys.length === 1 ? "reason" : "reasons"}: ${whys.map(formatWhy).join(" ")}` : "What keeps you going"}</small></span>
          <span className="chip">{whys.length ? "Edit" : "Add"}</span>
        </button>
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
        <label className="setrow" htmlFor="stepGoal">
          <span>Daily step goal<small>Optional. The bell tells you when a day comes in under.</small></span>
          <span className="unitin">
            <input type="number" inputMode="numeric" id="stepGoal" min="1000" max="50000" step="500" placeholder="none" value={stepGoal} onChange={(e) => setStepGoal(e.target.value)}
              onBlur={() => update((s) => { const n = parseInt(stepGoal); if (n >= 1000 && n <= 50000) s.settings.stepGoal = n; else delete s.settings.stepGoal; })} />
            <em>steps</em>
          </span>
        </label>
        <label className="setrow" htmlFor="activeGoal">
          <span>Daily active minutes<small>Optional. Every workout you log counts toward it.</small></span>
          <span className="unitin">
            <input type="number" inputMode="numeric" id="activeGoal" min="5" max="300" step="5" placeholder="none" value={activeGoal} onChange={(e) => setActiveGoal(e.target.value)}
              onBlur={() => update((s) => { const n = parseInt(activeGoal); if (n >= 5 && n <= 300) s.settings.activeGoal = n; else delete s.settings.activeGoal; })} />
            <em>min</em>
          </span>
        </label>
      </section>
    </div>
  );
}

const PLAN_OPTIONS: ["walk" | "walkmore" | "fitness" | "race", string][] = [["walk", "Daily walk"], ["walkmore", "Walk more"], ["fitness", "Get fit"], ["race", "Race"]];
const RACE_OPTIONS: [RaceGoal, string][] = [["5k", "5K"], ["10k", "10K"], ["half", "Half"], ["full", "Marathon"]];
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={"switch" + (on ? " on" : "")} onClick={() => onChange(!on)}><span /></button>;
}

/**
 * Your plan: race, goal, training days, bike and knees. Edits wait for Save, then rebuild the plan
 * from this week (or next, if this week has logs). Earlier weeks keep their sessions.
 */
function YourPlan() {
  const { model, state, update, toast } = useApp();
  const saved = model.spec.profile;
  const [draft, setDraft] = useState<PlanProfile>(saved);
  useEffect(() => { setDraft(saved); }, [saved]);
  const set = (p: Partial<PlanProfile>) => setDraft((d) => ({ ...d, ...p }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const from = changeWeek(state, model.curWeek, model.rawWeek);
  const isRace = isRaceGoal(draft.goal), walking = isWalkGoal(draft.goal);
  const planKind = isRace ? "race" : (draft.goal as "walk" | "walkmore" | "fitness");
  const pickPlan = (k: (typeof PLAN_OPTIONS)[number][0]) => set(k === "race" ? { goal: isRace ? draft.goal : "5k" } : { goal: k, ...(k === "walk" || k === "walkmore" ? { walkMin: draft.walkMin ?? 20 } : {}) });
  const maxRace = ymd(addDays(model.spec.start, 52 * 7 - 1)), minRace = ymd(addDays(model.today, 7));
  const raceOk = !isRace || (!!draft.raceDate && draft.raceDate >= minRace && draft.raceDate <= maxRace);
  const daysOk = walking ? draft.days.length >= 1 : draft.days.length >= 3 && draft.days.length <= 6;
  const soon = dirty && raceOk ? tooSoon({ ...draft, startDate: saved.startDate }) : null;
  const toggleDay = (d: number) => setDraft((x) => ({ ...x, days: x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d].sort((a, b) => a - b) }));
  const strengthOn = state.settings.strength !== false;
  const save = () => {
    update((s) => { s.plan = changePlan(s, draft, from); });
    toast(from <= 1 ? "Plan updated" : `Plan updated from week ${from}`);
  };

  return (
    <div className="area-plan">
      <div className="sechead"><h3 className="sectitle">Your plan</h3><span className="lbl">{model.spec.weeks} weeks</span></div>
      <section className="card group planform">
        <div className="setrow col">
          <span>Plan<small>{walking ? "Walking only. No running, ever." : draft.goal === "fitness" ? "Biking and walking first, running eases in." : "Training for a race."}</small></span>
          <div className="seg goalseg" role="radiogroup" aria-label="Plan">
            {PLAN_OPTIONS.map(([k, l]) => <button key={k} role="radio" aria-checked={planKind === k} className={planKind === k ? "sel" : ""} onClick={() => pickPlan(k)}>{l}</button>)}
          </div>
          {isRace && <div className="seg goalseg" role="radiogroup" aria-label="Race">
            {RACE_OPTIONS.map(([g, l]) => <button key={g} role="radio" aria-checked={draft.goal === g} className={draft.goal === g ? "sel" : ""} onClick={() => set({ goal: g })}>{l}</button>)}
          </div>}
        </div>
        {walking && <div className="setrow col">
          <span>{draft.goal === "walk" ? "Walk length" : "Walks start at"}<small>{draft.goal === "walk" ? "The same walk every time." : "They grow a little each week."}</small></span>
          <div className="seg" role="radiogroup" aria-label="Walk length">
            {WALK_MINUTES.map((m) => <button key={m} role="radio" aria-checked={(draft.walkMin ?? 20) === m} className={(draft.walkMin ?? 20) === m ? "sel" : ""} onClick={() => set({ walkMin: m })}>{m} min</button>)}
          </div>
        </div>}
        {isRace && <>
          <label className="setrow" htmlFor="raceName">
            <span>Race name<small>Shows on your Plan</small></span>
            <input className="txtin" id="raceName" maxLength={40} placeholder="Your race" value={draft.raceName ?? ""} onChange={(e) => set({ raceName: e.target.value })} />
          </label>
          <label className="setrow" htmlFor="raceDate">
            <span>Race date<small>{raceOk ? "Within a year of your start" : "Pick a date at least a week out, within a year of your start"}</small></span>
            <input className="txtin" id="raceDate" type="date" min={minRace} max={maxRace} value={draft.raceDate ?? ""} onChange={(e) => set({ raceDate: e.target.value })} />
          </label>
        </>}
        <div className="setrow col">
          <span>{walking ? "Walk days" : "Training days"}<small>{!daysOk ? (walking ? "Pick at least one day." : "Pick 3 to 6.") : walking ? `${draft.days.length === 7 ? "Every day" : `${draft.days.length} ${draft.days.length === 1 ? "day" : "days"} a week`}.` : `${draft.days.length} days a week. Your longest session is on the last one.`}</small></span>
          <div className="daypick" role="group" aria-label="Training days">
            {DAY_LETTERS.map((l, d) => <button key={d} aria-pressed={draft.days.includes(d)} aria-label={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][d]} className={draft.days.includes(d) ? "on" : ""} onClick={() => toggleDay(d)}>{l}</button>)}
          </div>
        </div>
        {!walking && <>
          <div className="setrow">
            <span>I have a bike<small>Indoor or outdoor. Without one, rides become brisk walks.</small></span>
            <Switch on={draft.hasBike} label="I have a bike" onChange={(v) => set({ hasBike: v })} />
          </div>
          <div className="setrow">
            <span>Easy on the knees<small>Sore knees or joints: more time on the bike before running ramps up.</small></span>
            <Switch on={draft.impactSensitive} label="Easy on the knees" onChange={(v) => set({ impactSensitive: v })} />
          </div>
        </>}
        {soon && <TooSoonNote soon={soon} onDate={(v) => set({ raceDate: v })} onGoal={(g) => set({ goal: g })} />}
        {dirty && (
          <div className="plansave">
            <p>{from <= 1 ? "Your whole plan will be rebuilt." : `${from === 2 ? "Week 1 stays as it is" : `Weeks 1 to ${from - 1} stay as they are`}. Week ${from} on is rebuilt.`}</p>
            <div className="row2">
              <button className="btn solid" disabled={!raceOk || !daysOk} onClick={save}>{soon ? "Save anyway" : "Save changes"}</button>
              <button className="btn small" style={{ marginTop: 14 }} onClick={() => setDraft(saved)}>Cancel</button>
            </div>
          </div>
        )}
        <div className="setrow">
          <span>Strength workouts<small>{strengthOn ? "About 13 minutes on training days. Tracked on its own, never counted against your week." : "Off. Not scheduled and not shown."}</small></span>
          <Switch on={strengthOn} label="Strength workouts" onChange={(v) => update((s) => { if (v) delete s.settings.strength; else s.settings.strength = false; })} />
        </div>
      </section>
    </div>
  );
}

/** How tracked workouts behave: auto-pause and what gets said out loud. */
function Workouts() {
  const [ap, setAp] = useState(autoPausePref);
  const [say, setSay] = useState(milestonePrefs);
  const pick = (p: Parameters<typeof setMilestonePrefs>[0]) => { setMilestonePrefs(p); setSay(milestonePrefs()); };
  const row = <K extends keyof typeof MILESTONE_CHOICES>(k: K, label: string, note: string, text: (v: number) => string) => (
    <div className="setrow col">
      <span>{label}<small>{note}</small></span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {MILESTONE_CHOICES[k].map((v: number) => <button key={v} role="radio" aria-checked={say[k] === v} className={say[k] === v ? "sel" : ""} onClick={() => pick({ [k]: v })}>{text(v)}</button>)}
      </div>
    </div>
  );
  return (
    <div className="area-track" id="set-workouts">
      <div className="sechead"><h3 className="sectitle">Workouts</h3></div>
      <section className="card group">
        <div className="setrow col">
          <span>Auto-pause<small>{ap ? `Pauses after ${ap} seconds without moving, starts again when you move.` : "Off. Pause by hand."}</small></span>
          <div className="seg" role="radiogroup" aria-label="Auto-pause">
            {AUTO_PAUSE_CHOICES.map((v) => <button key={v} role="radio" aria-checked={ap === v} className={ap === v ? "sel" : ""} onClick={() => { setAutoPause(v); setAp(v); }}>{v ? `${v}s` : "Off"}</button>)}
          </div>
        </div>
        {row("mi", "Say distance", "Out loud, like \"2 miles\".", (v) => (v ? (v === 1 ? "Each mile" : "Each ½ mi") : "Off"))}
        {row("min", "Say time", "Like \"10 minutes\".", (v) => (v ? `${v} min` : "Off"))}
        {row("steps", "Say steps", "Like \"3,000 steps\". Not on a bike.", (v) => (v ? `${v / 1000}k` : "Off"))}
        {row("pause", "Say pauses", "\"Workout paused\" and \"Workout resumed\".", (v) => (v ? "On" : "Off"))}
      </section>
    </div>
  );
}

/** Copies the tracker's log (steps, checks, pauses and why), to send when a workout acts up. */
function TrackLogRow() {
  const { toast } = useApp();
  const copy = async () => {
    const text = trackLogText();
    if (!text) { toast("Nothing tracked yet."); return; }
    try { await navigator.clipboard.writeText(text); toast("Tracking log copied. Paste it in a message."); } catch { toast("Couldn't copy the log."); }
  };
  return (
    <div className="setrow">
      <span>Tracking log<small>What auto-pause saw on recent workouts. Copy it to send for help.</small></span>
      <button className="chip" onClick={copy}>Copy</button>
    </div>
  );
}

export function Settings() {
  const { openSheet } = useApp();
  return (
    <section className="view stack" aria-label="Settings">
      <div className="setgrid">
      <div className="area-sync">
      <div className="sechead"><h3 className="sectitle">Account</h3></div>
      <section className="card group"><AccountSheetBody /></section>
      </div>
      <HealthSection />
      <AboutYou />
      <YourPlan />
      <Workouts />
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
        <TrackLogRow />
        <VersionRow />
      </section>
      </div>
      </div>
      <section className="about">
        <TapLogo size={64} />
        <h3>Not a Runner</h3>
        <p>Train for a race even if you hate running.</p>
      </section>
    </section>
  );
}
