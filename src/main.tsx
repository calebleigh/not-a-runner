import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/800-italic.css";
import "./ui/styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { installDragScroll } from "./ui/dragScroll";

createRoot(document.getElementById("root")!).render(<App />);
installDragScroll();

// The first version of the app used its own cache. Clear it once the new worker is in charge.
if ("caches" in window) caches.delete("half-training-v1").catch(() => {});
