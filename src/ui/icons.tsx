// Icon set from the prototype.
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  play: () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>,
  check: () => <svg viewBox="0 0 24 24" {...S} strokeWidth={3} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  bolt: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>,
  dumbbell: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></svg>,
  steps: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M7 16c-1.7 0-3-1.6-3-4.5S5.3 5 7 5s2.5 2.3 2.5 5-1 6-2.5 6zM6 19.5h2.5M17 13c1.7 0 3-1.6 3-4.5S18.7 2 17 2s-2.5 2.3-2.5 5 1 6 2.5 6zM15.5 16.5H18" /></svg>,
  scale: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8.5 9.5a5 5 0 0 1 7 0l-2.2 2.4" /></svg>,
  plus: () => <svg viewBox="0 0 24 24" {...S} strokeWidth={2.4} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  close: () => <svg viewBox="0 0 24 24" {...S} strokeWidth="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  clock: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>,
  flame: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M12 22c4 0 7-2.7 7-6.8 0-4.2-3.3-6.6-4.2-10.2-2.4 1.5-3.6 3.6-3.4 6.2-1.3-.6-2.2-1.9-2.4-3.4C7 9.6 5 12.2 5 15.2 5 19.3 8 22 12 22z" /></svg>,
  bike: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><circle cx="5.5" cy="16.5" r="3.5" /><circle cx="18.5" cy="16.5" r="3.5" /><path d="M5.5 16.5L9 9h6l3.5 7.5M9 9l3 7.5L15 9M8 6h3" /></svg>,
  bell: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" /></svg>,
  cloud: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 10a4.25 4.25 0 0 0 .5 8.5z" /></svg>,
  cloudOff: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M7 18.5h10.5M20.5 15.5a4 4 0 0 0-2.4-4.95A6 6 0 0 0 9 6.3M6.3 10.1A4.25 4.25 0 0 0 7 18.5M3 3l18 18" /></svg>,
  pause: () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>,
  friends: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.9-3.4 3.4-5 6.5-5s5.6 1.6 6.5 5" /><path d="M15.5 5.3a3.5 3.5 0 0 1 0 6.4M18 15.4c1.8.7 3 2.2 3.5 4.6" /></svg>,
  pin: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M12 21.5s-7-6.2-7-11.5a7 7 0 0 1 14 0c0 5.3-7 11.5-7 11.5z" /><circle cx="12" cy="10" r="2.6" /></svg>,
  today: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="3" /><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17M8.5 15l2.3 2.3 4.7-4.6" /></svg>,
  chat: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z" /></svg>,
  mail: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>,
  link: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>,
  share: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></svg>,
  flag: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>,
  user: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><circle cx="12" cy="8.5" r="4" /><path d="M4 20.5c1.2-3.8 4.3-5.5 8-5.5s6.8 1.7 8 5.5" /></svg>,
  shoe: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M3 16.5h18v-2.2a2 2 0 0 0-1.4-1.9l-5.1-1.6-2.5-4.3H8.5l-.8 2H5L3 14z" /><path d="M3 19h18" /></svg>,
  home: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>,
  plan: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  stats: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><path d="M4 20V11M10 20V4M16 20v-8M21 20H3" /></svg>,
  settings: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  cake: () => (
    <svg viewBox="0 0 24 24" {...S} aria-hidden="true" className="cake">
      <path className="flame" d="M12 2.2c1.2 1.3 1.2 2.6 0 3.3-1.2-.7-1.2-2 0-3.3z" style={{ fill: "var(--accent)", stroke: "var(--accent)" }} strokeWidth={1} />
      <path d="M12 6v3" />
      <rect x="6" y="9" width="12" height="5" rx="1.5" />
      <rect x="3.5" y="14" width="17" height="7" rx="1.5" />
      <path d="M3.5 17c1.4 0 1.4-1.2 2.8-1.2s1.4 1.2 2.8 1.2 1.4-1.2 2.9-1.2 1.4 1.2 2.8 1.2 1.4-1.2 2.8-1.2 1.4 1.2 2.9 1.2" />
    </svg>
  ),
  bigPlus: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} strokeWidth={2.8} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  box: () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" style={{ stroke: "var(--on-accent)" }} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};
