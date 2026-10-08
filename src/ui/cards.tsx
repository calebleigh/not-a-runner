import { newId } from "../sync/engine";
import { openTracker } from "./tracker";
import { Icon } from "./icons";
import { trackKindFor } from "./trackFor";
import { useEffect, useRef, useState } from "react";
import {
  DN, FEEL, HOW, STEPS_PER_MI, cardioCal, dayAt, dayKey, extrasFor, fmtLong, fmtShort, hms, loggedFootSteps, mph, pace,
  CARDIO_EXTRA_KINDS, EXTRA_KINDS, applyExtraAsCardio, canUseAsCardio, makeUpTarget, extraCal, extraKind, parseDayKey, phaseOf, sameDay, statKind, type Cardio, type Extra, type ExtraKind, type Feel,
} from "../training";
import { useApp } from "./app-state";

/** Focus the first input inside `ref` once the sheet has slid in. */
export function useSheetFocus<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => {
      const n = ref.current;
      if (!n) return;
      n.scrollIntoView({ block: "nearest", behavior: "smooth" });
      n.querySelector("input")?.focus({ preventScroll: true });
    }, 380);
    return () => clearTimeout(id);
  }, [enabled]);
  return ref;
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

/** Deletes need two taps: the first arms the button (red, "Confirm"), the second acts. */
export function ConfirmButton({ className, label, confirmLabel, onConfirm }: { className: string; label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={className + (armed ? " confirm" : "")} onBlur={() => setArmed(false)}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? confirmLabel : label}
    </button>
  );
}

export function MarkBtn({ id }: { id: string }) {
  const { state, update } = useApp();
  const on = !!state.done[id];
  if (on) return <ConfirmButton className="btn solid" label="Done" confirmLabel="Confirm undo" onConfirm={() => update((s) => { delete s.done[id]; })} />;
  return <button className="btn" onClick={() => update((s) => { s.done[id] = 1; })}>Mark done</button>;
}

export function FeelPicker({ value, onPick }: { value?: Feel; onPick: (f: Feel) => void }) {
  return (
    <div className="feel">
      {(Object.keys(FEEL) as Feel[]).map((k) => (
        <button key={k} className={value === k ? "sel" : ""} aria-pressed={value === k} onClick={() => onPick(k)}>{FEEL[k]}</button>
      ))}
    </div>
  );
}

/** An extra being moved into this cardio slot. */
export interface FromExtra { w: number; d: number; index: number; extra: Extra }

