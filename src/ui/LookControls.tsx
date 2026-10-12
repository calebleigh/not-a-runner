// Light or dark, shape (rounded or squared, with the matching logo) and accent color. Saves as you
// pick, so the whole app changes right away. Used in Settings and onboarding.
import { DEFAULT_PRESET, PRESETS, presetFor, sameAccent, type Accent, type Preset, type Shape } from "./theme";
import { useApp } from "./app-state";

export function useLook() {
  const { state } = useApp();
  const cur: Accent = state.settings.accent ?? DEFAULT_PRESET;
  return { preset: presetFor(cur) ?? DEFAULT_PRESET, shape: (state.settings.shape ?? "square") as Shape, mode: state.settings.mode ?? "dark" };
}

export function LookControls() {
  const { state, update } = useApp();
  const cur: Accent = state.settings.accent ?? DEFAULT_PRESET;
  const preset = presetFor(cur);
  const shape: Shape = state.settings.shape ?? "square";
  const setShape = (v: Shape) => update((s) => { if (v === "round") s.settings.shape = v; else delete s.settings.shape; });
  const mode = state.settings.mode ?? "dark";
  const setMode = (v: "dark" | "light" | "system") => update((s) => { if (v === "dark") delete s.settings.mode; else s.settings.mode = v; });
  const setColor = (p: Preset) => update((s) => {
    if (sameAccent(p, DEFAULT_PRESET)) delete s.settings.accent;
    else s.settings.accent = { hi: p.hi, lo: p.lo };
  });
  return (
    <>
      <div className="seg modeseg" role="radiogroup" aria-label="Light or dark">
        {([["dark", "Dark"], ["light", "Light"], ["system", "Match system"]] as const).map(([v, l]) => (
          <button key={v} role="radio" aria-checked={mode === v} className={mode === v ? "sel" : ""} onClick={() => setMode(v)}>{l}</button>
        ))}
      </div>
      <div className="shapes" role="radiogroup" aria-label="Shape">
        {(["square", "round"] as Shape[]).map((v) => (
          <button key={v} role="radio" aria-checked={shape === v} className={"shapebtn " + v + (shape === v ? " sel" : "")} onClick={() => setShape(v)}>
            <span className="shapeprev" /><b>{v === "round" ? "Rounded" : "Squared"}</b>
          </button>
        ))}
      </div>
      <div className="swatches" role="radiogroup" aria-label="Color">
        {PRESETS.map((p) => {
          const sel = (preset ?? DEFAULT_PRESET) === p;
          return (
            <button key={p.name} role="radio" aria-checked={sel} className={"swatch" + (sel ? " sel" : "")} onClick={() => setColor(p)}
              style={{ ["--a" as string]: p.hi, ["--b" as string]: p.lo }}>
              <span className="sw" /><small>{p.name}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}
