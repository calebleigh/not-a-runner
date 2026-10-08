import { useId } from "react";

/**
 * The Not a Runner mark (design/logo-mark.svg): running man in a square frame, cut by a slash.
 * Drawn as a mask so one gradient, in the theme's accent colors, runs across the whole mark.
 */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return <>
    <SquareLogo size={size} className={"logo-sq " + (className || "")} />
    <RoundLogo size={size} className={"logo-rd " + (className || "")} />
  </>;
}

/** Round "no" sign version: circular frame, slash through the center, smaller man. */
function RoundLogo({ size, className }: { size: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const grad = `${id}g`, circle = `${id}s`, cut = `${id}c`, shape = `${id}m`;
  const box = { x: -60, y: -60, width: 1651, height: 1651 };
  return (
    <svg className={className} width={size} height={size} viewBox="-60 -60 1651 1651" aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="1531" x2="1531" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--accent-lo)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent-hi)" }} />
        </linearGradient>
        <clipPath id={circle}><circle cx="765.5" cy="765.5" r="765.5" /></clipPath>
        <mask id={cut} maskUnits="userSpaceOnUse" {...box}>
          <rect {...box} fill="#fff" />
          <line x1="0" y1="0" x2="1531" y2="1531" stroke="#000" strokeWidth="229" />
        </mask>
        <mask id={shape} maskUnits="userSpaceOnUse" {...box}>
          <g fill="none" stroke="#fff" clipPath={`url(#${circle})`}>
            <circle cx="765.5" cy="765.5" r="707.5" strokeWidth="116" />
            <line x1="0" y1="0" x2="1531" y2="1531" strokeWidth="109" />
          </g>
          <g mask={`url(#${cut})`}>
            <g transform="translate(354.3 429.1) scale(0.8)" fill="#fff" stroke="#fff">
              <polygon points="786,0 939,153 787,305 634,152" stroke="none" />
              <g fill="none" strokeWidth="109" strokeLinejoin="miter" strokeMiterlimit="10">
                <polyline points="190.5,329 390,130 789,528.5 988.5,329" />
                <polyline points="345,403 544.5,603 345,803" />
                <polyline points="38,803 275.5,565" />
              </g>
            </g>
          </g>
        </mask>
      </defs>
      <rect {...box} fill={`url(#${grad})`} mask={`url(#${shape})`} />
    </svg>
  );
}

function SquareLogo({ size, className }: { size: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const grad = `${id}g`, square = `${id}s`, cut = `${id}c`, shape = `${id}m`;
  const box = { x: -60, y: -60, width: 1651, height: 1651 };
  return (
    <svg className={className} width={size} height={size} viewBox="-60 -60 1651 1651" aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="1531" x2="1531" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--accent-lo)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent-hi)" }} />
        </linearGradient>
        <clipPath id={square}><rect width="1531" height="1531" rx="180" /></clipPath>
        <mask id={cut} maskUnits="userSpaceOnUse" {...box}>
          <rect {...box} fill="#fff" />
          <line x1="0" y1="19" x2="1512" y2="1531" stroke="#000" strokeWidth="229" />
        </mask>
        <mask id={shape} maskUnits="userSpaceOnUse" {...box}>
          <g fill="none" stroke="#fff" clipPath={`url(#${square})`}>
            <rect x="58" y="58" width="1415" height="1415" rx="122" strokeWidth="116" />
            <line x1="0" y1="19" x2="1512" y2="1531" strokeWidth="109" />
          </g>
          <g mask={`url(#${cut})`}>
            <g transform="translate(288.08 375.39) scale(0.92883)" fill="#fff" stroke="#fff">
              <polygon points="786,0 939,153 787,305 634,152" stroke="none" />
              <g fill="none" strokeWidth="109" strokeLinejoin="miter" strokeMiterlimit="10">
                <polyline points="190.5,329 390,130 789,528.5 988.5,329" />
                <polyline points="345,403 544.5,603 345,803" />
                <polyline points="38,803 275.5,565" />
              </g>
            </g>
          </g>
        </mask>
      </defs>
      <rect {...box} fill={`url(#${grad})`} mask={`url(#${shape})`} />
    </svg>
  );
}

/** Mark plus "Not a Runner" in the display face. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size * 0.82 }}>
      <Logo size={size} />
      <span>Not a Runner</span>
    </span>
  );
}
