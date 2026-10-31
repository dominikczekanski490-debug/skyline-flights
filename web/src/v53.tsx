// v53 — first-run welcome: launch mark → hero → home airport → favourite airline → alerts → theme → Add to Home Screen.
// Shown once (sk.welcome.v1); re-open from Settings via window event "sk:welcome". No motion under Reduce Motion / E-ink.
import { useEffect, useRef, useState } from "react";
import { api } from "./lib";
import "./v53.css";

const AIRLINES: [string, string, string][] = [["U2", "EZY", "easyJet"], ["LS", "EXS", "Jet2"], ["FR", "RYR", "Ryanair"], ["BA", "BAW", "British Airways"], ["BY", "TOM", "TUI"], ["W6", "WZZ", "Wizz Air"], ["EI", "EIN", "Aer Lingus"], ["VS", "VIR", "Virgin Atlantic"], ["EK", "UAE", "Emirates"], ["QR", "QTR", "Qatar Airways"], ["KL", "KLM", "KLM"], ["LH", "DLH", "Lufthansa"], ["TK", "THY", "Turkish Airlines"], ["LM", "LOG", "Loganair"]];
const THEMES: [string, string, string][] = [["auto", "System", "Follows your phone"], ["auto-oled", "System + OLED", "True black at night"], ["light", "Light", "Classic light"], ["dark", "Dark", "Classic dark"], ["eink", "E-ink", "No motion, high contrast"]];
const still = () => document.documentElement.dataset.skin === "eink" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
const J = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };

function Mark() { return <svg className="w53-mark" viewBox="0 0 64 64" aria-hidden><defs><linearGradient id="w53g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--acc,#5cf)" /><stop offset="1" stopColor="#a78bfa" /></linearGradient></defs>
  <circle cx="32" cy="32" r="29" fill="none" stroke="url(#w53g)" strokeWidth="3" className="w53-ring" /><path d="M14 38 C26 30 38 26 52 18" fill="none" stroke="url(#w53g)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 5" className="w53-trail" /><path d="M48 15l7 1-3 6-4-2-6 4-1-2 5-4z" fill="url(#w53g)" className="w53-plane" /></svg>; }

function Sky({ tilt }: { tilt: { x: number; y: number } }) { const t = (k: number) => ({ transform: `translate3d(${tilt.x * k}px,${tilt.y * k}px,0)` });
  return <div className="w53-sky" aria-hidden><div className="w53-l w53-stars" style={t(4)} /><div className="w53-l w53-glow" style={t(10)} />
    <svg className="w53-l" style={t(18)} viewBox="0 0 390 300" preserveAspectRatio="xMidYMid slice"><path id="w53p" d="M-20 250 C 90 200, 180 90, 410 40" fill="none" stroke="var(--acc,#5cf)" strokeOpacity=".5" strokeWidth="2" strokeDasharray="4 8" className="w53-path" />
      {!still() && <g><path d="M0-6l14 6-14 6 3-6z" fill="#fff"><animateMotion dur="7s" repeatCount="indefinite" rotate="auto"><mpath href="#w53p" /></animateMotion></path></g>}
      {still() && <path d="M0-6l14 6-14 6 3-6z" fill="#fff" transform="translate(200 120) rotate(-28)" />}</svg>
    <div className="w53-l w53-cloud" style={t(28)} /></div>; }

