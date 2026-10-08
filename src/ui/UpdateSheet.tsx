import { useEffect, useState } from "react";
import { installInfo, openInstallSources, openSecuritySettings, type InstallInfo } from "../native/installHelp";
import { Icon } from "./icons";
import { installLatest, latestApk, useDownloadPct } from "./updates";

/**
 * Android app: the steps to install an update. Allow installs from this app (opens that exact
 * switch), on Samsung turn off Auto Blocker (opens Security and privacy), then install.
 */
export function UpdateSheetBody() {
  const [info, setInfo] = useState<InstallInfo | null>(null);
  const pct = useDownloadPct();
  const rel = latestApk();
  // Coming back from Settings: check again.
  useEffect(() => {
    const check = () => { installInfo().then(setInfo); };
    check();
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  if (!info) return null;
  let n = 0;
  return (
    <div className="updsteps">
      <p className="setnote">{rel ? `Version ${rel.version} is ready.` : "A new version is ready."} It installs over this one; your data stays.</p>
      {!info.canInstall && (
        <div className="updstep">
          <span className="updnum">{++n}</span>
          <div><b>Allow installs from Not a Runner</b><small>Android asks once. Turn on "Allow from this source", then come back.</small></div>
          <button className="chip" onClick={() => openInstallSources()}>Open setting</button>
        </div>
      )}
      {info.canInstall && (
        <div className="updstep ok">
          <span className="updnum"><Icon.check /></span>
          <div><b>Installs from Not a Runner are allowed</b></div>
        </div>
      )}
      {info.samsung && (
        <div className="updstep">
          <span className="updnum">{++n}</span>
          <div><b>Turn off Auto Blocker</b><small>Samsung blocks installs from outside its stores. In Security and privacy, tap Auto Blocker and turn it off. You can turn it back on after.</small></div>
          <button className="chip" onClick={() => openSecuritySettings()}>Open settings</button>
        </div>
      )}
      <button className="btn solid" disabled={pct !== null || !info.canInstall} onClick={() => installLatest()}>
        {pct !== null ? `Downloading ${pct}%` : "Install update"}
      </button>
      {!info.canInstall && <p className="setnote">Install unlocks once installs from Not a Runner are allowed.</p>}
    </div>
  );
}
