import { useEffect, useState } from "react";
import { DN, dayAt, effKind, fmtShort, hms, intervalAt, saveTrack, strideFor, trackResult, trackStats, type Feel, type TrackKind } from "../training";
import { canTrackInBackground, openLocationSettings } from "../native/location";
import { canCountSteps } from "../native/steps";
import { newId } from "../sync/engine";
import { useApp } from "./app-state";
import { ConfirmButton, FeelPicker } from "./cards";
import { Icon } from "./icons";
import { RouteMapView } from "./RouteMap";
import { trackKindFor } from "./trackFor";
import {
  closeTracker, finishTracking, pauseTracking, resumeAfterReload, resumeTracking, setSimulate, setTrackKind, setTrackMode, setVoice, startTracking, useTracker,
} from "./tracker";

const KINDS: [TrackKind, string][] = [["walk", "Walk"], ["run", "Run"], ["bike", "Bike"]];
const pace = (s: number | null) => (s ? hms(s) : "--:--");

/** Full-screen workout tracker: ready, recording, then a summary to save. */
export function TrackerScreen() {
  const t = useTracker();
  const { model, state, update, toast } = useApp();
  const [, tick] = useState(0);
  const [feel, setFeel] = useState<Feel | undefined>();
  const [saveAsExtra, setSaveAsExtra] = useState(false);
  // Distance typed on the summary (e.g. from a treadmill); empty means use the measured one.
  const [typed, setTyped] = useState("");

  // The page behind the tracker stays still while it's open.
  const open = !!t;
  useEffect(() => {
    document.body.classList.toggle("tracking", open);
    return () => document.body.classList.remove("tracking");
  }, [open]);

  // The clock moves every second while recording; GPS fixes don't arrive on a beat.
  useEffect(() => {
    if (t?.status !== "recording" && t?.status !== "paused") return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [t?.status]);
  useEffect(() => { resumeAfterReload(); }, []);
  useEffect(() => { if (t?.status === "ready") { setFeel(undefined); setSaveAsExtra(false); setTyped(""); } }, [t?.status]);
  const planKind = t?.target ? dayAt(model, t.target.w, t.target.d)?.c.kind : undefined;
  useEffect(() => { if (t?.status === "done") setSaveAsExtra(!!planKind && (planKind === "bike") !== (t.kind === "bike")); }, [t?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) return null;
  const day = t.target ? dayAt(model, t.target.w, t.target.d) : undefined;
  const already = !!day && !!state.done[day.ids[0]];
  const planned = t.target ? effKind(state, t.target.w, t.target.d) : null;
  const recKind = planned ? trackKindFor(planned.base) : null;
  // A walk tracked on a bike day (or a ride on a walking day) isn't that session: it saves as an extra.
  const mismatch = !!day && (day.c.kind === "bike") !== (t.kind === "bike");
  const where = day && !mismatch ? `${DN[t.target!.d]} ${fmtShort(day.date)}: ${t.target!.title}` : "Extra activity, today";
  const now = t.finishedAt ?? Date.now();
  const s = t.track ? trackStats(t.track, now) : null;
  const bike = t.kind === "bike", indoor = t.mode === "indoor";
  const waiting = !indoor && t.status === "recording" && !t.simulate && (!t.lastFixAt || Date.now() - t.lastFixAt > 15_000);
  const typedMiles = typed.trim() === "" ? undefined : Math.max(0, parseFloat(typed) || 0);
  const extras = { indoor, steps: t.steps, miles: typedMiles };
  const live = t.track ? trackResult(state, t.track, now, { indoor, steps: t.steps }) : null;
  // Indoors, the numbers come from steps (or just time); outdoors, from GPS.
  const miles = indoor ? live?.dist ?? 0 : s?.miles ?? 0;
  const paceS = indoor ? (miles >= 0.05 && s ? Math.round(s.elapsedS / miles) : null) : s?.paceS ?? null;
  const mph = indoor ? (s && s.elapsedS ? miles / (s.elapsedS / 3600) : 0) : s?.mph ?? 0;
  const stride = strideFor(state, t.kind === "run" ? "run" : "walk");

  const save = () => {
    if (!t.track || !t.finishedAt) return;
    const target = saveAsExtra || !t.target ? null : t.target;
    update((draft) => { saveTrack(draft, model, { track: t.track!, finishedAt: t.finishedAt!, feel, target, date: new Date(t.track!.startedAt), newId, ...extras }); });
    toast(target && day ? "Saved to your plan. Nice work." : "Saved as an extra activity.");
    closeTracker();
  };

  return (
    <div className="tracker" role="dialog" aria-label="Workout tracker">
      <div className="trk-top">
        <div>
          <span className={"lbl trk-status " + t.status}>{t.status === "done" ? "Finished" : t.status === "ready" ? "Ready" : t.status === "paused" ? "Paused" : "Recording"}</span>
          <h2>{where}</h2>
        </div>
        {t.status === "ready" && <button className="xbtn" aria-label="Close" onClick={() => closeTracker()}>&times;</button>}
      </div>

      {t.status === "ready" ? (
        <div className="trk-ready">
          {/* What you're about to do, as the same orange card Home uses for today's session. */}
          {(() => {
            const m = t.target?.title.match(/^(.*?)\s([\d.]+)\s(min|mi)$/);
            return (
              <section className="hero trk-plan">
                <span className="lbl">{t.target && !mismatch ? "Today's session" : "Free workout"}</span>
                <span className="ht">{mismatch ? KINDS.find(([k]) => k === t.kind)![1] : m ? <>{m[1]} <span className="nw">{m[2]}<small>{m[3]}</small></span></> : t.target?.title ?? KINDS.find(([k]) => k === t.kind)![1]}</span>
                {mismatch ? <p>Saves as an extra activity. Today's {t.target!.title.toLowerCase()} stays open. Switch back to {day!.c.kind === "bike" ? "Bike" : "Walk"} to track it.</p> : t.target?.instructions ? <p>{t.target.instructions}</p> : <p>Track anything. It saves as an extra activity.</p>}
              </section>
            );
          })()}

          <span className="lbl">Activity</span>
          <div className="trk-kinds" role="radiogroup" aria-label="Activity">
            {KINDS.map(([k, l]) => {
              const I = k === "bike" ? Icon.bike : Icon.shoe;
              return <button key={k} role="radio" aria-checked={t.kind === k} className={t.kind === k ? "sel" : ""} onClick={() => setTrackKind(k)}><I /><b>{l}</b>{k === recKind && <small className="rec">Recommended</small>}</button>;
            })}
          </div>

          <span className="lbl">Where</span>
          <div className="trk-modes" role="radiogroup" aria-label="Where">
            <button role="radio" aria-checked={!indoor} className={!indoor ? "sel" : ""} onClick={() => setTrackMode("gps")}>
              <span className="ic"><Icon.pin /></span>
              <b>Outdoors</b><small>GPS: distance, pace, route</small>
            </button>
            <button role="radio" aria-checked={indoor} className={indoor ? "sel" : ""} onClick={() => setTrackMode("indoor")}>
              <span className="ic"><Icon.home /></span>
              <b>Indoors</b><small>{bike ? "Trainer: type the distance after" : canCountSteps ? "Treadmill or pacing: counts steps" : "Treadmill: type the distance after"}</small>
            </button>
          </div>
          <p className="setnote">
            {indoor
              ? bike || !canCountSteps ? "No GPS. You can type the distance from the machine when you finish."
                : stride.learned ? `Distance comes from your steps (your stride: ${Math.round(stride.meters * 100)} cm, learned from your outdoor walks). You can correct it at the end.`
                  : "Distance comes from your steps, using an average stride until a couple of outdoor walks teach the app yours. You can correct it at the end."
              : canTrackInBackground ? "Keeps recording with your screen off. Android shows a notice while it does." : "On the website, keep this screen open while you go. The Android app records with the screen off."}
          </p>
          {t.intervals && (
            <div className="trk-ivinfo">
              <b>Interval coaching on</b>
              <span>{t.intervals.rounds} rounds. You'll hear "Jog now" and "Walk now" and feel a buzz at each switch, so you never need to look.</span>
              <label><input type="checkbox" checked={t.voice} onChange={(e) => setVoice(e.target.checked)} /> Voice cues</label>
            </div>
          )}
          {import.meta.env.DEV && !indoor && <label className="trk-sim"><input type="checkbox" checked={t.simulate} onChange={(e) => setSimulate(e.target.checked)} /> Simulated walk (testing)</label>}
          <button className="trk-go" onClick={() => startTracking()}><span className="trk-go-ic"><Icon.play /></span><span>Start</span></button>
        </div>
      ) : (
        <>
          {t.intervals && s && t.status !== "done" && (() => {
            const at = intervalAt(t.intervals, s.elapsedS), seg = at.segment;
            const label = { warmup: "Warm-up walk", jog: "Jog", walk: "Walk", cooldown: "Cool down" }[seg.kind];
            return (
              <div className={"trk-iv " + seg.kind}>
                <div><b>{label}</b><small>{seg.round ? `Round ${seg.round} of ${t.intervals.rounds}` : seg.kind === "cooldown" ? "Intervals done. Finish when you're ready." : "Then the intervals start"}</small></div>
                {at.left != null && <span className="num">{hms(Math.ceil(at.left))}</span>}
                <button className="trk-voice" aria-pressed={t.voice} aria-label={t.voice ? "Voice cues on" : "Voice cues off"} onClick={() => setVoice(!t.voice)}>{t.voice ? "Voice on" : "Voice off"}</button>
              </div>
            );
          })()}
          {/* The live card: distance big, the rest underneath, like Home's today card. Stripes drift while moving. */}
          <section className={"hero trk-hero " + t.status}>
            <span className="lbl">{bike ? "Ride" : t.kind === "run" ? "Walk/run" : "Walk"}{indoor ? ", indoors" : ""}</span>
            <span className="ht"><span className="nw">{miles.toFixed(2)}<small>{indoor && miles > 0 ? "mi est." : "mi"}</small></span></span>
            <div className="hstats trk-hstats">
              <div><span className="num">{hms(s?.elapsedS ?? 0)}</span><span className="lbl">{!indoor && s && s.movingS !== s.elapsedS ? `${hms(s.movingS)} moving` : "Time"}</span></div>
              <div><span className="num">{bike ? mph.toFixed(1) : pace(paceS)}</span><span className="lbl">{bike ? "Avg mph" : "Avg pace"}</span></div>
              {/* Steps count on foot in both modes (the phone's step counter; the website can't read it). */}
              {!bike && canCountSteps && <div><span className="num">{t.steps.toLocaleString("en-US")}</span><span className="lbl">Steps</span></div>}
            </div>
          </section>
          {!indoor && t.track && <RouteMapView className="trk-map" points={t.track.route} live={t.status !== "done"} />}
          {t.error === "denied" ? (
            <div className="trk-msg bad">
              Location is off for Not a Runner, so distance can't be tracked. Time still counts.
              {canTrackInBackground && <button className="chip" onClick={() => openLocationSettings()}>Open settings</button>}
            </div>
          ) : t.error === "unavailable" || waiting ? (
            <div className="trk-msg">Looking for GPS. Indoors or under cover, distance may not count; time still does.</div>
          ) : null}
          {s && s.splitS.length > 0 && (
            <ol className="trk-splits" aria-label="Mile splits">
              {s.splitS.map((v, i) => <li key={i}><span>Mile {i + 1}</span><b>{bike ? `${(3600 / v).toFixed(1)} mph` : hms(v)}</b></li>)}
            </ol>
          )}

          {t.status === "done" ? (
            <div className="trk-save">
              <label className="trk-dist">
                <span>{indoor ? "Distance" : "Distance (GPS)"}<small>{indoor && !bike && canCountSteps ? "Estimated from your steps. Type the treadmill's number if you have it." : indoor ? "Type it from the machine, or leave it empty." : "Change it if the GPS got it wrong."}</small></span>
                <span className="unitin"><input type="number" inputMode="decimal" min="0" max="200" step="0.01" placeholder={trackResult(state, t.track!, now, { indoor, steps: t.steps }).dist.toFixed(2)} value={typed} onChange={(e) => setTyped(e.target.value)} /><em>mi</em></span>
              </label>
              <span className="lbl">How did it feel?</span>
              <FeelPicker value={feel} onPick={setFeel} />
              {day && (
                <label className="trk-extra"><input type="checkbox" checked={saveAsExtra} onChange={(e) => setSaveAsExtra(e.target.checked)} /> Save as an extra activity instead</label>
              )}
              {already && !saveAsExtra && <p className="warn">You already logged this session. Saving replaces that log.</p>}
              <button className="btn solid" onClick={save}>
                {saveAsExtra || !day ? "Save as extra activity" : already ? "Replace the log" : "Save to your plan"}
              </button>
              {(() => { const r = trackResult(state, t.track!, now, extras); return <p className="setnote">Saving logs {r.dist ? `${r.dist} mi in ` : ""}{hms(r.time)}{t.steps ? `, ${t.steps.toLocaleString("en-US")} steps` : ""}.</p>; })()}
              <ConfirmButton className="btn small" label="Discard" confirmLabel="Discard this workout?" onConfirm={() => closeTracker()} />
            </div>
          ) : (
            <div className="trk-ctrl">
              {t.status === "recording"
                ? <button className="trk-btn" onClick={() => pauseTracking()}><Icon.pause /><span>Pause</span></button>
                : <button className="trk-btn go" onClick={() => resumeTracking()}><Icon.play /><span>Resume</span></button>}
              <ConfirmButton className="trk-btn finish" label="Finish" confirmLabel="Tap to finish" onConfirm={() => finishTracking()} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
