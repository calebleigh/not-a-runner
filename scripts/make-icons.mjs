// Builds the app icons in public/ from design/logo-mark.svg.
// Run: node scripts/make-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const mark = readFileSync(new URL("../design/logo-mark.svg", import.meta.url), "utf8");
const inner = mark.slice(mark.indexOf(">", mark.indexOf("<svg")) + 1, mark.lastIndexOf("</svg>"));
const VIEWBOX = mark.match(/viewBox="([^"]+)"/)[1];
const INK = "#141210"; // dark mark on the orange tile

/** Orange tile with the dark mark centered at `scale` of the tile. */
function iconSvg(size, { scale = 0.6, radius = 0.22 } = {}) {
  const m = size * scale, off = (size - m) / 2;
  const darkMark = inner.replace(/url\(#nr-grad\)/g, INK);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A3D"/><stop offset="1" stop-color="#E5540A"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#tile)"/>
  <svg x="${off}" y="${off}" width="${m}" height="${m}" viewBox="${VIEWBOX}">${darkMark}</svg>
</svg>`;
}

const out = (name, svg, size) => {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
  console.log("wrote", name);
};

out("icon-192.png", iconSvg(192, { scale: 0.62 }), 192);
out("icon-512.png", iconSvg(512, { scale: 0.62 }), 512);
// Apple adds its own rounded corners, so the tile is square.
out("icon-180.png", iconSvg(180, { radius: 0, scale: 0.62 }), 180);
// Maskable: full-bleed square; the launcher crops it. The frame's corners stay inside the 80% safe circle.
out("icon-maskable-512.png", iconSvg(512, { radius: 0, scale: 0.56 }), 512);
// Favicon: a bigger mark so it reads at 16 to 32px.
writeFileSync(new URL("../public/favicon.svg", import.meta.url), iconSvg(64, { scale: 0.78 }));
console.log("wrote favicon.svg");

// Android app (Capacitor): adaptive icon layers and a launch screen, in assets/ for
// `npx @capacitor/assets generate --android`.
import { mkdirSync } from "node:fs";
mkdirSync(new URL("../assets", import.meta.url), { recursive: true });
const asset = (name, svg, size) => {
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
  console.log("wrote assets/" + name);
};
const S = 1024;
// The launcher masks the icon to its own shape; the mark stays inside the middle 60% safe zone.
asset("icon-background.png", `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A3D"/><stop offset="1" stop-color="#E5540A"/></linearGradient></defs><rect width="${S}" height="${S}" fill="url(#t)"/></svg>`, S);
const fg = S * 0.42, fo = (S - fg) / 2;
asset("icon-foreground.png", `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><svg x="${fo}" y="${fo}" width="${fg}" height="${fg}" viewBox="${VIEWBOX}">${inner.replace(/url\(#nr-grad\)/g, INK)}</svg></svg>`, S);
asset("icon-only.png", iconSvg(S, { radius: 0, scale: 0.56 }), S);
// Launch screen: the orange mark on the app's dark paper.
const L = 2732, lm = 520, lo = (L - lm) / 2;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}"><defs><linearGradient id="nr-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#E5540A"/><stop offset="1" stop-color="#FF8A3D"/></linearGradient></defs><rect width="${L}" height="${L}" fill="#111110"/><svg x="${lo}" y="${lo}" width="${lm}" height="${lm}" viewBox="${VIEWBOX}">${inner}</svg></svg>`;
asset("splash.png", splash, L);
asset("splash-dark.png", splash, L);
