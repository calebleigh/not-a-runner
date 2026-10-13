import { useEffect, useState } from "react";
import { DN, hms, type HealthConflict } from "../training";
import { healthAvailable, healthName, openHealthSettings, type HealthAvailability } from "../native/health";
import { useApp } from "./app-state";
import { Icon } from "./icons";
import { IS_NATIVE } from "./apk";
import { answerConflict, autoImportHealth, importHealthNow, turnOffHealth, turnOnHealth, useHealth } from "./healthSync";

function ago(ms: number | null): string {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Settings (app only): bring in steps, workouts, heart rate and weigh-ins from the phone. */
export function HealthSection() {
  const { update, toast, openSheet } = useApp();
  const h = useHealth();
  const [avail, setAvail] = useState<HealthAvailability | null>(null);
  useEffect(() => { if (IS_NATIVE) healthAvailable().then(setAvail); }, []);
  if (!IS_NATIVE || !avail) return null;

  const turnOn = async () => {
    const r = await turnOnHealth(update);
    if (r.ok) toast(r.summary || `Connected to ${healthName}.`);
  };
  const now = async () => {
    const s = await importHealthNow(update, { explain: true });
    if (s) toast(s);
    if (s.endsWith("no steps today.")) openSheet({ kind: "stepsHelp" });
  };

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
            <button className="linkbtn" onClick={() => openSheet({ kind: "stepsHelp" })}>How to set up daily steps</button>
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
            <div className="setrow">
              <span>Steps not showing?<small>Set up all-day step counting.</small></span>
              <button className="chip" onClick={() => openSheet({ kind: "stepsHelp" })}>Setup guide</button>
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

const FIT_URL = "https://play.google.com/store/apps/details?id=com.google.android.apps.fitness";

/**
 * The sheet: how to get all-day steps into the app. Something has to save steps to Health Connect;
 * Google Fit does it reliably from the phone's own step counter, Samsung Health often doesn't.
 */
export function StepsHelpBody() {
  const { update, toast } = useApp();
  const h = useHealth();
  const connect = async () => {
    const r = await turnOnHealth(update);
    if (r.ok) toast(r.summary || `Connected to ${healthName}.`);
  };
  const now = async () => { const s = await importHealthNow(update, { explain: true }); if (s) toast(s); };
  return (
    <div className="updsteps">
      <p className="setnote">Not a Runner reads your daily steps from {healthName}. An app has to count them and save them there. Google Fit does it all day from your phone.</p>
      <div className="updstep">
        <span className="updnum">1</span>
        <div><b>Install Google Fit</b><small>Free on the Play Store. Sign in and allow physical activity.</small></div>
        <a className="chip" href={FIT_URL} target="_blank" rel="noreferrer">Get it</a>
      </div>
      <div className="updstep">
        <span className="updnum">2</span>
        <div><b>Let Fit share with {healthName}</b><small>In Fit, tap Profile, then the gear, then Sync Fit with {healthName}. Allow Steps.</small></div>
      </div>
      <div className={"updstep" + (h.on ? " ok" : "")}>
        <span className="updnum">{h.on ? <Icon.check /> : 3}</span>
        <div><b>{h.on ? `Not a Runner is connected` : `Connect Not a Runner`}</b><small>{h.on ? `Make sure Steps is allowed for Not a Runner in ${healthName}.` : "Allow Steps when it asks."}</small></div>
        {!h.on && <button className="chip" disabled={h.busy} onClick={connect}>Connect</button>}
      </div>
      <div className="updstep">
        <span className="updnum">4</span>
        <div><b>Check it worked</b><small>In {healthName}, open Data and access, then Steps. Google Fit should be listed. Steps count from setup on.</small></div>
        <button className="chip" onClick={() => openHealthSettings()}>Open</button>
      </div>
      {h.on && <button className="btn solid" disabled={h.busy} onClick={now}>{h.busy ? "Importing" : "Import now"}</button>}
      <p className="setnote"><b>Samsung watch or band?</b> Its steps go through Samsung Health. Set Samsung Health's battery use to Unrestricted, then in Samsung Health turn {healthName} sharing off and on.</p>
    </div>
  );
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
