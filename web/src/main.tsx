import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { SharedView } from "./extras";
import { installGuards, Boundary } from "./guard";
installGuards();
createRoot(document.getElementById("root")!).render(location.pathname.startsWith("/s/") ? <SharedView id={location.pathname.slice(3)} /> : <Boundary label="app"><App /></Boundary>);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(r => r.update().catch(() => {}));
import "./v40.css";
