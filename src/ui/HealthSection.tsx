import { useEffect, useState } from "react";
import { DN, hms, type HealthConflict } from "../training";
import { healthAvailable, healthName, openHealthSettings, type HealthAvailability } from "../native/health";
import { useApp } from "./app-state";
import { IS_NATIVE } from "./apk";
import { importPhoneSteps, turnOffPhoneSteps, turnOnPhoneSteps, usePhoneSteps, watchLiveSteps } from "./phoneSteps";
import { phoneStepsAvailable } from "../native/phoneSteps";
import { answerConflict, autoImportHealth, importHealthNow, turnOffHealth, turnOnHealth, useHealth } from "./healthSync";

function ago(ms: number | null): string {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Settings (app only): steps counted by this phone, then Health Connect. */
export function HealthSection() {
  if (!IS_NATIVE) return null;
  return (
    <div className="area-health">
      <PhoneStepsCard />
      <HealthConnectCard />
    </div>
  );
}

/** All-day steps from the phone's own step counter: no other app needed. */
function PhoneStepsCard() {
  const on = usePhoneSteps();
  const { update } = useApp();
  const [avail, setAvail] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => { phoneStepsAvailable().then(setAvail); }, []);
  if (!avail) return null;
  const turnOn = async () => {
    setBusy(true);
    const ok = await turnOnPhoneSteps();
    setDenied(!ok);
    setBusy(false);
    if (ok) importPhoneSteps(update);
  };
  return (
    <>
      <div className="sechead"><h3 className="sectitle">Daily steps</h3>{on && <span className="lbl">On</span>}</div>
      <section className="card group">
        {!on ? (
          <div className="syncoff">
            <p><b>Count steps all day.</b> Your phone counts them in the background with almost no battery. No other app needed.</p>
            <button className="btn solid" disabled={busy} onClick={turnOn}>{busy ? "Starting" : "Count my steps"}</button>
            {denied && <p className="syncerr" role="alert">Not allowed. Turn on Physical activity for Not a Runner in your phone's settings.</p>}
          </div>
        ) : (
          <div className="setrow">
            <span>Counting steps on this phone<small>From when it was turned on. Carry your phone to count.</small></span>
            <button className="chip" onClick={() => turnOffPhoneSteps()}>Turn off</button>
          </div>
        )}
      </section>
    </>
  );
}

/** Steps, workouts, heart rate and weigh-ins from Health Connect (a watch, band or other app). */
function HealthConnectCard() {
  const { update, toast } = useApp();
  const h = useHealth();
  const [avail, setAvail] = useState<HealthAvailability | null>(null);
  useEffect(() => { healthAvailable().then(setAvail); }, []);
  if (!avail) return null;

  const turnOn = async () => {
    const r = await turnOnHealth(update);
    if (r.ok) toast(r.summary || `Connected to ${healthName}.`);
  };
  const now = async () => { const s = await importHealthNow(update, { explain: true }); if (s) toast(s); };

  return (
    <>
      <div className="sechead"><h3 className="sectitle">{healthName}</h3>{h.on && <span className="lbl">On</span>}</div>
      <section className="card group">
        {!avail.available ? (
          <div className="syncoff">
            <p><b>Workouts and steps from your watch or band.</b> This needs the {healthName} app. On Android 13 and older, install Health Connect from the Play Store, then come back.</p>
          </div>
        ) : !h.on ? (
          <div className="syncoff">
            <p><b>Have a watch or band?</b> Bring in its workouts, heart rate, steps and weigh-ins from {healthName}. Nothing is written back.</p>
            <button className="btn solid" disabled={h.busy} onClick={turnOn}>{h.busy ? "Connecting" : `Connect ${healthName}`}</button>
            {h.error && <p className="syncerr" role="alert">{h.error}</p>}
          </div>
        ) : (
          <>
            <div className="setrow">
              <span>Bringing in steps, workouts and weigh-ins
                <small aria-live="polite">{h.error || (h.busy ? "Importing" : h.note || (h.last ? `Last import ${ago(h.last)}` : ""))}</small>
              </span>
              <span className="btnpair">
                <button className="chip" disabled={h.busy} onClick={now}>Import now</button>
                <button className="chip" onClick={turnOffHealth}>Turn off</button>
              </span>
            </div>
            <div className="setrow">
              <span>Permissions<small>Choose what Not a Runner can read.</small></span>
              <button className="chip" onClick={() => openHealthSettings()}>Open {healthName}</button>
            </div>
            <p className="setnote hcnote">Your watch or band's app has to share with {healthName}. Samsung Health can be slow to: set its battery use to Unrestricted, then turn its {healthName} sharing off and on.</p>
          </>
        )}
      </section>
    </>
  );
}

/** Brings in the phone's steps and (when it's been a while) Health Connect when the app opens or comes back. Renders nothing. */
export function HealthAutoImport() {
  const { update, toast } = useApp();
  useEffect(() => {
    if (!IS_NATIVE) return;
    const run = () => {
      importPhoneSteps(update);
      autoImportHealth(update).then((s) => { if (s) toast(s); });
    };
    run();
    const onVis = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVis);
    // While the app is open, today's steps keep climbing.
    const t = window.setInterval(() => { if (document.visibilityState === "visible") importPhoneSteps(update); }, 5 * 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(t); };
  }, [update, toast]);

  // The live count while the app is on screen.
  const phoneOn = usePhoneSteps();
  useEffect(() => {
    if (!IS_NATIVE || !phoneOn) return;
    let stop: (() => void) | null = null, gone = false;
    const begin = () => { if (!stop) watchLiveSteps().then((s) => { if (gone) s(); else stop = s; }); };
    const end = () => { stop?.(); stop = null; };
    const onVis = () => (document.visibilityState === "visible" ? begin() : end());
    if (document.visibilityState === "visible") begin();
    document.addEventListener("visibilitychange", onVis);
    return () => { gone = true; end(); document.removeEventListener("visibilitychange", onVis); };
  }, [phoneOn]);
  return null;
}

