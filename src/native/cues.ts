// Voice and vibration cues during a workout (interval switches). Native speech and haptics in the
// app (both work with the screen off), the browser's speech and vibration on the website.
import { Capacitor } from "@capacitor/core";

/** Says `text` out loud and buzzes. Never throws: a missed cue shouldn't stop a workout. */
export async function cue(text: string, opts: { voice: boolean }) {
  buzz();
  if (!opts.voice) return;
  try {
    if (Capacitor.isNativePlatform()) {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      await TextToSpeech.speak({ text, lang: "en-US", rate: 1.0, category: "playback" });
    } else if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  } catch { /* no voice available */ }
}

async function buzz() {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise((r) => setTimeout(r, 180));
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else navigator.vibrate?.([200, 120, 200]);
  } catch { /* no vibration */ }
}
