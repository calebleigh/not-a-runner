import type { CapacitorConfig } from "@capacitor/cli";

// The Android app: the same web app, built into the APK so it works offline.
// The app id can never change once people have it installed.
const config: CapacitorConfig = {
  appId: "com.notarunner.app",
  appName: "Not a Runner",
  webDir: "dist",
  android: {
    // Matches the app's dark paper so there's no white flash on launch.
    backgroundColor: "#111110",
  },
  plugins: {
    // The app draws under the status and gesture bars and pads itself (--safe-area-inset-* in CSS).
    // Light icons on the dark app; the app switches them for light mode.
    SystemBars: { style: "DARK", insetsHandling: "css" },
  },
};

export default config;
