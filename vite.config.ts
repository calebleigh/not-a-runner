import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  define: {
    // Shown in Profile so you can tell which version is running.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // sw.js and manifest.webmanifest keep the same paths as the old app so the
      // installed home screen icon and service worker upgrade in place.
      // New versions wait until the user taps the "Update ready" bar.
      registerType: "prompt",
      filename: "sw.js",
      manifestFilename: "manifest.webmanifest",
      includeAssets: ["icon-180.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        // Sign-in pages (proxied to Firebase, see vercel.json) must load from the network, not the app shell.
        navigateFallbackDenylist: [/^\/__\//],
        // Once the user taps to update and the new version activates, it takes over open pages,
        // including ones opened before any version was in control. The waiting step stays (no skipWaiting).
        clientsClaim: true,
      },
      manifest: {
        name: "Not a Runner",
        short_name: "Not a Runner",
        description: "Train for a race even if you hate running.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#111110",
        theme_color: "#111110",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test-setup.ts"],
  },
});
