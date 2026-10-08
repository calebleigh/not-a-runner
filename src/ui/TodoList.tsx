import { useState } from "react";
import { fmtShort, todoLists, upNext, type TodoItem } from "../training";
import { newId } from "../sync/engine";
import { useApp } from "./app-state";
import { ConfirmButton } from "./cards";
import { Icon } from "./icons";

function Row({ it, full }: { it: TodoItem; full: boolean }) {
  const { update } = useApp();
  const [why, setWhy] = useState(false);
  const id = it.key.slice(2), g = it.gear;
  const toggle = (on: boolean) => update((s) => {
    if (g) { if (on) s.gear[g.k] = 1; else delete s.gear[g.k]; return; }
    const t = s.todos[id];
    if (!t) return;
    if (on) t.done = Date.now(); else delete t.done;
  });
  const due = it.done ? (g ? "Owned" : "") : it.status === "overdue" ? "Overdue" : it.due ? fmtShort(it.due) : "";
  return (
    <div className="gitem">
      <div className={"grow" + (it.done ? " owned" : "") + (it.status === "overdue" ? " overdue" : "") + (it.status === "due" || it.status === "soon" ? " soon" : "")}>
        <span className="gcheck">
          <input type="checkbox" checked={it.done} aria-label={it.text} onChange={(e) => toggle(e.target.checked)} />
          <span className="box"><Icon.box /></span>
        </span>
        <span className="gt"><b>{it.text}</b>{g && <small>{g.need ? "Gear you need" : "Helpful gear"}, {g.cost}</small>}</span>
        {due && <span className="due">{due}</span>}
        {full && g && <button className="ibtn" aria-label={`Why ${it.text}`} aria-expanded={why} onClick={() => setWhy(!why)}>i</button>}
        {full && !g && <ConfirmButton className="tdel" label="×" confirmLabel="Delete" onConfirm={() => update((s) => { delete s.todos[id]; })} />}
      </div>
      {why && g && <div className="gwhy">{g.why}{g.mp ? " Facebook Marketplace is fine for this one." : ""}</div>}
    </div>
  );
}

function AddTodo() {
  const { update } = useApp();
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const add = () => {
    const v = text.trim();
    if (!v) return;
    update((s) => { s.todos[newId()] = { text: v, at: Date.now(), ...(due ? { due } : {}) }; });
    setText("");
    setDue("");
  };
  return (
    <form className="todoadd" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <input className="txtin todotext" maxLength={80} placeholder="Add a to-do, like PT visit" aria-label="Add a to-do" value={text} onChange={(e) => setText(e.target.value)} />
      <label className="tododue">
        <span>Due</span>
        <input className="txtin" type="date" aria-label="Due date (optional)" value={due} onChange={(e) => setDue(e.target.value)} />
        {due && <button type="button" className="clrdate" aria-label="Clear due date" onClick={() => setDue("")}>&times;</button>}
      </label>
      <button className="chip" type="submit" disabled={!text.trim()}>Add</button>
    </form>
  );
}

/** Home: what's on the list right now. Adding happens on the Plan tab. */
export function TodoCard() {
  const { model, setTab } = useApp();
  const lists = todoLists(model), { shown, rest } = upNext(lists, 4), now = lists.now;
  return (
    <section className="panelc slist todop" aria-label="To do">
      <div className="slhead"><span className="lbl">To do</span><b>{now.length ? `${now.length} open` : "All caught up"}</b></div>
      {shown.slice(0, Math.max(4, Math.min(now.length, 5))).map((it) => <Row key={it.key} it={it} full={false} />)}
      {!shown.length && <p className="setnote" style={{ padding: "12px 16px" }}>Nothing on the list.</p>}
      <button className="more" onClick={() => setTab("plan")}>{shown.length > 5 || rest.length ? "See the full list" : "Add or see all"} &rsaquo;</button>
    </section>
  );
}

/** Plan tab: open items and the add box. Later and done items open in a sheet. */
export function TodoList() {
  const { model, openSheet } = useApp();
  const lists = todoLists(model), { now, done } = lists, { shown, rest: later } = upNext(lists, 4);
  return (
    <section className="panelc slist todop" aria-label="To do">
      <div className="slhead">
        <span className="lbl">To do<span className="sub2">Your own items, plus gear as the plan needs it</span></span>
        <b>{now.length} open</b>
      </div>
      <AddTodo />
      {shown.map((it) => <Row key={it.key} it={it} full />)}
      {!shown.length && <p className="setnote" style={{ padding: "12px 16px" }}>All caught up.</p>}
      {(later.length > 0 || done.length > 0) && (
        <div className="todomore">
          {later.length > 0 && <button className="more" onClick={() => openSheet({ kind: "todos", which: "later" })}>Later ({later.length}) &rsaquo;</button>}
          {done.length > 0 && <button className="more" onClick={() => openSheet({ kind: "todos", which: "done" })}>Done ({done.length}) &rsaquo;</button>}
        </div>
      )}
    </section>
  );
}

/** Sheet: gear and items due later, or everything finished. */
export function TodoSheetBody({ which }: { which: "later" | "done" }) {
  const { model } = useApp();
  const lists = todoLists(model);
  // Later leaves out what the card already shows.
  const list = which === "later" ? upNext(lists, 4).rest : lists.done;
  return (
    <div className="todop todosheet">
      <p className="setnote">{which === "later" ? "Due more than two weeks out. They move up to the list as they get close." : "Checked off. Uncheck one to put it back on the list."}</p>
      {list.map((it) => <Row key={it.key} it={it} full />)}
      {!list.length && <p className="setnote">Nothing here.</p>}
    </div>
  );
}
