import { Component, type ReactNode } from "react";
// Visible error reporting instead of a silent blank/reload, plus crash-reload detection (iOS kills the web
// process when memory runs out and the Home Screen app then reloads from scratch).
const box = () => { let d = document.getElementById("sk-toast"); if (!d) { d = document.createElement("div"); d.id = "sk-toast"; d.setAttribute("role", "alert"); document.body.appendChild(d); } return d; };
export function toast(msg: string, ms = 7000) { const d = box(); d.textContent = msg; d.className = "on"; clearTimeout((d as any)._t); (d as any)._t = setTimeout(() => { d!.className = ""; }, ms); d.onclick = () => { d!.className = ""; }; }
export function mark(action: string) { try { sessionStorage.setItem("sk.lastAct", JSON.stringify({ a: action, t: Date.now() })); localStorage.setItem("sk.lastAct", JSON.stringify({ a: action, t: Date.now() })); } catch { /* storage full */ } }
export function installGuards() {
  let last = ""; const show = (m: string) => { if (m === last) return; last = m; toast("Something went wrong: " + m.slice(0, 160) + " — the app kept running. Tap to dismiss."); };
  window.addEventListener("error", e => { if (e.message && !/ResizeObserver|Script error/.test(e.message)) show(e.message); });
  window.addEventListener("unhandledrejection", e => { const m = String((e as any).reason?.message || (e as any).reason || ""); if (m && !/abort|Failed to fetch|NetworkError|Load failed/i.test(m)) show(m); });
  try { // clean-exit marker: if the previous session ended without pagehide right after an action, the OS reloaded us
    const prev = localStorage.getItem("sk.alive"), la = JSON.parse(localStorage.getItem("sk.lastAct") || "null");
    if (prev === "1" && la && Date.now() - la.t < 60e3) setTimeout(() => toast(`Skyline was restarted by your phone (usually low memory) right after “${la.a}”. Anything you added was saved first.`, 9000), 1500);
    localStorage.setItem("sk.alive", "1"); addEventListener("pagehide", () => localStorage.setItem("sk.alive", "0"));
  } catch { /* ignore */ }
}
export class Boundary extends Component<{ children: ReactNode; label?: string }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: any) { return { err: String(e?.message || e) }; }
  componentDidCatch(e: any) { console.error("Skyline UI error", e); toast("A screen failed to draw: " + String(e?.message || e).slice(0, 140)); }
  render() { return this.state.err ? <div className="note warn" style={{ margin: 16 }}>This {this.props.label || "screen"} hit an error ({this.state.err}). Your flights are safe. <button className="chip" onClick={() => this.setState({ err: null })}>Try again</button></div> : this.props.children; }
}