const KIND: Record<string, string> = { run: "Run", walk: "Walk", hike: "Hike", bike: "Ride", elliptical: "Elliptical", swim: "Swim", row: "Row", skate: "Skate", other: "Workout" };

export function conflictText(c: HealthConflict): string {
  const w = c.workout;
  const dist = w.miles && w.miles >= 0.05 ? `${(Math.round(w.miles * 100) / 100)} mi, ` : "";
  return `${KIND[w.kind] ?? "Workout"} on ${DN[c.d]}: ${dist}${hms(Math.round(w.time))}${w.hr ? `, ${Math.round(w.hr)} bpm` : ""}`;
}

/** The sheet: workouts that match a session you already logged. */
export function HealthSheetBody() {
  const { update, closeSheet } = useApp();
  const h = useHealth();
  useEffect(() => { if (!h.mem.pending.length) closeSheet(); }, [h.mem.pending.length, closeSheet]);
  return (
    <div className="hclist">
      <p className="setnote">You already logged these sessions. Use the workout from {healthName} instead, keep both, or ignore it.</p>
      {h.mem.pending.map((c) => (
        <div className="hcitem" key={c.workout.id}>
          <b>{conflictText(c)}</b>
          <small>{c.workout.source ? `From ${c.workout.source}. ` : ""}Your log: {c.title}</small>
          <span className="btnpair">
            <button className="chip" onClick={() => answerConflict(update, c, "replace")}>Use this</button>
            <button className="chip" onClick={() => answerConflict(update, c, "extra")}>Keep both</button>
            <button className="chip" onClick={() => answerConflict(update, c, "skip")}>Ignore</button>
          </span>
        </div>
      ))}
    </div>
  );
}