function LogForm({ id, c, onClose, from }: { id: string; c: Cardio; onClose: () => void; from?: FromExtra }) {
  const { state, update } = useApp();
  const lg = state.logs[id] ?? (from ? { dist: from.extra.dist, time: from.extra.time, at: 0 } : undefined);
  const t = lg?.time || 0;
  const [dist, setDist] = useState(lg?.dist ? String(lg.dist) : c.kind === "test" && !lg ? "1" : "");
  const [min, setMin] = useState(t ? String(Math.floor(t / 60)) : "");
  const [sec, setSec] = useState(t ? String(Math.round(t % 60)) : "");
  const [hr, setHr] = useState(lg?.hr ? String(lg.hr) : "");
  const [feel, setFeel] = useState<Feel>(lg?.feel || "ok");
  const ref = useSheetFocus<HTMLDivElement>(true);
  const save = () => {
    const d = num(dist) || 0, m = Math.floor(num(min)) || 0, s = Math.floor(num(sec)) || 0, h = Math.floor(num(hr)) || 0;
    const log = { dist: Math.round(d * 100) / 100, time: m * 60 + s, feel, ...(h ? { hr: h } : {}) };
    update((st) => {
      if (from && applyExtraAsCardio(st, from.w, from.d, from.index, from.extra, c.kind, log, Date.now(), Number(id.split("-")[1]))) return;
      st.logs[id] = { ...log, at: Date.now() };
      st.done[id] = 1;
    });
    onClose();
  };
  return (
    <div className="logform" ref={ref}>
      <div className="fields">
        <label>Miles<input type="number" inputMode="decimal" step="0.01" min="0" value={dist} onChange={(e) => setDist(e.target.value)} /></label>
        <label>Minutes<input type="number" inputMode="numeric" min="0" value={min} onChange={(e) => setMin(e.target.value)} /></label>
        <label>Seconds<input type="number" inputMode="numeric" min="0" max="59" value={sec} onChange={(e) => setSec(e.target.value)} /></label>
        <label>Avg HR<input type="number" inputMode="numeric" min="0" max="230" placeholder="bpm" value={hr} onChange={(e) => setHr(e.target.value)} /></label>
      </div>
      <FeelPicker value={feel} onPick={setFeel} />
      <div className="row2">
        <button className="btn solid" onClick={save}>Save</button>
        <button className="btn small" style={{ marginTop: 14 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export function CardioCard({ w, d, startOpen = false, fromExtra, fromD }: { w: number; d: number; startOpen?: boolean; fromExtra?: number; fromD?: number }) {
  const { model, state, update, closeSheet } = useApp();
  const day = dayAt(model, w, d)!;
  const id = day.ids[0], c = day.c, lg = state.logs[id], isDone = !!state.done[id];
  const srcD = fromD ?? d;
  const extra = fromExtra !== undefined && !isDone ? extrasFor(state, w, srcD)[fromExtra] : undefined;
  const [from] = useState<FromExtra | undefined>(extra && { w, d: srcD, index: fromExtra!, extra });
  const [formOpen, setFormOpen] = useState<boolean>(startOpen && !isDone);
  const swapOpts: [("bike" | "walk" | "run"), string][] = [["bike", "Bike"], ["walk", "Walk"]];
  if (phaseOf(model.spec, w) >= 1) swapOpts.push(["run", "Walk/run"]);
  const kind = statKind(c.kind);

  return (
    <section className={"card" + (isDone ? " done" : "")}>
      <h2>{DN[d]} {fmtShort(day.date)}, cardio</h2>
      <h3>{c.t}</h3>
      <p>{c.d}</p>
      {c.shoes && !state.gear.shoes && !isDone && <p className="warn">No running shoes marked yet. Walk this one instead, and get fitted soon.</p>}
      {c.kind === "rest" || c.kind === "race" ? <MarkBtn id={id} /> : (
        <>
          {!isDone && !formOpen && (
            <div className="swaps">
              {c.orig ? (
                <button onClick={() => update((s) => { delete s.swaps[id]; })}>Undo swap</button>
              ) : (
                <>
                  <span>Swap to</span>
                  {swapOpts.filter(([k]) => !(k === c.kind || (k === "run" && ["run", "long", "test"].includes(c.kind)))).map(([k, l]) => (
                    <button key={k} onClick={() => update((s) => { s.swaps[id] = k; })}>{l}</button>
                  ))}
                </>
              )}
            </div>
          )}
          {lg?.time && !formOpen ? (
            <div className="logged">
              {lg.dist ? `${lg.dist} mi in ` : ""}{hms(lg.time)}
              <small>{[lg.dist ? (c.kind === "bike" ? mph(lg.time, lg.dist) : pace(lg.time, lg.dist)) : null, lg.hr ? `${lg.hr} bpm` : null, `~${cardioCal(state, kind, lg, w)} cal`, lg.feel ? "Felt " + FEEL[lg.feel].toLowerCase() : null].filter(Boolean).join(", ")}</small>
            </div>
          ) : null}
          {formOpen && from && !isDone && <p className="fromx">From your extra activity: {from.extra.kind === "bike" ? "Bike" : "Walk"}{from.extra.label ? `, ${from.extra.label}` : ""}. Saving moves it here.</p>}
          {formOpen ? <LogForm id={id} c={c} from={isDone ? undefined : from} onClose={() => setFormOpen(false)} /> : isDone ? (
            <div className="row2">
              <button className="btn small" onClick={() => setFormOpen(true)}>{lg ? "Edit log" : "Add details"}</button>
              <ConfirmButton className="btn small" label="Undo" confirmLabel="Confirm undo" onConfirm={() => update((s) => { delete s.done[id]; delete s.logs[id]; })} />
            </div>
          ) : (
            <div className="row2">
              <button className="btn solid" onClick={() => setFormOpen(true)}>Log it</button>
              <button className="btn" onClick={() => { closeSheet(); openTracker(trackKindFor(c.kind), { w, d, title: c.t, instructions: c.d }); }}><Icon.play /> Track it</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function StrengthCard({ w, d }: { w: number; d: number }) {
  const { model, state, update } = useApp();
  const day = dayAt(model, w, d)!;
  const id = day.ids[1], st = day.st!, isDone = !!state.done[id], lg = state.logs[id];
  return (
    <section className={"card" + (isDone ? " done" : "")}>
      <h2>Strength, about {st.min} min</h2>
      <h3>{st.title}</h3>
      <p>{st.sets}</p>
      <div className="ex">
        {st.ex.map((e, i) => (
          <details key={i}>
            <summary><b>{e.name}</b><span>{e.seconds ? `${e.amount} sec` : e.amount}{e.unit}</span></summary>
            <div className="how">{HOW[e.name] || ""}</div>
          </details>
        ))}
      </div>
      {st.light ? <MarkBtn id={id} /> : isDone ? (
        <>
          <div className="logged">{lg?.feel ? `Felt ${FEEL[lg.feel].toLowerCase()}` : "Done"}</div>
          <ConfirmButton className="btn small" label="Undo" confirmLabel="Confirm undo" onConfirm={() => update((s) => { delete s.done[id]; delete s.logs[id]; })} />
        </>
      ) : (
        <>
          <p style={{ marginTop: 14 }}>Done? How did it feel?</p>
          <FeelPicker onPick={(k) => update((s) => { s.done[id] = 1; s.logs[id] = { feel: k, at: Date.now() }; })} />
        </>
      )}
    </section>
  );
}

export function WeighCard({ week, focus = false }: { week: number; focus?: boolean }) {
  const { state, update } = useApp();
  const cur = state.weights[week];
  const prev = Object.entries(state.weights).map(([w, v]) => [+w, v] as const).filter(([w]) => w < week).sort((a, b) => a[0] - b[0]).pop();
  const [v, setV] = useState(cur ? String(cur) : "");
  const ref = useSheetFocus<HTMLElement>(focus);
  const diff = cur && prev ? cur - prev[1] : 0;
  return (
    <section className={"card" + (cur ? " done" : "")} ref={ref}>
      <h2>Monday weigh-in</h2>
      <h3>{cur ? `${cur} lb` : "Step on the scale"}</h3>
      <p>{cur && prev ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)} lb since week ${prev[0]}. Weekly numbers bounce around; the trend is what matters.` : "First thing in the morning, before eating, same scale each week."}</p>
      <div className="wtrow">
        <input className="wtin" type="number" inputMode="decimal" step="0.1" placeholder="lb" aria-label="Weight in pounds" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn solid" onClick={() => { const x = parseFloat(v); if (x > 50 && x < 600) update((s) => { s.weights[week] = Math.round(x * 10) / 10; }); }}>Save</button>
      </div>
    </section>
  );
}

export function StepsCard({ date }: { date: Date }) {
  const { model, state, update } = useApp();
  const key = dayKey(model.spec, date), [n, d] = parseDayKey(key), cur = state.steps[key];
  const [v, setV] = useState(cur ? String(cur) : "");
  const fs = loggedFootSteps(state, n, d);
  const label = sameDay(date, model.today) ? "Today's steps" : fmtLong(date) + " steps";
  return (
    <section className={"card" + (cur ? " done" : "")}>
      <h2>{label}</h2>
      <h3>{cur ? `${cur.toLocaleString("en-US")} steps` : "Enter your total from Samsung Health"}</h3>
      <p>{cur ? (fs ? `~${fs.toLocaleString("en-US")} from logged activity, ${Math.max(0, cur - fs).toLocaleString("en-US")} from everyday moving.` : "Tracked on its own, never added to miles or calories.") : "The full day's total from Samsung Health. Don't subtract anything."}</p>
      <div className="wtrow">
        <input className="wtin" type="number" inputMode="numeric" min="0" max="100000" placeholder="steps" aria-label="Steps" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn solid" onClick={() => { const x = parseInt(v); if (x >= 0 && x <= 100000) update((s) => { if (x) s.steps[key] = x; else delete s.steps[key]; }); }}>Save</button>
      </div>
    </section>
  );
}

/** Quick steps entry used from Home, the log sheet and the steps chart. */
export function StepsEntry({ date, onDone }: { date: Date; onDone: () => void }) {
  const { model, state, update } = useApp();
  const key = dayKey(model.spec, date), cur = state.steps[key];
  const [v, setV] = useState(cur ? String(cur) : "");
  const ref = useSheetFocus<HTMLDivElement>(true);
  const save = () => { const x = parseInt(v); update((s) => { if (x > 0 && x <= 100000) s.steps[key] = x; else delete s.steps[key]; }); onDone(); };
  return (
    <div ref={ref}>
      <p className="lead">Total from Samsung Health for the whole day.</p>
      <div className="wtrow">
        <input className="wtin" style={{ flex: 1, width: "auto" }} type="number" inputMode="numeric" min="0" max="100000" placeholder="steps" aria-label="Steps" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        <button className="btn solid" onClick={save}>Save</button>
      </div>
    </div>
  );
}

function ExtraForm({ onSave, onCancel }: { onSave: (e: Extra) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<ExtraKind>("walk");
  const [label, setLabel] = useState("");
  const [steps, setSteps] = useState("");
  const [dist, setDist] = useState("");
  const [mins, setMins] = useState("");
  const ref = useSheetFocus<HTMLDivElement>(true);
  const onFoot = EXTRA_KINDS[kind].onFoot;
  const save = () => {
    const st = parseInt(steps) || 0, ds = parseFloat(dist) || 0, m = parseInt(mins) || 0;
    if (!ds && !m) return;
    const e: Extra = { kind, dist: Math.round(ds * 100) / 100, time: m * 60 };
    if (st) e.steps = st;
    if (label.trim()) e.label = label.trim();
    onSave(e);
  };
  return (
    <div className="logform" ref={ref}>
      <div className="kinds" role="radiogroup" aria-label="Activity">
        {(Object.keys(EXTRA_KINDS) as ExtraKind[]).map((k) => (
          <button key={k} role="radio" className={kind === k ? "sel" : ""} aria-checked={kind === k} onClick={() => { setKind(k); if (!EXTRA_KINDS[k].onFoot) setSteps(""); }}>{EXTRA_KINDS[k].label}</button>
        ))}
      </div>
      <label className="xtl">Title (optional)<input className="xt" type="text" maxLength={40} placeholder={`Evening ${EXTRA_KINDS[kind].label.toLowerCase()}`} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <div className={"fields " + (onFoot ? "three" : "two")}>
        {onFoot && <label>Steps<input type="number" inputMode="numeric" min="0" placeholder="optional" value={steps} onChange={(e) => { setSteps(e.target.value); const v = parseInt(e.target.value) || 0; if (v) setDist((v / STEPS_PER_MI).toFixed(2)); }} /></label>}
        <label>Miles{!onFoot && kind !== "bike" ? " (optional)" : ""}<input type="number" inputMode="decimal" step="0.01" min="0" value={dist} onChange={(e) => setDist(e.target.value)} /></label>
        <label>Minutes moving<input type="number" inputMode="numeric" min="0" value={mins} onChange={(e) => setMins(e.target.value)} /></label>
      </div>
      <p style={{ fontSize: 14 }}>{onFoot ? "Enter steps and miles fill in for you. " : ""}For minutes, count only time spent moving.</p>
      <div className="row2">
        <button className="btn solid" onClick={save}>Save</button>
        <button className="btn small" style={{ marginTop: 14 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function ExtraSection({ w, d, startOpen = false }: { w: number; d: number; startOpen?: boolean }) {
  const { model, state, update, openSheet } = useApp();
  const key = `${w}-${d}`, list = extrasFor(state, w, d);
  const canUse = canUseAsCardio(state, w, d, dayAt(model, w, d)?.c.kind);
  // On a day off, a walk or ride can make up a session missed earlier this week.
  const makeUp = !dayAt(model, w, d) ? makeUpTarget(model, w, d) : null;
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="card">
      <h2>Extra activity</h2>
      <p>Walks, hikes, rides, anything outside the plan.</p>
      {list.map((x, i) => (
        <div className="lvl" key={i}>
          <div>
            <b>{extraKind(x.kind).label}{x.label ? ": " + x.label : ""}</b>
            <small>{[x.steps ? `${x.steps.toLocaleString("en-US")} steps` : null, x.dist ? `${x.dist} mi` : null, x.time ? `${Math.round(x.time / 60)} min` : null, `~${extraCal(state, x, w)} cal`].filter(Boolean).join(", ")}</small>
          </div>
          <div className="xact">
            {canUse && CARDIO_EXTRA_KINDS.includes(x.kind) && <button className="btn small inline use" onClick={() => openSheet({ kind: "cardio", w, d, fromExtra: i })}>Use as cardio</button>}
            {makeUp && CARDIO_EXTRA_KINDS.includes(x.kind) && <button className="btn small inline use" onClick={() => openSheet({ kind: "cardio", w, d: makeUp.d, fromExtra: i, fromD: d })}>Make up {DN[makeUp.d]}</button>}
            <ConfirmButton className="btn small inline" label="Remove" confirmLabel="Confirm remove"
              onConfirm={() => update((s) => { const l = [...(s.extras[key] || [])]; l.splice(i, 1); if (l.length) s.extras[key] = l; else delete s.extras[key]; })} />
          </div>
        </div>
      ))}
      {open ? (
        <ExtraForm onCancel={() => setOpen(false)} onSave={(e) => { update((s) => { s.extras[key] = [...(s.extras[key] || []), { ...e, id: newId(), at: Date.now() }]; }); setOpen(false); }} />
      ) : (
        <button className="btn" onClick={() => setOpen(true)}>+ Add extra activity</button>
      )}
    </section>
  );
}
