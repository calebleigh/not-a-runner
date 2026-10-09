import { useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleButton, useSync } from "./SyncSection";
import { IS_NATIVE } from "./apk";
import { useApp } from "./app-state";
import { Icon } from "./icons";
import { Logo } from "./Logo";
import { Num, reducedMotion } from "./motion";
import { LogoBurst, SPLASH_MS } from "./Splash";

const MODES = ["Bike", "Walk", "Lift", "Walk/run", "Hike", "Run", "Rest"];

const FEATURES: { icon: () => React.JSX.Element; title: string; text: string }[] = [
  { icon: Icon.bike, title: "Biking counts", text: "Any cardio day can be a ride, a walk or a walk/run. The time adjusts so it's still a fair workout." },
  { icon: Icon.dumbbell, title: "Strength at home", text: "Short bodyweight sessions, no gym. Own bands or a kettlebell? The exercises level up." },
  { icon: Icon.bolt, title: "It adapts", text: "Sore knees or a missed week? Say how sessions felt and the plan adjusts." },
  { icon: Icon.shoe, title: "Track outside", text: "GPS draws your route live as you walk or ride. Voice cues for intervals." },
  { icon: Icon.steps, title: "Steps count too", text: "Extra walks, hikes and steps add to your totals without wrecking the plan." },
  { icon: Icon.cloud, title: "Your data", text: "Works offline. Export any time. Sign in only if you want sync." },
];

const GOALS = ["5K", "10K", "Half marathon", "Marathon", "Just get fit"];

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
    <div className="land">
      <header className={"lhero" + (go ? " go" : "")}>
        <svg className="lroute" viewBox="0 0 400 220" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="1" d="M-10 190 C 60 150, 90 200, 150 160 S 240 60, 300 100 S 380 40, 410 20" />
        </svg>
        <div className="lhero-in">
          <div className="lmark">{go ? <LogoBurst /> : <span className="lmark-hold"><Logo size={120} /></span>}</div>
          <p className="lbl lkick">For people who don't love running</p>
          <h1 className="lh1"><span>Hate running?</span> <span className="acc">Train for a race anyway.</span></h1>
          <p className="lsub">Bike, walk and lift your way to a 5K, a half marathon or just getting fit. Running comes in when your body is ready.</p>
          {ctas}
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
        <Stat value={5} label="Goals, 5K to marathon" />
        <Stat value={52} unit="wk" label="Longest plan" />
        <Stat value={0} label="Gym needed" />
      </section>

      <section className="lsec">
        <Reveal><h2 className="lh2">Running is optional at first.</h2></Reveal>
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
        <Reveal><h2 className="lh2">One clear thing to do today.</h2></Reveal>
        <Reveal className="lmock">
          <div className="hero">
            <span className="lbl">Today</span>
            <span className="ht">Bike <span className="nw">30<small>min</small></span></span>
            <span className="lmock-sub">Easy pace. You should be able to talk.</span>
          </div>
        </Reveal>
        <ol className="lsteps">
          {[["Pick a goal", "A race date or just getting fit."], ["Say where you're starting", "Can't run a mile yet? Good place to start."], ["Do today's session", "Log how it felt. The plan handles the rest."]].map(([t, s], i) => (
            <Reveal key={t} delay={i * 90}>
              <li><span className="num">{i + 1}</span><div><b>{t}</b><small>{s}</small></div></li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="lsec">
        <Reveal><h2 className="lh2">Pick your finish line.</h2></Reveal>
        <Reveal className="lgoals">{GOALS.map((g) => <span key={g}>{g}</span>)}</Reveal>
      </section>

      <section className="lsec lend">
        <Reveal>
          <h2 className="lh2">Ready when you are.</h2>
          <p className="lsub">Free. No account needed. Your plan lives on your phone.</p>
          {ctas}
        </Reveal>
        <p className="ldisc">Not medical advice. Check with your doctor before starting a new exercise program.</p>
        <a className="lpriv" href="/privacypolicy.html">Privacy policy</a>
      </section>
      </>}
    </div>
  );
}

/** First screen for someone with no data: the full landing page on the website, just the hero in the app. */
export function Welcome({ onStart }: { onStart: () => void }) {
  return <Landing onStart={onStart} heroOnly={IS_NATIVE} />;
}
