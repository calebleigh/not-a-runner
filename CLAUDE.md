# Project brief

A training app for people who don't like running but want a real goal: a 5K, a half marathon, or just getting fit. Most running apps assume you want to be a runner. This one treats biking, walking and bodyweight strength as real training, eases people in, and adapts when knees hurt or life gets in the way.

The app is called **Not a Runner**. Read `docs/PRODUCT.md` before making product decisions.

## Where things stand

- Stage 1 is built: Vite + React app in `src/`, deployed to https://not-a-runner.vercel.app (old address https://half-training-app.vercel.app still serves it; data lives per address, so users move with Export/Import). Plan logic is in `src/training/` with a parity test against the prototype.
- `reference/prototype.html` is a working single-file prototype. It has the full 52-week half-marathon plan, logging, adaptive plan rules, gear list, steps, weigh-ins, stats and the current visual design. Treat it as the source of truth for behavior and look. Port its logic; do not copy its single-file structure.
- The prototype was built inside Claude's artifact viewer. Its `window.claude.use("db")` sync only works there. Replace it.
- `reference/design/` holds the reference screens the owner likes. The orange-on-charcoal palette is final; take layout ideas from the others (hero card, big numbers, week pills, session cards), not their colors.

## Build order

Follow `docs/ROADMAP.md` in order. Finish and ship each stage before starting the next. Stage 1 is a real codebase with the prototype's features, deployable as an installable web app.

## Stack (decided)

- TypeScript, React, Vite. Tailwind is fine; keep the design tokens from `docs/DESIGN.md` as CSS variables.
- Capacitor for the Android build (stage 4), so the web code is reused.
- Local-first storage (IndexedDB via a small wrapper) so the app works offline. Sync is added later.
- Deploy the web app to Vercel. The owner already uses Vercel for his portfolio.
- No AI calls in the core app. Plan generation is rule-based (see `docs/PLAN_GENERATOR.md`).

## Rules

- Plan logic lives in pure functions with unit tests (Vitest). Same inputs, same plan, every time.
- Keep training logic separate from UI so it can run on the web and in the Android app.
- Mobile first. Test at 360px and 412px widths. Bottom nav, thumb-reachable actions.
- Respect `prefers-reduced-motion`.
- Never present health guidance as medical advice. Show a short disclaimer in onboarding.
- Users own their data: export and import must always work.

## Owner preferences

- Never use em dashes in UI copy or docs. Use commas, periods or parentheses.
- Copy is short and plain. Big numbers, few words.
- Orange stays as the accent.
