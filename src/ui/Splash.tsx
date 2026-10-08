import { useEffect, useState } from "react";

import { Logo } from "./Logo";

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const LENGTH = REDUCED ? 700 : 1850;

/** The runner, drawn as in the logo but with plain strokes so each part can move on its own. */
function Runner() {
  return <>
    <polygon points="786,0 939,153 787,305 634,152" />
    <g fill="none" strokeWidth="109" strokeLinejoin="miter" strokeMiterlimit="10">
      <polyline points="190.5,329 390,130 789,528.5 988.5,329" />
      <polyline points="345,403 544.5,603 345,803" />
      <polyline points="38,803 275.5,565" />
    </g>
  </>;
}

/** One shape of the mark: the runner runs in, then the slash slams down and cuts him. */
function Mark({ round }: { round: boolean }) {
  const g = round ? "spg-r" : "spg-s", clip = round ? "spc-r" : "spc-s";
  const slash = round ? { x1: 0, y1: 0, x2: 1531, y2: 1531 } : { x1: 0, y1: 19, x2: 1512, y2: 1531 };
  return (
    <svg className={"sp-mark " + (round ? "logo-rd" : "logo-sq")} viewBox="-60 -60 1651 1651" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="1531" x2="1531" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--accent-lo)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent-hi)" }} />
        </linearGradient>
        <clipPath id={clip}>{round ? <circle cx="765.5" cy="765.5" r="765.5" /> : <rect width="1531" height="1531" rx="180" />}</clipPath>
      </defs>
      <g className="sp-runner">
        <g className="sp-stride">
          <g transform={round ? "translate(354.3 429.1) scale(0.8)" : "translate(288.08 375.39) scale(0.92883)"} fill={`url(#${g})`} stroke={`url(#${g})`}>
            <Runner />
          </g>
        </g>
      </g>
      <g className="sp-slash" clipPath={`url(#${clip})`}>
        <line {...slash} stroke="var(--paper)" strokeWidth="229" />
      </g>
      <g className="sp-frame" fill="none" stroke={`url(#${g})`} strokeWidth="116">
        {round ? <circle cx="765.5" cy="765.5" r="707.5" /> : <rect x="58" y="58" width="1415" height="1415" rx="122" />}
      </g>
      <g className="sp-slash" clipPath={`url(#${clip})`}>
        <line {...slash} stroke={`url(#${g})`} strokeWidth="109" />
      </g>
    </svg>
  );
}

/** Plays on every real load of the app: a launch from closed, or a refresh. Tap to skip. */
export function Splash() {
  const [run, setRun] = useState(1);
  useEffect(() => {
    if (!run) return;
    const t = setTimeout(() => setRun(0), LENGTH);
    return () => clearTimeout(t);
  }, [run]);
  if (!run) return null;
  return (
    <div key={run} className={"splash" + (REDUCED ? " still" : "")} onClick={() => setRun(0)} role="presentation">
      <div className="sp-shake">
        <Mark round={false} />
        <Mark round />
      </div>
      <div className="sp-name">Not a Runner</div>
    </div>
  );
}

/** The logo at a given size; tapping it plays the launch animation right there. */
export function TapLogo({ size }: { size: number }) {
  const [n, setN] = useState(0);
  return (
    <button className="taplogo" style={{ width: size, height: size }} aria-label="Play the logo animation" onClick={() => setN((x) => x + 1)}>
      {n === 0 ? <Logo size={size} /> : (
        <span key={n} className="sp-shake">
          <Mark round={false} />
          <Mark round />
        </span>
      )}
    </button>
  );
}
