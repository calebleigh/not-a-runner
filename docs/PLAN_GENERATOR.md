# Plan generator

Rule-based. No AI. Pure function: `generatePlan(profile) -> Plan`. Same profile, same plan.

## Onboarding questions (the profile)

| Field | Options |
|---|---|
| goal | `5k`, `10k`, `half`, `full`, `fitness` (no race) |
| raceDate | date, required unless goal is `fitness` |
| startLevel | `cant_run_mile`, `run_1_mile`, `run_3_miles`, `run_6_plus` |
| daysPerWeek | 3 to 6 (prototype uses 5, weekdays) |
| hasBike | boolean (indoor or outdoor) |
| impactSensitive | boolean, sore knees or joints; leans on bike and walking longer |
| gear | set of owned items: `bands`, `kettlebell`, `mat`, `roller`, `heart_rate_band` |
| weightLb | number, used for calorie estimates only |
| name | optional, for greeting |

## How the prototype builds its plan (52 weeks, half marathon, can't run a mile)

Four phases, 13 weeks each:

1. **Foundation:** bike and brisk walks, 20 to 30 min, growing linearly. Longer ride on Friday (25 to 45 min). Strength level 1.
2. **Build the engine:** bike 30 to 40 min, long ride 60 to 90 min, two walk/run interval sessions. Intervals progress from jog 1 min / walk 2 min x7 to jog 10 min / walk 2 min x3. A mile test on the first day. Strength level 2.
3. **Become a runner:** walk/run three days (two short of 25 to 35 min, one long), bike on two recovery days. Long run distances by week: 3, 3, 3.5, 4, 3, 4, 4.5, 5, 4, 5, 5.5, 6, 5 miles (cutback weeks built in). Strength level 3, Thursday becomes core only, Friday becomes stretch.
4. **Race prep:** short runs 30 to 40 min, long run 6, 7, 7.5, 6, 8, 8.5, 9, 7, 10, 11, 8, 6 miles, then race week. Downhill practice from week 42 (the target race is net downhill). Taper in the last 3 weeks.

Mile tests on weeks 14, 27, 40, 49.

Weekly strength split (prototype): Mon legs, Tue push and core, Wed back and hips, Thu legs and core, Fri full-body circuit. Each exercise has 4 levels that map to the phases, and reps bump halfway through a phase. Gear swaps replace exercises (kettlebell gives goblet squats, rows and deadlifts; bands give band rows and pull-aparts).

## Generalizing it

1. `weeksAvailable = weeks until raceDate` (cap at 52, minimum per goal: 5K 8, 10K 10, half 16, full 20; below the minimum, warn and offer a later race or a finish-only plan).
2. `startLevel` sets how many early weeks are skipped. Someone who can run 3 miles starts around the prototype's phase 2 midpoint.
3. Split remaining weeks into the four phases proportionally, keeping race prep at least 6 weeks for half and full.
4. Scale long-run targets by goal: peak long run is about 3 mi for 5K, 6 for 10K, 10 to 11 for half, 18 to 20 for full. Build with a cutback week every 3rd or 4th week. Never raise weekly running volume more than about 10%.
5. `impactSensitive` or no running history: extend Foundation and Build, keep more bike days, start intervals later.
6. `hasBike = false`: replace bike sessions with brisk walks of equal time, or another low-impact option the user picks.
7. `daysPerWeek` below 5: drop the lowest-priority sessions first (a second recovery ride, then a short run), keep the long session.
8. `fitness` goal: rolling 12-week blocks with no taper, repeating with gradual progression.

## Adaptation rules (port from prototype)

- Score each logged session: easy +1, just right 0, too hard -1. For walk/run sessions over 1 mile, add +1 if pace beats the phase target and the session wasn't too hard, or -1 if pace is 12% slower than target. Average heart rate of 155 or more on an on-foot session counts -1.
- Phase pace targets for the prototype: 16:00, 14:30, 13:15 per mile for phases 2 to 4. Generalize as a percentage of the user's mile test.
- Three strong sessions in a row step that category up 10% (running can only step up once). Two tough out of three step it down. Applies to current and future weeks only.
- Swaps: bike replacing an on-foot session runs 1.5x the time, capped at 120 min. Three or more on-foot sessions swapped to bike in the last two weeks pauses running progression; four or more eases running back 10%. Warn from two.

## Goal times (prototype tiers)

| Distance | Finish | Solid | Stretch |
|---|---|---|---|
| 1 mile | 14:00 | 12:30 | 11:00 |
| 5 miles | 1:10:00 | 1:02:30 | 57:30 |
| 10 miles | 2:20:00 | 2:08:00 | 1:58:00 |
| Half | 3:00:00 | 2:45:00 | 2:30:00 |

Generalize by deriving tiers from the first mile test, and predict race times with the Riegel formula: `t2 = t1 * (d2 / d1) ^ 1.06`.

## Tests to write

- Same profile gives the identical plan.
- No week raises running volume more than 10% over the previous non-cutback week.
- Every plan ends on race day with a taper.
- Swapped and adapted sessions never exceed the caps above.
