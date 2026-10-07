import { useEffect, useRef, useState, type ReactNode } from "react";
import { dayAt, dayKey, decodeBackup, encodeBackup, fmtLong, kfmt, parseDayKey, sameDay, todayDay } from "../training";
import { useApp, type SheetSpec } from "./app-state";
import { CardioCard, ExtraSection, StepsCard, StepsEntry, StrengthCard, WeighCard } from "./cards";
import { Icon } from "./icons";

export function SheetHost() {
  const { sheet, closeSheet } = useApp();
  // Keep the last sheet mounted while it slides out.
  const [shown, setShown] = useState<SheetSpec | null>(sheet);
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (sheet) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setShown(sheet);
      const id = requestAnimationFrame(() => setOpen(true));
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
    lastFocus.current?.focus?.({ preventScroll: true });
    const t = window.setTimeout(() => setShown(null), 380);
    return () => clearTimeout(t);
  }, [sheet]);

  useEffect(() => {
    document.body.classList.toggle("locked", !!sheet);
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheet, closeSheet]);

  // Drag down to close.
  useEffect(() => {
    const S = bodyRef.current;
    if (!S) return;
    let y0: number | null = null;
    const start = (e: TouchEvent) => { if (S.scrollTop <= 0) y0 = e.touches[0].clientY; };
    const move = (e: TouchEvent) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy > 0) { S.style.transition = "none"; S.style.transform = `translateY(${dy}px)`; }
    };
    const end = (e: TouchEvent) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0;
      S.style.transition = ""; S.style.transform = "";
      if (dy > 110) closeSheet();
      y0 = null;
    };
    S.addEventListener("touchstart", start, { passive: true });
    S.addEventListener("touchmove", move, { passive: true });
    S.addEventListener("touchend", end);
    return () => { S.removeEventListener("touchstart", start); S.removeEventListener("touchmove", move); S.removeEventListener("touchend", end); };
  }, [closeSheet]);

  const content = shown ? <SheetContent spec={shown} /> : null;
  return (
    <div className={"sheet" + (open ? " open" : "")} role="dialog" aria-modal="true" aria-labelledby="sheetTitle" aria-hidden={!sheet} inert={!sheet}
      onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}>
      <div className="sheet-body" ref={bodyRef}>
        <div className="grabber" aria-hidden="true" />
        {content}
      </div>
    </div>
  );
}

function Head({ title }: { title: string }) {
  const { closeSheet } = useApp();
  return (
    <div className="sheet-head">
      <h2 id="sheetTitle">{title}</h2>
      <button className="xbtn" aria-label="Close" onClick={closeSheet}>&#10005;</button>
    </div>
  );
}

function SheetContent({ spec }: { spec: SheetSpec }) {
  const { model } = useApp();
  const dayTitle = (w: number, d: number) => { const dt = dayAt(model, w, d)!.date; return sameDay(dt, model.today) ? "Today" : fmtLong(dt); };
  // Key by spec so forms reset when a different sheet opens.
  const key = JSON.stringify(spec);
  let title: string, body: ReactNode;
  switch (spec.kind) {
    case "day": {
      const { w, d } = spec, day = dayAt(model, w, d)!;
      title = dayTitle(w, d);
      body = <>
        {d === 0 && <WeighCard week={w} />}
        <CardioCard w={w} d={d} />
        {day.st && <StrengthCard w={w} d={d} />}
        <ExtraSection w={w} d={d} />
        {day.date <= model.today && <StepsCard date={day.date} />}
      </>;
      break;
    }
    case "cardio":
      title = dayTitle(spec.w, spec.d) + ", cardio";
      body = <CardioCard w={spec.w} d={spec.d} startOpen fromExtra={spec.fromExtra} />;
      break;
    case "strength":
      title = dayTitle(spec.w, spec.d) + ", strength";
      body = <StrengthCard w={spec.w} d={spec.d} />;
      break;
    case "steps":
      title = sameDay(spec.date, model.today) ? "Today's steps" : fmtLong(spec.date);
      body = <StepsSheetBody date={spec.date} />;
      break;
    case "weigh":
      title = "Weigh-in";
      body = <WeighCard week={model.curWeek} focus />;
      break;
    case "extra": {
      const [w, d] = parseDayKey(dayKey(spec.date));
      title = "Extra activity";
      body = <ExtraSection w={w} d={d} startOpen />;
      break;
    }
    case "log":
      title = "Log";
      body = <LogTiles />;
      break;
    case "export":
      title = "Export backup";
      body = <ExportBody />;
      break;
    case "import":
      title = "Import backup";
      body = <ImportBody />;
      break;
  }
  return <div key={key}><Head title={title} />{body}</div>;
}

