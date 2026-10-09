import { useState } from "react";
import { homeTotals, kfmt } from "../training";
import { useApp } from "./app-state";

type Span = "week" | "month" | "all";
const SPANS: [Span, string][] = [["week", "Week"], ["month", "Month"], ["all", "All time"]];
const KEY = "totalsSpan";

const saved = (): Span => { try { const v = localStorage.getItem(KEY) as Span; return SPANS.some(([k]) => k === v) ? v : "week"; } catch { return "week"; } };

/** "3h 05m", or "45m" under an hour. */
export function hoursMin(secs: number): string {
  const m = Math.round(secs / 60), h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

/** Home: steps, miles and active time for this week, this month or all time. */
export function TotalsCard() {
  const { model } = useApp();
  const [span, setSpan] = useState<Span>(saved);
  const pick = (s: Span) => { setSpan(s); try { localStorage.setItem(KEY, s); } catch { /* blocked */ } };
  const t = homeTotals(model)[span];
  return (
    <section className="panelc totals" aria-label="Totals">
      <div className="top">
        <span className="lbl">Totals</span>
        <div className="seg totseg" role="radiogroup" aria-label="Totals for">
          {SPANS.map(([k, label]) => (
            <button key={k} role="radio" aria-checked={span === k} className={span === k ? "sel" : ""} onClick={() => pick(k)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="totrow">
        <div><b>{kfmt(t.steps)}</b><small>Steps</small></div>
        <div><b>{t.miles.toFixed(1)}</b><small>Miles</small></div>
        <div><b>{hoursMin(t.secs)}</b><small>Active</small></div>
      </div>
    </section>
  );
}
