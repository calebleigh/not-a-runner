# Data model (prototype)

All state is one object. Port it to typed stores, keep export and import compatible.

```ts
type State = {
  done:    Record<SessionId, 1>;            // "w-d-c" cardio, "w-d-s" strength
  logs:    Record<SessionId, {dist?: number; time?: number; feel?: "easy"|"ok"|"hard"; hr?: number; at: number}>;
  swaps:   Record<SessionId, "bike"|"walk"|"run">;
  gear:    Record<GearKey, 1>;
  weights: Record<WeekNumber, number>;      // lb, Monday weigh-ins
  steps:   Record<DayKey, number>;          // "w-d", d 0..6 (Mon..Sun), full-day total
  extras:  Record<DayKey, {kind:"walk"|"bike"; dist:number; time:number; steps?:number; label?:string}[]>;
  settings:{ name?: string; startWt?: number };
};
```

- Week 1 starts on the plan start date (prototype: Mon Oct 5, 2026). Day index 0 is Monday.
- `time` is in seconds, `dist` in miles.
- Steps are tracked on their own and never added to miles or calories, so nothing is counted twice.
- Calories are estimates: MET by activity and speed x body weight in kg x hours. Strength uses MET 3.5.
- The prototype falls back to 195 lb when no weight is set. In the real app, ask for weight in onboarding instead.

## Backup format

`"SGH1." + base64(JSON.stringify({v:1, ...state}))`. Import merges rather than replaces. Keep reading this format so the owner can move his existing data over.

## Moving the owner's data

In the prototype: Profile, Backup, Export, copy the code. In the new app: Profile, Backup, Import.
