import { useState } from "react";
import { GEAR, addDays, fmtShort } from "../training";
import { useApp } from "./app-state";
import { Icon } from "./icons";

/** Gear checklist with due dates from the plan. Owned gear upgrades strength exercises. */
export function GearList() {
  const { model, state, update } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [openK, setOpenK] = useState<string | null>(null);
  const list = [...GEAR].sort((a, b) => a.wk - b.wk), owned = list.filter((g) => state.gear[g.k]).length;
  const shown = showAll ? list : list.filter((g) => !state.gear[g.k]).slice(0, 6);
  return (
    <section className="panelc slist gearp" aria-label="Gear">
      <div className="slhead">
        <span className="lbl">Gear<span className="sub2">Due dates follow the plan</span></span>
        <b>{owned} / {list.length} owned</b>
      </div>
      {shown.map((g) => {
        const due = addDays(model.spec.start, (g.wk - 1) * 7), have = !!state.gear[g.k], over = !have && g.wk < model.curWeek, soon = !have && !over && g.wk <= model.curWeek + 2;
        return (
          <div className="gitem" key={g.k}>
            <div className={"grow" + (have ? " owned" : "") + (over ? " overdue" : "") + (soon ? " soon" : "")}>
              <span className="gcheck">
                <input type="checkbox" checked={have} aria-label={g.name} onChange={(e) => { const on = e.target.checked; update((s) => { if (on) s.gear[g.k] = 1; else delete s.gear[g.k]; }); }} />
                <span className="box"><Icon.box /></span>
              </span>
              <span className="gt"><b>{g.name}</b><small>{g.need ? "Need" : "Helpful"}, {g.cost}</small></span>
              <span className="due">{have ? "Owned" : over ? "Overdue" : fmtShort(due)}</span>
              <button className="ibtn" aria-label={`Why ${g.name}`} aria-expanded={openK === g.k} onClick={() => setOpenK(openK === g.k ? null : g.k)}>i</button>
            </div>
            {openK === g.k && <div className="gwhy">{g.why}{g.mp ? " Facebook Marketplace is fine for this one." : ""}</div>}
          </div>
        );
      })}
      {!shown.length && <p className="setnote" style={{ padding: "14px 0" }}>You have everything on the list.</p>}
      <button className="more" onClick={() => setShowAll(!showAll)}>{showAll ? "Show only what's next" : `Show all ${list.length}, including owned`}</button>
    </section>
  );
}
