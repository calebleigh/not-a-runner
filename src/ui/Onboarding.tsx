import { useState, type ReactNode } from "react";
import { DN, WALK_MINUTES, WHY_IDEAS as WANTS, addDays, buildSpec, fmtLong, isRaceGoal, isWalkGoal, onboardingStart, parseBirthday, tooSoon, type PlanProfile, type RaceGoal, type StartLevel } from "../training";
import { TooSoonNote } from "./TooSoonNote";
import { useApp } from "./app-state";
import { Welcome } from "./Landing";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// What people want (WANTS): pick any. They show on Home on days without a tip, and suggest a plan.
const RACE_WANTS = ["Run my first 5K", "Train for a race"];
const FIT_WANTS = ["Get back in shape", "Get stronger", "Lose weight", "Get better at sports"];

type PlanKind = "walk" | "walkmore" | "fitness" | "race";
const PLANS: [PlanKind, string, string][] = [
  ["walk", "Daily walk", "The same easy walk on the days you pick. No running, ever."],
  ["walkmore", "Walk more", "Walks that grow a little longer over the weeks. No running."],
  ["fitness", "Get fit", "Biking and walking first, with running easing in when you're ready."],
  ["race", "Train for a race", "A 5K up to a marathon, on a date you pick."],
];
const RACES: [RaceGoal, string, string][] = [
  ["5k", "5K", "3.1 miles. A great first race."],
  ["10k", "10K", "6.2 miles."],
  ["half", "Half marathon", "13.1 miles."],
  ["full", "Marathon", "26.2 miles. Give yourself time."],
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

/** The plan the wants point to; with nothing picked, the gentlest one. */
function suggest(wants: string[]): PlanKind {
  if (wants.some((w) => RACE_WANTS.includes(w))) return "race";
  if (wants.some((w) => FIT_WANTS.includes(w))) return "fitness";
  if (wants.some((w) => w === "Walk more" || w === "Walk the dog more")) return "walkmore";
  return "walk";
}

interface Draft {
  name: string;
  birthday: string;
  wants: string[];
  wantText: string;
  plan: PlanKind | null;
  race: RaceGoal | null;
  raceName: string;
  raceDate: string;
  startLevel: StartLevel | null;
  walkMin: number;
  days: number[] | null;
  hasBike: boolean;
  impactSensitive: boolean;
  strength: boolean | null;
  weight: string;
  goalWeight: string;
  gear: string[];
}

function Option({ on, title, sub, tag, onClick }: { on: boolean; title: string; sub?: string; tag?: string; onClick: () => void }) {
  return (
    <button className={"onbopt" + (on ? " on" : "")} role="radio" aria-checked={on} onClick={onClick}>
      <b>{title}{tag && <span className="onbtag">{tag}</span>}</b>{sub && <small>{sub}</small>}
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

function DayPick({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  return (
    <div className="daypick big" role="group" aria-label="Days">
      {DN.map((l, i) => <button key={i} aria-pressed={days.includes(i)} aria-label={DAY_NAMES[i]} className={days.includes(i) ? "on" : ""}
        onClick={() => onChange(days.includes(i) ? days.filter((y) => y !== i) : [...days, i].sort((a, b) => a - b))}>{l}</button>)}
    </div>
  );
}

/**
 * First-run setup: who you are, what you want, then a plan. Only the plan has to be picked, and
 * the gentlest one is suggested unless you ask for more. Everything can be changed in Settings.
 */
export function Onboarding() {
  const { model, update, setTab } = useApp();
  const start = onboardingStart(model.today);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({
    name: "", birthday: "", wants: [], wantText: "", plan: null, race: null, raceName: "", raceDate: "", startLevel: null,
    walkMin: 20, days: null, hasBike: true, impactSensitive: false, strength: null, weight: "", goalWeight: "", gear: [],
  });
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const plan = d.plan ?? suggest(d.wants);
  const walking = plan === "walk" || plan === "walkmore";
  const goal: RaceGoal | null = plan === "race" ? d.race : plan;
  // Defaults that fit the plan: walks every day, training on weekdays; strength on unless you only walk.
  const days = d.days ?? (plan === "walk" ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4]);
  const strengthOn = d.strength ?? !walking;
  const daysOk = walking ? days.length >= 1 : days.length >= 3 && days.length <= 6;
  const minRace = ymd(addDays(model.today, 14)), maxRace = ymd(addDays(start, 52 * 7 - 1));
  const level: StartLevel = walking ? "cant_run_mile" : d.startLevel ?? "cant_run_mile";

  const profile: PlanProfile | null = goal ? {
    goal, raceName: isRaceGoal(goal) ? d.raceName.trim() || undefined : undefined, raceDate: isRaceGoal(goal) ? d.raceDate : undefined,
    startDate: ymd(start), startLevel: level, days, hasBike: walking ? false : d.hasBike, impactSensitive: walking ? false : d.impactSensitive,
    ...(isWalkGoal(goal) ? { walkMin: d.walkMin } : {}),
  } : null;
  const raceOk = !!goal && isRaceGoal(goal) && d.raceDate >= minRace && d.raceDate <= maxRace;
  const raceSpec = raceOk && profile ? buildSpec(profile) : null;
  const soon = raceOk && profile ? tooSoon(profile) : null;

  const steps = [
    "welcome", "you", "wants", "plan",
    ...(walking ? ["walk"] : plan === "race" ? ["race", "level", "date", "days", "body"] : ["level", "days", "body"]),
    ...(walking ? ["strength"] : []), "extras", "done",
  ] as const;
  const at = steps[Math.min(step, steps.length - 1)];
  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = () => {
    if (!profile) return;
    update((s) => {
      s.plan = { profile };
      const n = d.name.trim(), w = parseFloat(d.weight), gw = parseFloat(d.goalWeight), whys = [...d.wants, d.wantText.trim()].filter(Boolean);
      if (n) s.settings.name = n;
      if (parseBirthday(d.birthday)) s.settings.birthday = d.birthday;
      if (w > 50 && w < 600) s.settings.startWt = Math.round(w * 10) / 10;
      if (gw > 50 && gw < 600) s.settings.goalWt = Math.round(gw * 10) / 10;
      if (whys.length) s.settings.whys = whys;
      if (!strengthOn) s.settings.strength = false;
      for (const g of d.gear) s.gear[g] = 1;
    });
    setTab("home");
  };

  let title = "", sub: ReactNode = null, body: ReactNode = null, canNext = true, cta = "Next";
  switch (at) {
    case "welcome":
      return <Welcome onStart={next} />;
    case "you":
      title = "What should we call you?";
      sub = "Both are optional. We'll have cake on your birthday.";
      body = <>
        <label className="onbfield">Name<input className="xt" maxLength={20} placeholder="Your name" value={d.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="onbfield">Birthday<input className="xt" type="date" max={ymd(model.today)} value={d.birthday} onChange={(e) => set({ birthday: e.target.value })} /></label>
      </>;
      cta = d.name.trim() || d.birthday ? "Next" : "Skip";
      break;
    case "wants":
      title = "What do you want out of this?";
      sub = "Pick any that fit, or none. No pressure. They show on Home for the days you need a nudge.";
      body = <>
        <div className="onbchips">{WANTS.map((w) => <button key={w} aria-pressed={d.wants.includes(w)} className={d.wants.includes(w) ? "on" : ""}
          onClick={() => setD((x) => ({ ...x, wants: x.wants.includes(w) ? x.wants.filter((y) => y !== w) : [...x.wants, w] }))}>{w}</button>)}</div>
        <label className="onbfield">Something else, in your own words<input className="xt" maxLength={80} placeholder="Walk to the park with my grandson" value={d.wantText} onChange={(e) => set({ wantText: e.target.value })} /></label>
      </>;
      cta = d.wants.length || d.wantText.trim() ? "Next" : "Skip";
      break;
    case "plan": {
      const rec = suggest(d.wants);
      title = "Pick a plan";
      sub = "You can switch anytime in Settings.";
      body = <div className="onbopts" role="radiogroup">{PLANS.map(([k, t, s]) => <Option key={k} on={plan === k} title={t} sub={s} tag={k === rec ? "Suggested" : undefined} onClick={() => set({ plan: k, days: null, strength: null })} />)}</div>;
      break;
    }
    case "walk":
      title = plan === "walk" ? "Your walk" : "Where to start";
      sub = plan === "walk" ? "How long, and which days. Same walk each time." : "How long your walks start. They grow a little each week, with an easier week now and then.";
      body = <>
        <div className="seg onbseg" role="radiogroup" aria-label="Walk length">
          {WALK_MINUTES.map((m) => <button key={m} role="radio" aria-checked={d.walkMin === m} className={d.walkMin === m ? "sel" : ""} onClick={() => set({ walkMin: m })}>{m} min</button>)}
        </div>
        <DayPick days={days} onChange={(x) => set({ days: x })} />
        <p className="onbnote">{days.length === 7 ? "Every day." : days.length ? `${days.length} ${days.length === 1 ? "day" : "days"} a week.` : "Pick at least one day."}{plan === "walkmore" && days.length > 1 ? " The last one is a longer walk." : ""}</p>
      </>;
      canNext = daysOk;
      break;
    case "strength":
      title = "Add a little strength?";
      sub = "About 10 minutes of easy bodyweight moves on walk days, no gym. Good for knees, back and balance.";
      body = <YesNo on={strengthOn} title="Strength workouts" sub="You can turn this on or off in Settings." onChange={(v) => set({ strength: v })} />;
      break;
    case "race":
      title = "Which race?";
      body = <div className="onbopts" role="radiogroup">{RACES.map(([g, t, s]) => <Option key={g} on={d.race === g} title={t} sub={s} onClick={() => set({ race: g })} />)}</div>;
      canNext = !!d.race;
      break;
    case "level":
      title = "Where are you starting?";
      sub = "Be honest. Starting easy is how you avoid getting hurt.";
      body = <div className="onbopts" role="radiogroup">{LEVELS.map(([l, t, s]) => <Option key={l} on={d.startLevel === l} title={t} sub={s} onClick={() => set({ startLevel: l })} />)}</div>;
      canNext = !!d.startLevel;
      break;
    case "date":
      title = "When is your race?";
      sub = "Pick a date between two weeks and a year from now.";
      body = <>
        <label className="onbfield">Race name (optional)<input className="xt" maxLength={40} placeholder="Spring 5K" value={d.raceName} onChange={(e) => set({ raceName: e.target.value })} /></label>
        <label className="onbfield">Race date<input className="xt" type="date" min={minRace} max={maxRace} value={d.raceDate} onChange={(e) => set({ raceDate: e.target.value })} /></label>
        {raceSpec && <p className="onbnote">That's a {raceSpec.weeks}-week plan, starting {fmtLong(start)}.</p>}
        {soon && <TooSoonNote soon={soon} onDate={(v) => set({ raceDate: v })} onGoal={(g) => set({ race: g })} />}
      </>;
      // A recommendation, not a lock: people can still go ahead with a tight race date.
      canNext = !!raceSpec;
      if (soon) cta = "Continue anyway";
      break;
    case "days":
      title = "Which days can you train?";
      sub = "Pick 3 to 6. Your longest session lands on the last one, so a weekend day works well.";
      body = <DayPick days={days} onChange={(x) => set({ days: x })} />;
      canNext = daysOk;
      break;
    case "body":
      title = "A little about you";
      body = <>
        <YesNo on={d.hasBike} title="Do you have a bike?" sub="Indoor or outdoor. Without one, rides become brisk walks." onChange={(v) => set({ hasBike: v })} />
        <YesNo on={d.impactSensitive} title="Sore knees or joints?" sub="We'll spend longer on the bike and walking before running ramps up." onChange={(v) => set({ impactSensitive: v })} />
        <YesNo on={strengthOn} title="Strength workouts?" sub="About 13 minutes of bodyweight moves on training days, no gym." onChange={(v) => set({ strength: v })} />
      </>;
      break;
    case "extras":
      title = "A few extras";
      sub = "All optional. Skip this if you like; it's all in Settings later.";
      body = <>
        <div className="onbrow">
          <label className="onbfield">Weight (lb)<input className="xt" type="number" inputMode="decimal" min="50" max="600" placeholder="optional" value={d.weight} onChange={(e) => set({ weight: e.target.value })} /></label>
          <label className="onbfield">Goal weight (lb)<input className="xt" type="number" inputMode="decimal" min="50" max="600" placeholder="optional" value={d.goalWeight} onChange={(e) => set({ goalWeight: e.target.value })} /></label>
        </div>
        <p className="onbnote">Weight only estimates calories; a goal shows as a line on your chart.</p>
        {strengthOn && <>
          <span className="onbfield">Got any of these? Strength moves upgrade to use them.</span>
          <div className="onbchips">{GEAR_OPTIONS.map(([k, l]) => (
            <button key={k} aria-pressed={d.gear.includes(k)} className={d.gear.includes(k) ? "on" : ""} onClick={() => setD((x) => ({ ...x, gear: x.gear.includes(k) ? x.gear.filter((y) => y !== k) : [...x.gear, k] }))}>{l}</button>
          ))}</div>
        </>}
      </>;
      cta = d.weight || d.goalWeight || d.gear.length ? "Next" : "Skip";
      break;
    case "done": {
      const spec = profile ? buildSpec(profile) : null;
      const what = walking ? PLANS.find((p) => p[0] === plan)![1] : goal && isRaceGoal(goal) ? RACES.find((g) => g[0] === goal)![1] : "Get fit";
      title = d.name.trim() ? `You're all set, ${d.name.trim()}` : "You're all set";
      body = spec && <>
        <div className="onbsum">
          <div><b>{what}</b><small>{spec.race ? fmtLong(spec.race) : walking ? "no running" : "no race"}</small></div>
          {walking ? <div><b>{d.walkMin}</b><small>{plan === "walk" ? "minute walks" : "minutes to start"}</small></div> : <div><b>{spec.weeks}</b><small>weeks</small></div>}
          <div><b>{days.length}</b><small>{days.length === 1 ? "day a week" : "days a week"}</small></div>
        </div>
        <p className="onbnote">Starts {fmtLong(spec.start)}. {days.length === 7 ? "Every day" : `On ${days.map((x) => DN[x]).join(", ")}`}{strengthOn ? ", with a little strength." : "."}</p>
        <p className="onbdisclaimer">This app is a training guide, not medical advice. Check with a doctor before you start, especially if you have heart, joint or other health conditions. Stop and rest if something hurts.</p>
      </>;
      cta = "Let's go";
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
