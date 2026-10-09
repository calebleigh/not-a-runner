// Invite links: /i/CODE?n=Caleb (rewritten here in vercel.json). Message apps read the preview tags
// (title, picture); people are sent straight on to the app with the code.
import { esc, firstName } from "./_name.js";

const SITE = "https://not-a-runner.vercel.app";

export function GET(req: Request) {
  const u = new URL(req.url);
  const code = (u.searchParams.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const name = firstName(u.searchParams.get("n"));
  const title = name ? `${name} invited you to Not a Runner` : "You're invited to Not a Runner";
  const desc = name
    ? `Train with ${name}. A plan that eases you in, with streaks and pokes to keep each other going.`
    : "Training for people who don't love running. See each other's streaks and keep each other going.";
  const img = `${SITE}/api/og${name ? `?n=${encodeURIComponent(name)}` : ""}`;
  const to = `/?invite=${code}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Not a Runner">
<meta property="og:url" content="${SITE}/i/${code}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#111110">
<meta http-equiv="refresh" content="0;url=${to}">
<style>body{background:#111110;color:#F4F1EC;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#FF8A3D}</style>
</head><body><p>Opening Not a Runner… <a href="${to}">Tap here</a> if nothing happens.</p>
<script>location.replace(${JSON.stringify(to)})</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
