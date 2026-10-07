# Design

Dark, rugged, sporty. One hero per screen, huge condensed numbers, very little text, smooth motion.

## Tokens

```css
--paper:#111110; --surface:#1B1A19; --surface2:#252321; --line:#2E2B28;
--ink:#F4F1EC; --muted:#9A958F;
--accent:#FF6A13; --accent-hi:#FF8A3D; --accent-lo:#E5540A; --accent-soft:#33200F;
--on-accent:#141210; --bad:#FF5A4F; --good:#7BD88F;
--display:"Barlow Condensed"; --body:"Barlow";
```

- Text on orange is near-black (`--on-accent`), not white.
- Red is only for warnings (overdue, too hard). Orange is for actions and progress.
- Numbers use `font-variant-numeric: tabular-nums`.

## Screens (see prototype)

- **Home:** date and greeting, week ring, "This week" meter with 7 day tiles, a striped orange hero card for today's cardio (tap to log; shows distance, time, pace when done), a row of tiles for strength, steps, weigh-in, extra activity, one coach tip, last session.
- **Plan:** race header card (days to race, miles, workouts, week progress), week pills W1 to W52, a session card per day. Tap a day for a sheet with everything for that day.
- **Center + button:** sheet with big tiles for each thing to log.
- **Stats:** month or all-time toggle, total distance in large type, four tiles, year chart, steps strip, goal times, weight, plan adjustments, history.
- **Settings:** name, weight, storage, backup, app version and update check, gear checklist, how it works.

## Motion

Numbers count up on screen entry, bars fill, sheets slide up and drag down to close, the hero stripes drift slowly, a toast confirms each log. All off under reduced motion.
