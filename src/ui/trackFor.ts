import type { CardioKind, TrackKind } from "../training";

/** The tracker's activity for a planned session: rides track as bike, walks as walk, the rest as walk/run. */
export const trackKindFor = (k: CardioKind): TrackKind => (k === "bike" ? "bike" : k === "walk" ? "walk" : "run");
