import { useEffect, useState } from "react";
import { DN, hms, type HealthConflict } from "../training";
import { healthAvailable, healthName, openHealthSettings, type HealthAvailability } from "../native/health";
import { useApp } from "./app-state";
import { IS_NATIVE } from "./apk";
import { answerConflict, autoImportHealth, importHealthNow, turnOffHealth, turnOnHealth, useHealth } from "./healthSync";

function ago(ms: number | null): string {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Settings (app only): bring in steps, workouts, heart rate and weigh-ins from the phone. */
export function HealthSection() {
  const { update, toast } = useApp();
  const h = useHealth();
  const [avail, setAvail] = useState<HealthAvailability | null>(null);
  useEffect(() => { if (IS_NATIVE) healthAvailable().then(setAvail); }, []);
  if (!IS_NATIVE || !avail) return null;

  const turnOn = async () => {
    const r = await turnOnHealth(update);
    if (r.ok) toast(r.summary || `Connected to ${healthName}.`);
  };
  const now = async () => { toast((await importHealthNow(update)) || "Already up to date."); };

  return (
    <div className="area-health">
      <div className="sechead"><h3 className="sectitle">{healthName}</h3>{h.on && <span className="lbl">On</span>}</div>
      <section className="card group">
        {!avail.available ? (
          <div className="syncoff">
            <p><b>Steps and workouts from your watch or band.</b> This needs the {healthName} app. On Android 13 and older, install Health Connect from the Play Store, then come back.</p>
          </div>
        ) : !h.on ? (
          <div className="syncoff">
            <p><b>Skip the typing.</b> Bring in daily steps, workouts, heart rate and weigh-ins from Samsung Health, your band or anything else that saves to {healthName}. Nothing is written back.</p>
            <button className="btn solid" disabled={h.busy} onClick={turnOn}>{h.busy ? "Connecting" : `Connect ${healthName}`}</button>
            {h.error && <p className="syncerr" role="alert">{h.error}</p>}
          </div>
        ) : (
          <>
            <div className="setrow">
              <span>Bringing in steps, workouts and weigh-ins
                <small aria-live="polite">{h.error || (h.busy ? "Importing" : h.last ? `Last import ${ago(h.last)}` : "")}</small>
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
          </>
        )}
      </section>
    </div>
  );
}

/** Imports when the app opens or comes back, if it's been a while. Renders nothing. */
export function HealthAutoImport() {
  const { update, toast } = useApp();
  useEffect(() => {
    if (!IS_NATIVE) return;
    const run = () => { autoImportHealth(update).then((s) => { if (s) toast(s); }); };
    run();
    const onVis = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [update, toast]);
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
