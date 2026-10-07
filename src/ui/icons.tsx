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
  clock: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>,
  flame: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M12 22c4 0 7-2.7 7-6.8 0-4.2-3.3-6.6-4.2-10.2-2.4 1.5-3.6 3.6-3.4 6.2-1.3-.6-2.2-1.9-2.4-3.4C7 9.6 5 12.2 5 15.2 5 19.3 8 22 12 22z" /></svg>,
  shoe: () => <svg viewBox="0 0 24 24" {...S} aria-hidden="true"><path d="M3 16.5h18v-2.2a2 2 0 0 0-1.4-1.9l-5.1-1.6-2.5-4.3H8.5l-.8 2H5L3 14z" /><path d="M3 19h18" /></svg>,
  home: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>,
  plan: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  stats: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><path d="M4 20V11M10 20V4M16 20v-8M21 20H3" /></svg>,
  profile: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
  bigPlus: () => <svg viewBox="0 0 24 24" width="24" height="24" {...S} strokeWidth={2.8} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  box: () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#141210" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};
