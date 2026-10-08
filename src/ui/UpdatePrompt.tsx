import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { applyUpdate, checkQuietly, setRegistration, setUpdateReady } from "./updates";

const CHECK_EVERY_MS = 60 * 60 * 1000;

/** Shows "Update ready" when a new version has downloaded; tapping it switches over and reloads. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, r) { setRegistration(r); },
  });

  useEffect(() => { setUpdateReady(needRefresh, () => updateServiceWorker(true)); }, [needRefresh, updateServiceWorker]);

  // An installed app can stay open for days, so look for updates when it comes back and every hour.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") checkQuietly(); };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(checkQuietly, CHECK_EVERY_MS);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(id); };
  }, []);

  return (
    <button className={"update-toast" + (needRefresh ? " show" : "")} aria-hidden={!needRefresh} tabIndex={needRefresh ? 0 : -1}
      onClick={() => applyUpdate()}>
      <span className="dot2" />Update ready. Tap to refresh.
    </button>
  );
}
