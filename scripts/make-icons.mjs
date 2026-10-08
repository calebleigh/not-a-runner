// Builds the app icons in public/ from design/logo-mark.svg.
// Run: node scripts/make-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const mark = readFileSync(new URL("../design/logo-mark.svg", import.meta.url), "utf8");
const inner = mark.slice(mark.indexOf(">", mark.indexOf("<svg")) + 1, mark.lastIndexOf("</svg>"));
const VIEWBOX = "-41 -135 1110 1110";
const INK = "#141210"; // dark mark on the orange tile

/** Orange tile with the dark mark centered at `scale` of the tile. */
function iconSvg(size, { scale = 0.6, radius = 0.22 } = {}) {
  const m = size * scale, off = (size - m) / 2;
  const darkMark = inner.replace(/url\(#mark-grad\)/g, INK);
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

out("icon-192.png", iconSvg(192), 192);
out("icon-512.png", iconSvg(512), 512);
// Apple adds its own rounded corners, so the tile is square.
out("icon-180.png", iconSvg(180, { radius: 0 }), 180);
// Maskable: full-bleed square; the launcher crops it. The mark stays inside the 80% safe circle.
out("icon-maskable-512.png", iconSvg(512, { radius: 0, scale: 0.56 }), 512);
// Favicon: a little larger mark so it reads at 16 to 32px.
writeFileSync(new URL("../public/favicon.svg", import.meta.url), iconSvg(64, { scale: 0.7 }));
console.log("wrote favicon.svg");
