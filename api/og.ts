// The picture that shows when an invite link is pasted into a text, email or chat: a big orange card
// saying who invited you. GET /api/og?n=Caleb (1200 x 630 PNG).
import { readFile } from "node:fs/promises";
import { ImageResponse } from "@vercel/og";
import { firstName } from "./_name.js";

const file = (p: string) => readFile(new URL(p, import.meta.url));
const fonts = Promise.all([file("./_fonts/barlow-condensed-latin-800-italic.woff"), file("./_fonts/barlow-latin-600-normal.woff"), file("../public/icon-512.png")]);

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node => ({ type, props: { style: { display: "flex", ...style }, children } });

const STRIPES = "repeating-linear-gradient(135deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 28px, transparent 28px, transparent 56px)";

export async function GET(req: Request) {
  const name = firstName(new URL(req.url).searchParams.get("n"));
  const [display, body, icon] = await fonts;
  const logo = `data:image/png;base64,${icon.toString("base64")}`;
  const card = h("div", { width: "100%", height: "100%", display: "flex", background: "#111110", padding: 48, fontFamily: "Barlow" },
    h("div", {
      flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", borderRadius: 40, padding: "52px 60px",
      backgroundImage: `${STRIPES}, linear-gradient(135deg, #FF8A3D, #E5540A)`, color: "#141210",
    },
      h("div", { display: "flex", alignItems: "center", gap: 20 },
        { type: "img", props: { src: logo, width: 72, height: 72, style: { borderRadius: 18 } } },
        h("div", { fontFamily: "Barlow Condensed", fontStyle: "italic", fontSize: 44, letterSpacing: 1 }, "NOT A RUNNER"),
      ),
      h("div", { display: "flex", flexDirection: "column" },
        h("div", { fontSize: 34, opacity: 0.8 }, "Friend invite"),
        h("div", { fontFamily: "Barlow Condensed", fontStyle: "italic", fontSize: name && name.length > 9 ? 112 : 136, lineHeight: 0.95, textTransform: "uppercase" },
          name ? `${name} invited you` : "You're invited"),
      ),
      h("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
        h("div", { fontSize: 30, maxWidth: 640 }, "Training for people who don't love running. Streaks, pokes and a plan that eases you in."),
        h("div", { display: "flex", background: "#141210", color: "#FF8A3D", borderRadius: 999, padding: "16px 34px", fontFamily: "Barlow Condensed", fontStyle: "italic", fontSize: 40 }, "TAP TO JOIN"),
      ),
    ),
  );
  return new ImageResponse(card as never, {
    width: 1200, height: 630,
    fonts: [
      { name: "Barlow Condensed", data: display, weight: 800, style: "italic" },
      { name: "Barlow", data: body, weight: 600, style: "normal" },
    ],
    headers: { "Cache-Control": "public, max-age=86400, immutable" },
  });
}
