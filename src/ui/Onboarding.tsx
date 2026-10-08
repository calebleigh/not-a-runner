import { useState, type ReactNode } from "react";
import { DN, WHY_IDEAS, addDays, buildSpec, fmtLong, onboardingStart, parseBirthday, tooSoon, type PlanProfile, type RaceGoal, type StartLevel } from "../training";
import { TooSoonNote } from "./TooSoonNote";
import { useApp } from "./app-state";
import { Logo } from "./Logo";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const GOALS: [RaceGoal, string, string][] = [
  ["5k", "5K", "3.1 miles. A great first race."],
  ["10k", "10K", "6.2 miles."],
  ["half", "Half marathon", "13.1 miles."],
  ["full", "Marathon", "26.2 miles. Give yourself time."],
  ["fitness", "Just get fit", "No race. A year of steady progress."],
];
const LEVELS: [StartLevel, string, string][] = [
  ["cant_run_mile", "I can't run a mile yet", "We start with biking and walking."],
  ["run_1_mile", "I can run about a mile", "With walk breaks is fine."],
  ["run_3_miles", "I can run 3 miles", "Slowly counts."],
  ["run_6_plus", "I can run 6 miles or more", "You'll start further in."],
];
const GEAR_OPTIONS: [string, string][] = [
  ["shoes", "Running shoes"], ["mat", "Exercise mat"], ["bands", "Resistance bands"],
  ["kettlebell", "Kettlebell"], ["roller", "Foam roller"], ["fitband", "Heart rate band"],
];

interface Draft {
  goal: RaceGoal | null;
  raceName: string;
  raceDate: string;
  startLevel: StartLevel | null;
  days: number[];
  hasBike: boolean;
  impactSensitive: boolean;
  name: string;
  birthday: string;
  weight: string;
  goalWeight: string;
  whys: string[];
  whyText: string;
  gear: string[];
}

function Option({ on, title, sub, onClick }: { on: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button className={"onbopt" + (on ? " on" : "")} role="radio" aria-checked={on} onClick={onClick}>
      <b>{title}</b>{sub && <small>{sub}</small>}
    </button>
  );
}

function YesNo({ on, title, sub, onChange }: { on: boolean; title: string; sub: string; onChange: (v: boolean) => void }) {
  return (
    <div className="onbyn">
      <div><b>{title}</b><small>{sub}</small></div>
      <div className="seg">
        <button className={on ? "sel" : ""} aria-pressed={on} onClick={() => onChange(true)}>Yes</button>
        <button className={!on ? "sel" : ""} aria-pressed={!on} onClick={() => onChange(false)}>No</button>
      </div>
    </div>
  );
}

