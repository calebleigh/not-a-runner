// The app's own Android helper for installing updates (android/.../InstallHelpPlugin.java).
import { Capacitor, registerPlugin } from "@capacitor/core";

interface InstallHelpPlugin {
  info(): Promise<{ manufacturer: string; canInstall: boolean }>;
  openInstallSources(): Promise<void>;
  openSecurity(): Promise<void>;
}

const InstallHelp = registerPlugin<InstallHelpPlugin>("InstallHelp");

export interface InstallInfo { samsung: boolean; canInstall: boolean }

/** Whether this app may install updates, and whether it's a Samsung (Auto Blocker) phone. */
export async function installInfo(): Promise<InstallInfo> {
  if (!Capacitor.isNativePlatform()) return { samsung: false, canInstall: true };
  try {
    const r = await InstallHelp.info();
    return { samsung: /samsung/i.test(r.manufacturer), canInstall: r.canInstall };
  } catch {
    return { samsung: false, canInstall: true };
  }
}

/** Opens this app's "Install unknown apps" switch. */
export const openInstallSources = () => InstallHelp.openInstallSources().catch(() => {});
/** Opens Security and privacy (where Samsung's Auto Blocker is). */
export const openSecuritySettings = () => InstallHelp.openSecurity().catch(() => {});
