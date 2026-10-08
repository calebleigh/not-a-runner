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
};

export default config;