/** First-run setup for new users: a few questions, then the plan is built. */
export function Onboarding() {
  const { model, update, openSheet, setTab } = useApp();
  const start = onboardingStart(model.today);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({ goal: null, raceName: "", raceDate: "", startLevel: null, days: [0, 1, 2, 3, 4], hasBike: true, impactSensitive: false, name: "", birthday: "", weight: "", goalWeight: "", whys: [], whyText: "", gear: [] });
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const isRace = d.goal !== null && d.goal !== "fitness";
  const minRace = ymd(addDays(model.today, 14)), maxRace = ymd(addDays(start, 52 * 7 - 1));

  const profile: PlanProfile | null = d.goal && d.startLevel ? {
    goal: d.goal, raceName: isRace ? d.raceName.trim() || undefined : undefined, raceDate: isRace ? d.raceDate : undefined,
    startDate: ymd(start), startLevel: d.startLevel, days: d.days, hasBike: d.hasBike, impactSensitive: d.impactSensitive,
  } : null;
  const raceSpec = isRace && d.raceDate >= minRace && d.raceDate <= maxRace && d.goal && d.startLevel
    ? buildSpec({ goal: d.goal, raceDate: d.raceDate, startDate: ymd(start), startLevel: d.startLevel, days: d.days, hasBike: d.hasBike, impactSensitive: d.impactSensitive })
    : null;

  const soon = isRace && raceSpec ? tooSoon({ goal: d.goal!, raceDate: d.raceDate, startDate: ymd(start), startLevel: d.startLevel!, days: d.days, hasBike: d.hasBike, impactSensitive: d.impactSensitive }) : null;
  const steps = ["welcome", "goal", "level", ...(isRace ? ["race"] : []), "days", "body", "you", "weight", "why", "gear", "done"] as const;
  const at = steps[Math.min(step, steps.length - 1)];
  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = () => {
    if (!profile) return;
    update((s) => {
      s.plan = { profile };
      const n = d.name.trim(), w = parseFloat(d.weight), gw = parseFloat(d.goalWeight), whys = [...d.whys, d.whyText.trim()].filter(Boolean);
      if (n) s.settings.name = n;
      if (parseBirthday(d.birthday)) s.settings.birthday = d.birthday;
      if (w > 50 && w < 600) s.settings.startWt = Math.round(w * 10) / 10;
      if (gw > 50 && gw < 600) s.settings.goalWt = Math.round(gw * 10) / 10;
      if (whys.length) s.settings.whys = whys;
      for (const g of d.gear) s.gear[g] = 1;
    });
    setTab("home");
  };

  let title = "", sub: ReactNode = null, body: ReactNode = null, canNext = true, cta = "Next";
  switch (at) {
    case "welcome":
      return (
        <div className="onb welcome">
          <div className="onbhero">
            <Logo size={96} />
            <h1>Not a Runner</h1>
            <p>Train for a race even if you hate running. Bike, walk and lift your way there, then add running when your body is ready.</p>
          </div>
          <div className="onbcta">
            <button className="btn solid" onClick={next}>Get started</button>
            <button className="btn small" onClick={() => openSheet({ kind: "import" })}>I have a backup code</button>
          </div>
        </div>
      );
    case "goal":
      title = "What are you training for?";
      body = <div className="onbopts" role="radiogroup">{GOALS.map(([g, t, s]) => <Option key={g} on={d.goal === g} title={t} sub={s} onClick={() => set({ goal: g })} />)}</div>;
      canNext = !!d.goal;
      break;
    case "level":
      title = "Where are you starting?";
      sub = "Be honest. Starting easy is how you avoid getting hurt.";
      body = <div className="onbopts" role="radiogroup">{LEVELS.map(([l, t, s]) => <Option key={l} on={d.startLevel === l} title={t} sub={s} onClick={() => set({ startLevel: l })} />)}</div>;
      canNext = !!d.startLevel;
      break;
    case "race":
      title = "When is your race?";
      sub = "Pick a date between two weeks and a year from now.";
      body = <>
        <label className="onbfield">Race name (optional)<input className="xt" maxLength={40} placeholder="Spring 5K" value={d.raceName} onChange={(e) => set({ raceName: e.target.value })} /></label>
        <label className="onbfield">Race date<input className="xt" type="date" min={minRace} max={maxRace} value={d.raceDate} onChange={(e) => set({ raceDate: e.target.value })} /></label>
        {raceSpec && <p className="onbnote">That's a {raceSpec.weeks}-week plan, starting {fmtLong(start)}.</p>}
        {soon && <TooSoonNote soon={soon} onDate={(v) => set({ raceDate: v })} onGoal={(g) => set({ goal: g })} />}
      </>;
      // A recommendation, not a lock: people can still go ahead with a tight race date.
      canNext = !!raceSpec;
      if (soon) cta = "Continue anyway";
      break;
    case "days":
      title = "Which days can you train?";
      sub = "Pick 3 to 6. Your longest session lands on the last one, so a weekend day works well.";
      body = <div className="daypick big" role="group" aria-label="Training days">
        {DN.map((l, i) => <button key={i} aria-pressed={d.days.includes(i)} aria-label={DAY_NAMES[i]} className={d.days.includes(i) ? "on" : ""}
          onClick={() => setD((x) => ({ ...x, days: x.days.includes(i) ? x.days.filter((y) => y !== i) : [...x.days, i].sort((a, b) => a - b) }))}>{l}</button>)}
      </div>;
      canNext = d.days.length >= 3 && d.days.length <= 6;
      break;
    case "body":
      title = "A little about you";
      body = <>
        <YesNo on={d.hasBike} title="Do you have a bike?" sub="Indoor or outdoor. Without one, rides become brisk walks." onChange={(v) => set({ hasBike: v })} />
        <YesNo on={d.impactSensitive} title="Sore knees or joints?" sub="We'll spend longer on the bike and walking before running ramps up." onChange={(v) => set({ impactSensitive: v })} />
      </>;
      break;
    case "you":
      title = "What should we call you?";
      sub = "Both are optional. We'll have cake on your birthday.";
      body = <>
        <label className="onbfield">Name<input className="xt" maxLength={20} placeholder="Your name" value={d.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="onbfield">Birthday<input className="xt" type="date" max={ymd(model.today)} value={d.birthday} onChange={(e) => set({ birthday: e.target.value })} /></label>
      </>;
      break;
    case "weight":
      title = "Your weight";
      sub = "Both are optional. Weight is only used to estimate calories; the goal shows as a line on your weight chart.";
      body = <>
        <label className="onbfield">Weight now (lb)<input className="xt" type="number" inputMode="decimal" min="80" max="500" placeholder="195" value={d.weight} onChange={(e) => set({ weight: e.target.value })} /></label>
        <label className="onbfield">Goal weight (lb)<input className="xt" type="number" inputMode="decimal" min="80" max="500" placeholder="optional" value={d.goalWeight} onChange={(e) => set({ goalWeight: e.target.value })} /></label>
      </>;
      break;
    case "why":
      title = "Why are you doing this?";
      sub = "Pick as many as you like. It shows on Home on days without a tip, for the mornings you need it.";
      body = <>
        <div className="onbchips">{WHY_IDEAS.map((w) => <button key={w} aria-pressed={d.whys.includes(w)} className={d.whys.includes(w) ? "on" : ""}
          onClick={() => setD((x) => ({ ...x, whys: x.whys.includes(w) ? x.whys.filter((y) => y !== w) : [...x.whys, w] }))}>{w}</button>)}</div>
        <label className="onbfield">Anything else, in your own words<input className="xt" maxLength={80} placeholder="Finish a half before I turn 40" value={d.whyText} onChange={(e) => set({ whyText: e.target.value })} /></label>
      </>;
      cta = d.whys.length || d.whyText.trim() ? "Next" : "Skip";
      break;
    case "gear":
      title = "Got any of these?";
      sub = "Strength workouts upgrade to use what you have. Skip it if you have none.";
      body = <div className="onbchips">{GEAR_OPTIONS.map(([k, l]) => (
        <button key={k} aria-pressed={d.gear.includes(k)} className={d.gear.includes(k) ? "on" : ""} onClick={() => setD((x) => ({ ...x, gear: x.gear.includes(k) ? x.gear.filter((y) => y !== k) : [...x.gear, k] }))}>{l}</button>
      ))}</div>;
      cta = d.gear.length ? "Next" : "Skip";
      break;
    case "done": {
      const spec = profile ? buildSpec(profile) : null;
      title = "Your plan is ready";
      body = spec && <>
        <div className="onbsum">
          <div><b>{spec.weeks}</b><small>weeks</small></div>
          <div><b>{d.days.length}</b><small>days a week</small></div>
          <div><b>{isRace ? GOALS.find((g) => g[0] === d.goal)![1] : "Fitness"}</b><small>{spec.race ? fmtLong(spec.race) : "no race"}</small></div>
        </div>
        <p className="onbnote">Starts {fmtLong(spec.start)}. Training on {d.days.map((x) => DN[x]).join(", ")}.</p>
        <p className="onbdisclaimer">This app is a training guide, not medical advice. Check with a doctor before you start, especially if you have heart, joint or other health conditions. Stop and rest if something hurts.</p>
      </>;
      cta = "Build my plan";
      break;
    }
  }

  return (
    <div className="onb">
      <div className="onbtop">
        <button className="xbtn" aria-label="Back" onClick={back}>&#8249;</button>
        <div className="onbprog" aria-hidden="true"><i style={{ width: `${(100 * step) / (steps.length - 1)}%` }} /></div>
      </div>
      <div className="onbbody">
        <h1>{title}</h1>
        {sub && <p className="onbsub">{sub}</p>}
        {body}
      </div>
      <div className="onbcta">
        <button className="btn solid" disabled={!canNext} onClick={at === "done" ? finish : next}>{cta}</button>
      </div>
    </div>
  );
}
