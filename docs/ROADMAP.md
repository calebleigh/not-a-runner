# Roadmap

Do these in order. Each stage ends deployed and usable.

## Stage 1: Real codebase, installable web app
- Vite + React + TypeScript project. Port prototype logic into a `training/` module with Vitest tests.
- Port all screens and the design system.
- IndexedDB storage, export and import (reads the prototype's backup code).
- PWA: manifest, icons, service worker for offline. Deploy to Vercel. Installs on Android Chrome as a real app.
- Done when: the owner imports his data and uses it daily from the home screen icon.

## Stage 2: Plan generator and onboarding
- Onboarding flow from `docs/PLAN_GENERATOR.md`.
- `generatePlan(profile)` replaces the hard-coded 52-week plan. The owner's current plan should come out the same for his profile.
- Settings to edit the profile and regenerate future weeks without losing history.

## Stage 3: Accounts and sync
- Sign in with Google. Supabase or Firebase, whichever is simpler; keep local-first and sync in the background.
- Phone and computer stay in sync.

## Stage 4: Android app with Health Connect
- Wrap with Capacitor. Build an installable APK (no Play Store needed at first).
- Read from Health Connect: daily steps, exercise sessions (walks, rides, runs), heart rate, weight. Samsung Health and a Galaxy Fit band write to Health Connect, so this replaces manual entry.
- Match imported sessions to planned sessions by date and type; ask before overwriting a manual log.
- Optional native GPS tracking with the screen off: live distance, pace, time, route.

## Stage 5: Strava (optional)
- Strava OAuth through a small Vercel serverless function (client secret stays server-side). Webhook for new activities.

## Stage 6: Test the market
- Landing page and waitlist. If demand shows up: payments, privacy policy, medical disclaimer, small social features (shareable weekly card, private challenge with friends).
