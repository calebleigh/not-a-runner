import { useCallback, useEffect, useState } from "react";
import { AppProvider, useApp, type Tab } from "./app-state";
import { Icon } from "./icons";
import { Wordmark } from "./Logo";
import { AppHeader } from "./AppHeader";
import { TrackerScreen } from "./TrackerScreen";
import { HealthAutoImport } from "./HealthSection";
import { RouteMapScreen } from "./RouteMap";
import { useMirroredScroll } from "./mirror";
import { needsOnboarding } from "../training";
import { Onboarding } from "./Onboarding";
import { Splash } from "./Splash";
import { SheetHost } from "./sheets";
import { UpdatePrompt } from "./UpdatePrompt";
import { ApkUpdatePrompt } from "./ApkUpdatePrompt";
import { IS_NATIVE } from "./apk";
import { Home } from "./views/Home";
import { Plan } from "./views/Plan";
import { Settings } from "./views/Settings";
import { Stats } from "./views/Stats";

const TABS: { tab: Tab; label: string; icon: () => React.JSX.Element }[] = [
  { tab: "home", label: "Home", icon: Icon.home },
  { tab: "plan", label: "Plan", icon: Icon.plan },
  { tab: "stats", label: "Stats", icon: Icon.stats },
  { tab: "settings", label: "Settings", icon: Icon.settings },
];

function Toast() {
  const { toastMsg } = useApp();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!toastMsg) return;
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(t);
  }, [toastMsg]);
  return <div className={"toast" + (show ? " show" : "")} role="status" aria-live="polite">{toastMsg?.text}</div>;
}

function Shell() {
  const { tab, setTab, openSheet } = useApp();
  useMirroredScroll("page", useCallback(() => null, []));
  const navBtn = ({ tab: t, label, icon: I }: (typeof TABS)[number]) => (
    <button key={t} className={tab === t ? "sel" : ""} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
      <I /><span>{label}</span>
    </button>
  );
  return <>
    <AppHeader />
    <div className="wrap">
      <main key={tab}>
        {tab === "home" && <Home />}
        {tab === "plan" && <Plan />}
        {tab === "stats" && <Stats />}
        {tab === "settings" && <Settings />}
      </main>
    </div>
    <nav className="bnav" aria-label="Main">
      <div className="railbrand"><Wordmark size={34} /></div>
      {TABS.slice(0, 2).map(navBtn)}
      <button className="logbtn" aria-label="Log a workout" onClick={() => openSheet({ kind: "log" })}><Icon.bigPlus /><span className="logtxt">Log workout</span></button>
      {TABS.slice(2).map(navBtn)}
    </nav>
    <SheetHost />
    <TrackerScreen />
    <HealthAutoImport />
    <RouteMapScreen />
    <Toast />
    {IS_NATIVE ? <ApkUpdatePrompt /> : <UpdatePrompt />}
  </>;
}

/** New users answer a few questions first; everyone else goes straight to the app. */
function Root() {
  const { state } = useApp();
  if (needsOnboarding(state)) return <><Onboarding /><SheetHost /><Toast /></>;
  return <Shell />;
}

export function App() {
  return <AppProvider><Root /><Splash /></AppProvider>;
}
