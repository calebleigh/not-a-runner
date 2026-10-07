import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const CHECK_EVERY_MS = 60 * 60 * 1000;

/** Shows "Update ready" when a new version has downloaded; tapping it switches over and reloads. */
export function UpdatePrompt() {
  const reg = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, r) { reg.current = r; },
  });

  // An installed app can stay open for days, so look for updates when it comes back and every hour.
  useEffect(() => {
    const check = () => { if (navigator.onLine) reg.current?.update().catch(() => {}); };
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(check, CHECK_EVERY_MS);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(id); };
  }, []);

  return (
    <button className={"update-toast" + (needRefresh ? " show" : "")} aria-hidden={!needRefresh} tabIndex={needRefresh ? 0 : -1}
      onClick={() => updateServiceWorker(true)}>
      <span className="dot2" />Update ready. Tap to refresh.
    </button>
  );
}
