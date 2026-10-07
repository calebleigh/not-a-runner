import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
      },
      manifest: {
        name: "St. George Half Training",
        short_name: "Half Training",
        description: "Training plan, logging and progress for the St. George Half.",
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
