import { useEffect, useRef, useState } from "react";
// Live data refreshes every 4 minutes while the app is open, and immediately when it comes back to the foreground.
export const POLL_MS = 4 * 60e3;
export const TRACK_MS = 2 * 60e3; // tracked flights + open flight detail
export function usePoll(fn: () => Promise<any> | void, deps: any[], ms = POLL_MS) {
  const [upd, setUpd] = useState<number | null>(null); const [next, setNext] = useState(Date.now() + ms); const f = useRef(fn); f.current = fn;
  useEffect(() => { let on = true; let t: any; let last = 0;
    const run = async () => { clearTimeout(t); last = Date.now(); try { await f.current(); if (on) setUpd(Date.now()); } catch {} if (on) { setNext(Date.now() + ms); t = setTimeout(run, ms); } };
    const wake = () => { if (document.visibilityState === "visible" && Date.now() - last > 20e3) run(); };
    run(); document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake); window.addEventListener("pageshow", wake); window.addEventListener("online", wake);
    return () => { on = false; clearTimeout(t); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); window.removeEventListener("pageshow", wake); window.removeEventListener("online", wake); }; }, deps);
  return { upd, next };
}
export function Refreshed({ upd, next, note }: { upd: number | null; next: number; note?: string }) {
  const [now, setNow] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const s = Math.max(0, Math.round((next - now) / 1000)); const hm = upd ? new Date(upd).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
  return <div className="refreshed faint sm px">{hm ? `Updated ${hm}` : "Checking…"} · next in {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}{note ? ` · ${note}` : ""}</div>;
}
// v13: shared clock for the tracked-flights batch poll (every 2 min, plus on app resume).
let TC = { upd: null as number | null, next: Date.now() + TRACK_MS };
export function markTracked() { TC = { upd: Date.now(), next: Date.now() + TRACK_MS }; window.dispatchEvent(new Event("skyline-track")); }
export function useTrackClock() { const [c, setC] = useState(TC); useEffect(() => { const f = () => setC(TC); window.addEventListener("skyline-track", f); return () => window.removeEventListener("skyline-track", f); }, []); return c; }
export function TrackedRefreshed() { const c = useTrackClock(); return <Refreshed {...c} note="tracked flights every 2 min" />; }
export function LiveLine() { const c = useTrackClock(); const hm = c.upd ? new Date(c.upd).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "";
  return <div className="liveline px"><i className={hm ? "" : "wait"} />{hm ? <>Live · updated {hm}</> : "Connecting…"}<span>tracked flights refresh every 2 min</span></div>; }
