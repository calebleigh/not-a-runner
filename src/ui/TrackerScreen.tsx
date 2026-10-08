import { useEffect, useState } from "react";
import { DN, dayAt, fmtShort, hms, intervalAt, saveTrack, trackResult, trackStats, type Feel, type TrackKind } from "../training";
import { canTrackInBackground, openLocationSettings } from "../native/location";
import { newId } from "../sync/engine";
import { useApp } from "./app-state";
import { ConfirmButton, FeelPicker } from "./cards";
import { Icon } from "./icons";
import {
  closeTracker, finishTracking, pauseTracking, resumeAfterReload, resumeTracking, setSimulate, setTrackKind, setVoice, startTracking, useTracker,
} from "./tracker";

const KINDS: [TrackKind, string][] = [["walk", "Walk"], ["run", "Walk/run"], ["bike", "Bike"]];
const pace = (s: number | null) => (s ? hms(s) : "--:--");

/** Full-screen workout tracker: ready, recording, then a summary to save. */
export function TrackerScreen() {
  const t = useTracker();
  const { model, state, update, toast } = useApp();
  const [, tick] = useState(0);
  const [feel, setFeel] = useState<Feel | undefined>();
  const [saveAsExtra, setSaveAsExtra] = useState(false);

  // The clock moves every second while recording; GPS fixes don't arrive on a beat.
  useEffect(() => {
    if (t?.status !== "recording" && t?.status !== "paused") return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [t?.status]);
  useEffect(() => { resumeAfterReload(); }, []);
  useEffect(() => { if (t?.status === "ready") { setFeel(undefined); setSaveAsExtra(false); } }, [t?.status]);

  if (!t) return null;
  const day = t.target ? dayAt(model, t.target.w, t.target.d) : undefined;
  const already = !!day && !!state.done[day.ids[0]];
  const where = day ? `${DN[t.target!.d]} ${fmtShort(day.date)}: ${t.target!.title}` : "Extra activity, today";
  const now = t.finishedAt ?? Date.now();
  const s = t.track ? trackStats(t.track, now) : null;
  const bike = t.kind === "bike";
  const waiting = t.status === "recording" && !t.simulate && (!t.lastFixAt || Date.now() - t.lastFixAt > 15_000);

  const save = () => {
    if (!t.track || !t.finishedAt) return;
    const target = saveAsExtra || !t.target ? null : t.target;
    update((draft) => { saveTrack(draft, model, { track: t.track!, finishedAt: t.finishedAt!, feel, target, date: new Date(t.track!.startedAt), newId }); });
    toast(target && day ? "Saved to your plan. Nice work." : "Saved as an extra activity.");
    closeTracker();
  };

  return (
    <div className="tracker" role="dialog" aria-label="Workout tracker">
      <div className="trk-top">
        <div>
          <span className="lbl">{t.status === "done" ? "Finished" : t.status === "ready" ? "Ready" : t.status === "paused" ? "Paused" : "Recording"}</span>
          <h2>{where}</h2>
        </div>
        {t.status === "ready" && <button className="xbtn" aria-label="Close" onClick={() => closeTracker()}>&times;</button>}
      </div>

      {t.status === "ready" ? (
        <div className="trk-ready">
          <div className="seg" role="radiogroup" aria-label="Activity">
            {KINDS.map(([k, l]) => <button key={k} role="radio" aria-checked={t.kind === k} className={t.kind === k ? "sel" : ""} onClick={() => setTrackKind(k)}>{l}</button>)}
          </div>
          <p className="setnote">{canTrackInBackground ? "Keeps recording with your screen off. Android shows a notice while it does." : "On the website, keep this screen open while you go. The Android app records with the screen off."}</p>
          {t.intervals && (
            <div className="trk-ivinfo">
              <b>Interval coaching on</b>
              <span>{t.intervals.rounds} rounds. You'll hear "Jog now" and "Walk now" and feel a buzz at each switch, so you never need to look.</span>
              <label><input type="checkbox" checked={t.voice} onChange={(e) => setVoice(e.target.checked)} /> Voice cues</label>
            </div>
          )}
          {import.meta.env.DEV && <label className="trk-sim"><input type="checkbox" checked={t.simulate} onChange={(e) => setSimulate(e.target.checked)} /> Simulated walk (testing)</label>}
          <button className="trk-go" onClick={() => startTracking()}><Icon.play /><span>Start</span></button>
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
          <div className="trk-time">
            <span className="num">{hms(s?.elapsedS ?? 0)}</span>
            <small>{s && s.movingS !== s.elapsedS ? `${hms(s.movingS)} moving` : "Time"}</small>
          </div>
          <div className="trk-nums">
            <div><span className="num">{(s?.miles ?? 0).toFixed(2)}</span><small>Miles</small></div>
            <div><span className="num">{bike ? (s?.mph ?? 0).toFixed(1) : pace(s?.paceS ?? null)}</span><small>{bike ? "Avg mph" : "Avg pace /mi"}</small></div>
          </div>
          {t.error === "denied" ? (
            <div className="trk-msg bad">
              Location is off for Not a Runner, so distance can't be tracked. Time still counts.
              {canTrackInBackground && <button className="chip" onClick={() => openLocationSettings()}>Open settings</button>}
            </div>
          ) : t.error === "unavailable" || waiting ? (
            <div className="trk-msg">Looking for GPS. Indoors or under cover, distance may not count; time still does.</div>
          ) : null}
          {s && s.splitS.length > 0 && (
            <ol className="trk-splits">
              {s.splitS.map((v, i) => <li key={i}><span>Mile {i + 1}</span><b>{bike ? `${(3600 / v).toFixed(1)} mph` : hms(v)}</b></li>)}
            </ol>
          )}

          {t.status === "done" ? (
            <div className="trk-save">
              <span className="lbl">How did it feel?</span>
              <FeelPicker value={feel} onPick={setFeel} />
              {day && (
                <label className="trk-extra"><input type="checkbox" checked={saveAsExtra} onChange={(e) => setSaveAsExtra(e.target.checked)} /> Save as an extra activity instead</label>
              )}
              {already && !saveAsExtra && <p className="warn">You already logged this session. Saving replaces that log.</p>}
              <button className="btn solid" onClick={save}>
                {saveAsExtra || !day ? "Save as extra activity" : already ? "Replace the log" : "Save to your plan"}
              </button>
              <p className="setnote">Saving logs {trackResult(t.track!, now).dist ? `${trackResult(t.track!, now).dist} mi in ` : ""}{hms(trackResult(t.track!, now).time)}.</p>
              <ConfirmButton className="btn small" label="Discard" confirmLabel="Discard this workout?" onConfirm={() => closeTracker()} />
            </div>
          ) : (
            <div className="trk-ctrl">
              {t.status === "recording"
                ? <button className="trk-btn" onClick={() => pauseTracking()}>Pause</button>
                : <button className="trk-btn go" onClick={() => resumeTracking()}>Resume</button>}
              <ConfirmButton className="trk-btn finish" label="Finish" confirmLabel="Tap to finish" onConfirm={() => finishTracking()} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
