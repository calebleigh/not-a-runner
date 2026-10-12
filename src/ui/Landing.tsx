import { useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleButton, useSync } from "./SyncSection";
import { IS_NATIVE, RELEASES_URL } from "./apk";
import { useApp } from "./app-state";
import { Icon, StreakFlame } from "./icons";
import { Logo } from "./Logo";
import { Num, reducedMotion } from "./motion";
import { LogoBurst, SPLASH_MS } from "./Splash";

const MODES = ["Bike", "Walk", "Lift", "Walk/run", "Hike", "Run", "Rest"];

/** The headline's second line, one at a time: things people want, said kindly. */
const DREAMS = [
  "Train for a race anyway.",
  "Walk your way to fitness.",
  "Keep up with your kids.",
  "Build habits that stick.",
  "Lose weight one walk at a time.",
  "Feel better every day.",
  "Spend more time outside.",
  "Move more, your way.",
];
const DREAM_MS = 2800;

/** Cycles the headline's second line once the intro has played (holds still with reduced motion). */
function Dreams({ go }: { go: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!go || reducedMotion()) return;
    let t: number | undefined;
    const start = window.setTimeout(() => { t = window.setInterval(() => setI((x) => (x + 1) % DREAMS.length), DREAM_MS); }, 1200);
    return () => { clearTimeout(start); clearInterval(t); };
  }, [go]);
  // All lines share one spot, so the headline is always as tall as the longest and never jumps.
  return (
    <span className="acc lrot">
      {DREAMS.map((d, j) => <span key={d} className={j === i ? "on" : ""} aria-hidden={j !== i}>{d}</span>)}
    </span>
  );
}

const FEATURES: { icon: () => React.JSX.Element; title: string; text: string }[] = [
  { icon: Icon.shoe, title: "Walking counts", text: "A plan can be just walking, every day or a few days a week. No running, ever, unless you want it." },
  { icon: Icon.bike, title: "Biking counts", text: "Any cardio day can be a ride, a walk or a walk/run. The time adjusts so it's still a fair workout." },
  { icon: Icon.dumbbell, title: "Strength at home", text: "Short bodyweight sessions, no gym. Own bands or a kettlebell? The exercises level up." },
  { icon: Icon.bolt, title: "It adapts", text: "Sore knees or a missed week? Say how sessions felt and the plan adjusts." },
  { icon: Icon.pin, title: "Track it live", text: "GPS draws your route as you go, or count steps on a treadmill. Voice updates with the screen off." },
  { icon: Icon.steps, title: "Steps count too", text: "Set a step goal. Extra walks and hikes add to your totals without wrecking the plan." },
];

/** The plans, and how each one works (tap a pill to read it). */
const PLANS: [string, string][] = [
  ["Daily walk", "The same easy walk on the days you pick, 10 to 45 minutes. No running, ever. It's about the habit, not the miles."],
  ["Walk more", "Walks start where you're comfortable and grow a little each week, up to about an hour. One longer walk a week, an easier week every fourth. No running."],
  ["Get fit", "A year of steady progress. Biking and brisk walks first, then short jogs with walk breaks once your body is ready. No race needed."],
  ["5K", "3.1 miles. Biking and walking first, then jogs with walk breaks that build to race day. About 4 to 10 weeks, depending on where you start."],
  ["10K", "6.2 miles. The same gentle start, with longer walk/runs and an easier week now and then. About 8 to 16 weeks."],
  ["Half marathon", "13.1 miles. Long walk/runs build slowly, with cutback weeks and a taper before race day. About 3 to 7 months; up to a year if you're starting from the couch."],
  ["Marathon", "26.2 miles. The long game: a steady build over 5 months to a year, with walk breaks welcome the whole way."],
];

/** The plan pills; the picked one says how it works. */
function PlanPicker() {
  const [at, setAt] = useState(0);
  return <>
    <div className="lgoals" role="tablist" aria-label="Plans">
      {PLANS.map(([g], i) => <button key={g} role="tab" aria-selected={i === at} className={i === at ? "on" : ""} onClick={() => setAt(i)}>{g}</button>)}
    </div>
    <p className="lplan" role="tabpanel" aria-live="polite">{PLANS[at][1]}</p>
  </>;
}

/** Made-up friends for the social section. */
const FRIENDS: { name: string; today: string; done: boolean; streak: number; flames: number }[] = [
  { name: "Mom", today: "Walk 30 min, done", done: true, streak: 41, flames: 3 },
  { name: "Jake", today: "Bike 25 min to go", done: false, streak: 12, flames: 2 },
  { name: "Grandpa", today: "Walk 20 min, done", done: true, streak: 87, flames: 3 },
];