export default function Welcome({ setTheme, theme }: { setTheme: (t: string) => void; theme: string }) {
  const [open, setOpen] = useState(() => !localStorage.getItem("sk.welcome.v1") || /welcome/.test(location.hash)); const [i, setI] = useState(/welcome=(\d)/.test(location.hash) ? +location.hash.match(/welcome=(\d)/)![1] : 0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 }); const [q, setQ] = useState(""); const [hits, setHits] = useState<any[]>([]); const [apt, setApt] = useState<any>(() => J("sk.home.apt", null));
  const [al, setAl] = useState<string | null>(() => (J("sk.pins.al", [])[0] || {}).icao || null); const [perm, setPerm] = useState(() => "Notification" in window ? Notification.permission : "unsupported"); const [gyro, setGyro] = useState("");
  const sx = useRef<number | null>(null);
  useEffect(() => { const h = () => { setI(1); setOpen(true); }; addEventListener("sk:welcome", h); return () => removeEventListener("sk:welcome", h); }, []);
  useEffect(() => { if (open && i === 0) { const t = setTimeout(() => setI(1), still() ? 600 : 1700); return () => clearTimeout(t); } }, [open, i]);
  useEffect(() => { if (q.trim().length < 2) { setHits([]); return; } const t = setTimeout(() => api(`/airports/search?q=${encodeURIComponent(q.trim())}`).then(r => setHits(r.slice(0, 5))).catch(() => setHits([])), 220); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!open || still()) return; const m = (e: PointerEvent) => setTilt({ x: (e.clientX / innerWidth - .5) * 2, y: (e.clientY / innerHeight - .5) * 2 });
    const o = (e: DeviceOrientationEvent) => e.gamma != null && setTilt({ x: Math.max(-1, Math.min(1, e.gamma / 30)), y: Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30)) });
    addEventListener("pointermove", m); addEventListener("deviceorientation", o); return () => { removeEventListener("pointermove", m); removeEventListener("deviceorientation", o); }; }, [open]);
  if (!open) return null;
  const N = 7; const go = (d: number) => setI(x => Math.max(1, Math.min(N - 1, x + d)));
  const finish = () => { localStorage.setItem("sk.welcome.v1", "1"); localStorage.setItem("sk.seen.v22", "1"); if (location.hash.includes("welcome")) history.replaceState(null, "", location.pathname); setOpen(false); };
  const pickApt = (a: any) => { setApt(a); localStorage.setItem("sk.home.apt", JSON.stringify(a)); localStorage.setItem("sk.find.home", JSON.stringify(a.iata));
    const p = J("sk.pulse", ["MAN"]); localStorage.setItem("sk.pulse", JSON.stringify([a.iata, ...p.filter((x: string) => x !== a.iata)].slice(0, 6))); setQ(""); setHits([]); };
  const pickAl = (r: [string, string, string]) => { setAl(r[1]); const L = J("sk.pins.al", []).filter((x: any) => x.icao !== r[1]); localStorage.setItem("sk.pins.al", JSON.stringify([{ iata: r[0], icao: r[1], name: r[2] }, ...L].slice(0, 8))); };
  const askGyro = async () => { const D: any = (window as any).DeviceOrientationEvent; if (D?.requestPermission) { try { setGyro(await D.requestPermission()); } catch { setGyro("denied"); } } else setGyro(D ? "granted" : "unsupported"); };
  const askNotif = async () => { if (!("Notification" in window)) return; try { setPerm(await Notification.requestPermission()); } catch { setPerm(Notification.permission); } };
  const steps = [
    <div key="l" className="w53-launch"><Mark /><h1>Skyline</h1><p>Real flights. Real data.</p></div>,
    <div key="h"><div className="w53-kick">Welcome</div><h2>Every flight, live — from real airport boards and ADS-B.</h2><p>No invented numbers. When Skyline estimates, it says so.</p>
      {!still() && <button className="w53-ghost" onClick={askGyro}>{gyro === "granted" ? "✓ Tilt is on — move your phone" : gyro === "denied" ? "Motion access declined — drag to tilt instead" : gyro === "unsupported" ? "No motion sensor — drag to tilt" : "✦ Tilt the sky with your phone"}</button>}</div>,
    <div key="a"><div className="w53-kick">Step 1 of 5</div><h2>Your home airport</h2><p>Find, the airport pulse and your weather start here.</p>
      <input className="w53-in" value={q} onChange={e => setQ(e.target.value)} placeholder="Search city, airport or code" aria-label="Search home airport" />
      <div className="w53-list" role="listbox">{hits.map(h => <button key={h.iata} role="option" aria-selected={apt?.iata === h.iata} onClick={() => pickApt(h)}><b>{h.iata}</b><span>{h.name}<small>{h.city}, {h.country}</small></span></button>)}</div>
      {apt && <div className="w53-pick">✓ {apt.iata} · {apt.name}</div>}</div>,
    <div key="b"><div className="w53-kick">Step 2 of 5</div><h2>Favourite airline</h2><p>We'll pin it to Home and open its page — on-time from our own log.</p>
      <div className="w53-chips">{AIRLINES.map(r => <button key={r[1]} className={al === r[1] ? "on" : ""} aria-pressed={al === r[1]} onClick={() => pickAl(r)}>{r[2]}</button>)}</div></div>,
    <div key="n"><div className="w53-kick">Step 3 of 5</div><h2>Flight alerts</h2><p>Gate changes, delays and boarding for flights you track. Your browser asks first; you can change it any time in Settings.</p>
      {perm === "unsupported" ? <div className="w53-note">{ios && !standalone() ? "On iPhone, alerts only work after you add Skyline to your Home Screen (iOS 16.4+). We'll show you how next." : "This browser doesn't support web notifications."}</div>
        : perm === "granted" ? <div className="w53-pick">✓ Alerts allowed</div> : perm === "denied" ? <div className="w53-note">Notifications are blocked for this site. Re-enable them in your browser's site settings.</div>
        : <button className="w53-cta" onClick={askNotif}>🔔 Allow alerts</button>}</div>,
    <div key="t"><div className="w53-kick">Step 4 of 5</div><h2>Choose your look</h2><div className="w53-themes">{THEMES.map(([k, n, s]) => <button key={k} className={theme === k ? "on" : ""} aria-pressed={theme === k} onClick={() => setTheme(k)}><b>{n}</b><small>{s}</small></button>)}</div><p className="w53-small">More skins live in Settings → Appearance.</p></div>,
    <div key="i"><div className="w53-kick">Step 5 of 5</div><h2>{standalone() ? "You're on the Home Screen ✓" : "Add Skyline to your Home Screen"}</h2>
      {standalone() ? <p>Full-screen, faster launches and alerts are ready.</p> : ios ? <ol className="w53-ol"><li>Tap <b>Share</b> <span aria-hidden>⬆︎</span> in Safari's toolbar</li><li>Choose <b>Add to Home Screen</b></li><li>Open Skyline from its new icon</li></ol> : <p>Use your browser menu's <b>Install app</b> or <b>Add to Home screen</b>. It works offline for flights you track.</p>}
      <button className="w53-cta" onClick={finish}>Start exploring</button></div>];
  return <div className="w53" role="dialog" aria-modal="true" aria-label="Welcome to Skyline" data-step={i}
    onTouchStart={e => (sx.current = e.touches[0].clientX)} onTouchEnd={e => { if (sx.current == null || i === 0) return; const d = e.changedTouches[0].clientX - sx.current; if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); sx.current = null; }}
    onKeyDown={e => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); if (e.key === "Escape") finish(); }} tabIndex={-1}>
    <Sky tilt={tilt} />{i > 0 && <button className="w53-skip" onClick={finish}>Skip</button>}
    <div className="w53-card" key={i}>{steps[i]}</div>
    {i > 0 && <div className="w53-nav"><button className="w53-ghost" onClick={() => go(-1)} disabled={i <= 1} aria-label="Back">‹</button>
      <div className="w53-dots" role="tablist">{Array.from({ length: N - 1 }, (_, k) => <button key={k} role="tab" aria-selected={i === k + 1} aria-label={`Step ${k + 1}`} className={i === k + 1 ? "on" : ""} onClick={() => setI(k + 1)} />)}</div>
      {i < N - 1 ? <button className="w53-cta sm" onClick={() => go(1)}>{i === 1 ? "Get started" : (i === 2 && !apt) || (i === 3 && !al) ? "Not now" : "Next"}</button> : <span style={{ width: 64 }} />}</div>}
  </div>; }
