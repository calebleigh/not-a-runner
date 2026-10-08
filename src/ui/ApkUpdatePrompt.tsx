import { useEffect } from "react";
import { applyUpdate, checkApk, useUpdateReady } from "./updates";

/** Android app: when a newer APK is on GitHub, offer it. Tapping downloads it; Android then installs it. */
export function ApkUpdatePrompt() {
  const ready = useUpdateReady();
  useEffect(() => {
    checkApk(false);
    const onVis = () => { if (document.visibilityState === "visible") checkApk(false); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return (
    <button className={"update-toast" + (ready ? " show" : "")} aria-hidden={!ready} tabIndex={ready ? 0 : -1} onClick={() => applyUpdate()}>
      <span className="dot2" />New version ready. Tap to download.
    </button>
  );
}