/**
 * Get the app: the Android download (the latest GitHub release, until it's on Google Play) and
 * iPhone, coming soon. Plain buttons, not store badges, since neither store has it yet.
 */
function StoreLinks() {
  return (
    <div className="lstores">
      <a className="lstore" href={`${RELEASES_URL}/latest`} target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-5-5m5 5l5-5M5 20h14" /></svg>
        <span><small>Download for</small><b>Android</b></span>
      </a>
      <span className="lstore soon" aria-disabled="true">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>
        <span><small>Coming soon</small><b>iPhone</b></span>
      </span>
    </div>
  );
}

/** The website's top bar: see-through over the hero, solid once you scroll. */
function LandHeader({ onStart, signedIn }: { onStart: () => void; signedIn: boolean }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  };
  return (
    <nav className={"lnav" + (solid ? " solid" : "")} aria-label="Site">
      <a className="lnav-brand" href="#top" onClick={jump("top")}><Logo size={28} /><b>Not a Runner</b></a>
      <span className="lnav-links">
        <a href="#how" onClick={jump("how")}>How it works</a>
        <a href="#friends" onClick={jump("friends")}>Friends</a>
        <a href="#plans" onClick={jump("plans")}>Plans</a>
      </span>
      <button className="btn solid small lnav-go" onClick={onStart}>{signedIn ? "Build my plan" : "Get started"}</button>
    </nav>
  );
}