function StepsSheetBody({ date }: { date: Date }) {
  const { closeSheet } = useApp();
  return <StepsEntry date={date} onDone={closeSheet} />;
}

function LogTiles() {
  const { model, state, openSheet, closeSheet } = useApp();
  const { curWeek, todayIdx, today, dow, rawWeek } = model;
  const day = todayDay(model);
  const wk = model.weeks[curWeek - 1];
  const Tile = ({ onClick, ic, title, sub, ok, wide }: { onClick: () => void; ic: ReactNode; title: string; sub: string; ok?: boolean; wide?: boolean }) => (
    <button className={"ltile" + (ok ? " ok" : "") + (wide ? " wide" : "")} onClick={onClick}>
      <span className="ic">{ok ? <Icon.check /> : ic}</span>
      <span><b>{title}</b><span>{sub}</span></span>
    </button>
  );
  const st = state.steps[dayKey(today)];
  const missed = wk.days.find((x) => x.date < today && !state.done[x.ids[0]]);
  return (
    <div className="lgrid">
      {day ? <>
        <Tile onClick={() => openSheet({ kind: "cardio", w: curWeek, d: todayIdx })} ic={<Icon.shoe />} title={day.c.t} sub={state.done[day.ids[0]] ? "Logged, tap to edit" : "Today's cardio"} ok={!!state.done[day.ids[0]]} />
        {day.st && <Tile onClick={() => openSheet({ kind: "strength", w: curWeek, d: todayIdx })} ic={<Icon.dumbbell />} title={day.st.title} sub={state.done[day.ids[1]] ? "Done" : "Today's strength"} ok={!!state.done[day.ids[1]]} />}
      </> : (
        <Tile onClick={() => (missed ? openSheet({ kind: "day", w: curWeek, d: missed.d }) : closeSheet())} ic={<Icon.shoe />} title="Make-up workout" sub="Pick a missed day" />
      )}
      <Tile onClick={() => openSheet({ kind: "steps", date: today })} ic={<Icon.steps />} title={st ? kfmt(st) + " steps" : "Steps"} sub={st ? "Tap to update" : "From Samsung Health"} ok={!!st} />
      <Tile onClick={() => openSheet({ kind: "extra", date: today })} ic={<Icon.plus />} title="Extra activity" sub="Walk, hike, ride" />
      {dow === 0 && rawWeek >= 1 && (() => {
        const wv = state.weights[curWeek];
        return <Tile onClick={() => openSheet({ kind: "weigh" })} ic={<Icon.scale />} title={wv ? wv + " lb" : "Weigh-in"} sub={wv ? "Tap to update" : "Monday check-in"} ok={!!wv} wide />;
      })()}
    </div>
  );
}

function ExportBody() {
  const { state } = useApp();
  const code = encodeBackup(state);
  const ta = useRef<HTMLTextAreaElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const copy = async () => {
    ta.current?.focus(); ta.current?.select();
    let ok = false;
    try { await navigator.clipboard.writeText(code); ok = true; } catch { try { ok = document.execCommand("copy"); } catch { /* manual copy */ } }
    setMsg({ ok, text: ok ? "Copied to clipboard." : "Select the code and copy it manually." });
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = `half-training-backup-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return <>
    <p className="lead">Copy this code into a note or email. Paste it on another device with Import.</p>
    <textarea readOnly aria-label="Backup code" ref={ta} value={code} />
    <button className="btn solid" onClick={copy}>Copy code</button>
    <button className="btn" onClick={download}>Save as file</button>
    <p className={"msg" + (msg && !msg.ok ? " err" : "")} aria-live="polite">{msg?.text}</p>
  </>;
}

function ImportBody() {
  const { importState, closeSheet, toast } = useApp();
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");
  const run = (text: string) => {
    try {
      importState(decodeBackup(text.trim()));
      toast("Backup imported");
      closeSheet();
    } catch {
      setErr("That code didn't work. Copy the whole thing, starting with SGH1.");
    }
  };
  return <>
    <p className="lead">Paste a backup code. It merges with what's here, so nothing gets erased.</p>
    <textarea aria-label="Paste backup code" placeholder="SGH1..." value={raw} onChange={(e) => { setRaw(e.target.value); setErr(""); }} />
    <button className="btn solid" onClick={() => run(raw)}>Import</button>
    <label className="btn filebtn">
      Open a backup file
      <input type="file" accept=".txt,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) run(await f.text()); e.target.value = ""; }} />
    </label>
    <p className={"msg" + (err ? " err" : "")} aria-live="polite">{err}</p>
  </>;
}
