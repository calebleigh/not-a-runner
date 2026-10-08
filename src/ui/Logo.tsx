import { useId } from "react";

/** The running man mark (design/logo-mark.svg), in the orange gradient. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  const id = useId();
  const g = `url(#${id})`;
  return (
    <svg className={className} width={size} height={size} viewBox="-41 -135 1110 1110" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="841" x2="1028" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E95C14" /><stop offset="1" stopColor="#FA8A3C" />
        </linearGradient>
      </defs>
      <polygon points="786,0 939,153 787,305 634,152" fill={g} />
      <g fill="none" stroke={g} strokeWidth="109" strokeLinejoin="miter" strokeMiterlimit="10">
        <polyline points="190.5,329 390,130 789,528.5 988.5,329" />
        <polyline points="345,403 544.5,603 345,803" />
        <polyline points="38,803 275.5,565" />
      </g>
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