/** Wait for the launch splash to clear before playing an entrance. */
function useAfterSplash(): boolean {
  const [go, setGo] = useState(SPLASH_MS === 0);
  useEffect(() => {
    if (go) return;
    const t = setTimeout(() => setGo(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, [go]);
  return go;
}

/** Fades its content up the first time it scrolls into view. */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode | ((on: boolean) => ReactNode); className?: string; delay?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(() => reducedMotion() || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (on || !el.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el.current);
    return () => io.disconnect();
  }, [on]);
  return (
    <div ref={el} className={"rv " + (on ? "in " : "") + className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {typeof children === "function" ? children(on) : children}
    </div>
  );
}

function Stat({ value, unit, label }: { value: number; unit?: string; label: string }) {
  return (
    <Reveal className="lstat">
      {(on) => <>
        <b className="num">{on ? <Num value={value} /> : 0}{unit && <em>{unit}</em>}</b>
        <small>{label}</small>
      </>}
    </Reveal>
  );
}

/** What someone without an account sees first: what the app is, then a way in. */
export function Landing({ onStart, heroOnly = false }: { onStart: () => void; heroOnly?: boolean }) {
  const { openSheet } = useApp();
  const sync = useSync();
  const go = useAfterSplash();
  const signedIn = !!sync.account;

  const ctas = (
    <div className="lcta">
      <button className="btn solid" onClick={onStart}>{signedIn ? "Build my plan" : "Get started"}</button>
      {signedIn
        ? <p className="lnote">Signed in{sync.account?.email ? ` as ${sync.account.email}` : ""}. No plan yet, so let's make one.</p>
        : <GoogleButton label="Sign in with Google" busy={sync.phase === "starting"} />}
      {sync.error && <p className="syncerr" role="alert">{sync.error}</p>}
    </div>
  );

  return (
    <div className="land" id="top">
      {!heroOnly && <LandHeader onStart={onStart} signedIn={signedIn} />}
      <header className={"lhero" + (go ? " go" : "")}>
        <svg className="lroute" viewBox="0 0 400 220" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="1" d="M-10 190 C 60 150, 90 200, 150 160 S 240 60, 300 100 S 380 40, 410 20" />
        </svg>
        <div className="lhero-in">
          <div className="lmark">{go ? <LogoBurst /> : <span className="lmark-hold"><Logo size={120} /></span>}</div>
          <p className="lbl lkick">For people who don't love running</p>
          <h1 className="lh1"><span>Hate running?</span> <Dreams go={go} /></h1>
          <p className="lsub">Walk, bike and lift your way to a 5K, a habit that sticks, or just feeling better. Running only if you want it, when your body is ready.</p>
          {ctas}
          {!heroOnly && <StoreLinks />}
          <button className="btn small lback" onClick={() => openSheet({ kind: "import" })}>I have a backup code</button>
          {heroOnly && <p className="ldisc lhero-disc">Not medical advice. Check with your doctor before starting a new exercise program.</p>}
        </div>
      </header>

      {!heroOnly && <>
      <div className="lticker" aria-hidden="true">
        <div className="lticker-in">
          {/* Two identical halves, each wide enough to cover a big desktop screen, so the loop never shows an end. */}
          {[0, 1].map((k) => <span key={k}>{[0, 1, 2].flatMap((r) => MODES.map((m) => <i key={r + m}>{m}</i>))}</span>)}
        </div>
      </div>

      <section className="lsec lstats">
        <Stat value={7} label="Plans, from walking to a marathon" />
        <Stat value={1} label="Clear thing to do each day" />
        <Stat value={0} label="Gym needed" />
      </section>

      <section className="lsec" id="how">
        <Reveal><h2 className="lh2">Running is optional.</h2><p className="llead">Walk, ride, lift or work up to a race. It all counts, and the plan meets you where you are.</p></Reveal>
        <div className="lfeat">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} className="lcard" delay={(i % 3) * 80}>
              <span className="lic"><f.icon /></span>
              <b>{f.title}</b>
              <p>{f.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="lsec">
        <Reveal><h2 className="lh2">One clear thing to do today.</h2><p className="llead">No wall of text. Open the app, see today, go.</p></Reveal>
        <div className="ltoday">
          <Reveal className="lmock">
            <div className="hero">
              <span className="lbl">Today</span>
              <span className="ht">Walk <span className="nw">20<small>min</small></span></span>
              <span className="lmock-sub">Easy pace. You can talk the whole time.</span>
            </div>
          </Reveal>
          <ol className="lsteps">
            {[["Say what you want", "Walk more, feel better, keep up with the kids, or a race."], ["Pick a plan", "A daily walk up to a marathon. Switch anytime."], ["Do today's thing", "Log how it felt. The plan handles the rest."]].map(([t, s], i) => (
              <Reveal key={t} delay={i * 90}>
                <li><span className="num">{i + 1}</span><div><b>{t}</b><small>{s}</small></div></li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="lsec" id="friends">
        <Reveal><h2 className="lh2">Better together.</h2><p className="llead">Bring your family and friends. See each other's streaks and whether today's done, then send a poke. Nicely, mostly.</p></Reveal>
        <Reveal className="lsocial">
          <div className="lfriends">
            <div className="lfr-head"><b>Friends</b><span className="lbl">Today</span></div>
            {FRIENDS.map((f) => (
              <div key={f.name} className="lfr">
                <span className="avatar" style={{ width: 40, height: 40 }}>{f.name[0]}</span>
                <span className="rtx"><b>{f.name}</b><small className={f.done ? "ok" : ""}>{f.today}</small></span>
                <span className="lfr-streak"><StreakFlame level={f.flames} /><b>{f.streak}</b></span>
                {!f.done && <span className="chip lfr-poke">Poke</span>}
              </div>
            ))}
          </div>
          <ul className="lperks">
            <li><span className="lic"><StreakFlame level={3} /></span><div><b>Day streaks</b><small>Kept by any workout or your step goal. Miss a day and the flame burns down, not out.</small></div></li>
            <li><span className="lic"><Icon.friends /></span><div><b>Pokes</b><small>A nudge when someone's day is still open. Or a high five when it's done.</small></div></li>
            <li><span className="lic"><Icon.cloud /></span><div><b>Private</b><small>Friends see your first name, streak and today. Never your weight or logs.</small></div></li>
          </ul>
        </Reveal>
      </section>

      <section className="lsec" id="plans">
        <Reveal><h2 className="lh2">Pick your pace.</h2><p className="llead">Every plan starts gentle. Change it whenever you like.</p></Reveal>
        <Reveal><PlanPicker /></Reveal>
      </section>

      <section className="lsec lend">
        <Reveal>
          <h2 className="lh2">Ready when you are.</h2>
          <p className="lsub">Free. No account needed. Use it right here, or get the app.</p>
          {ctas}
          <StoreLinks />
        </Reveal>
        <p className="ldisc">Not medical advice. Check with your doctor before starting a new exercise program.</p>
        <a className="lpriv" href="/privacypolicy.html" onClick={(e) => { e.preventDefault(); openSheet({ kind: "privacy" }); }}>Privacy policy</a>
      </section>
      </>}
    </div>
  );
}

/** First screen for someone with no data: the full landing page on the website, just the hero in the app. */
export function Welcome({ onStart }: { onStart: () => void }) {
  return <Landing onStart={onStart} heroOnly={IS_NATIVE} />;
}
