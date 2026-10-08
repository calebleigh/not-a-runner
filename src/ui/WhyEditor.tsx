import { useState } from "react";
import { WHY_IDEAS, formatWhy, whyList } from "../training";
import { useApp } from "./app-state";

/** Add and remove reasons for training (the "Your why" sheet). */
export function WhyEditor() {
  const { state, update } = useApp();
  const whys = whyList(state.settings);
  const [text, setText] = useState("");
  const save = (list: string[]) => update((s) => { delete s.settings.why; if (list.length) s.settings.whys = list; else delete s.settings.whys; });
  const add = (w: string) => { const v = w.trim(); if (v && !whys.includes(v)) save([...whys, v]); setText(""); };
  const ideas = WHY_IDEAS.filter((w) => !whys.includes(w));
  return (
    <div className="whyedit">
      <p className="setnote">One shows on Home each day there's no tip, for the mornings you need it.</p>
      {whys.length > 0 && <ul className="whylist">{whys.map((w) => (
        <li key={w}><span>{formatWhy(w)}</span><button className="xbtn" aria-label={`Remove ${w}`} onClick={() => save(whys.filter((x) => x !== w))}>&times;</button></li>
      ))}</ul>}
      <form className="whyadd" onSubmit={(e) => { e.preventDefault(); add(text); }}>
        <input className="txtin whyin" maxLength={80} placeholder="Add a reason" aria-label="Add a reason" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn solid small" type="submit" disabled={!text.trim()}>Add</button>
      </form>
      {ideas.length > 0 && <>
        <span className="lbl">Ideas</span>
        <div className="whyideas">{ideas.map((w) => <button key={w} className="chip" onClick={() => add(w)}>+ {w}</button>)}</div>
      </>}
    </div>
  );
}
