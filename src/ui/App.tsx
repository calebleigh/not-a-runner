import { useEffect, useState } from "react";
import { AppProvider, useApp, type Tab } from "./app-state";
import { Icon } from "./icons";
import { SheetHost } from "./sheets";
import { UpdatePrompt } from "./UpdatePrompt";
import { Home } from "./views/Home";
import { Plan } from "./views/Plan";
import { Profile } from "./views/Profile";
import { Stats } from "./views/Stats";

const TABS: { tab: Tab; label: string; icon: () => React.JSX.Element }[] = [
  { tab: "home", label: "Home", icon: Icon.home },
  { tab: "plan", label: "Plan", icon: Icon.plan },
  { tab: "stats", label: "Stats", icon: Icon.stats },
  { tab: "profile", label: "Profile", icon: Icon.profile },
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
  const navBtn = ({ tab: t, label, icon: I }: (typeof TABS)[number]) => (
    <button key={t} className={tab === t ? "sel" : ""} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
      <I /><span>{label}</span>
    </button>
  );
  return <>
    <div className="wrap">
      <main key={tab}>
        {tab === "home" && <Home />}
        {tab === "plan" && <Plan />}
        {tab === "stats" && <Stats />}
        {tab === "profile" && <Profile />}
      </main>
    </div>
    <nav className="bnav" aria-label="Main">
      {TABS.slice(0, 2).map(navBtn)}
      <button className="logbtn" aria-label="Log a workout" onClick={() => openSheet({ kind: "log" })}><Icon.bigPlus /></button>
      {TABS.slice(2).map(navBtn)}
    </nav>
    <SheetHost />
    <Toast />
    <UpdatePrompt />
  </>;
}

export function App() {
  return <AppProvider><Shell /></AppProvider>;
}
