# Half Training

Training app for people who don't like running. See `CLAUDE.md` and `docs/`.

## Develop

```
npm install
npm run dev        # local dev server
npm test           # Vitest: plan logic, prototype parity, backups, storage
npm run build      # typecheck + production build with service worker
```

## Layout

- `src/training/` pure plan logic, no DOM. Runs on web and later in the Android app.
- `src/storage/` IndexedDB storage. Migrates the old app's `localStorage` data on first load.
- `src/ui/` React screens, sheets and cards.
- `reference/` the original prototype and design references. `parity.test.ts` runs the prototype's code to check the port matches it.

## Deploy

Vercel project `half-training-app` (https://half-training-app.vercel.app). `vercel` for a preview, `vercel --prod` for production.
