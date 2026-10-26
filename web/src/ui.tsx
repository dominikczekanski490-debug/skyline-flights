import { motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import { useEffect, type ReactNode } from "react";
export const I = { // tiny inline icon set (original drawings)
  clock: <svg viewBox="0 0 24 24" width="22"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  close: <svg viewBox="0 0 24 24" width="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>,
  share: <svg viewBox="0 0 24 24" width="22"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  search: <svg viewBox="0 0 24 24" width="26"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>,
  plane: <svg viewBox="0 0 24 24" width="22"><path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>,
  friends: <svg viewBox="0 0 24 24" width="24"><circle cx="9" cy="8" r="3.5" fill="currentColor" /><path d="M2.5 19c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5z" fill="currentColor" /><circle cx="17" cy="9" r="2.6" fill="currentColor" opacity=".7" /><path d="M16.5 13.2c2.7 0 4.6 1.8 5 4.8h-4.3" fill="currentColor" opacity=".7" /></svg>,
  passport: <svg viewBox="0 0 24 24" width="22"><rect x="4.5" y="2.5" width="15" height="19" rx="2.5" fill="currentColor" /><circle cx="12" cy="10.5" r="3.6" fill="none" stroke="var(--tabbg)" strokeWidth="1.4" /><path d="M8.5 17.5h7" stroke="var(--tabbg)" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  layers: <svg viewBox="0 0 24 24" width="22"><path fill="currentColor" d="M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5L3 20.5z" /></svg>,
  cloud: <svg viewBox="0 0 24 24" width="24"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.2A3.5 3.5 0 0 0 7 18z" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>,
  locate: <svg viewBox="0 0 24 24" width="22"><path d="M21 3L3 10.5l7.5 3 3 7.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  dep: <svg viewBox="0 0 24 24" width="16"><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M8 16l8-8M10 8h6v6" stroke="var(--bg)" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>,
  arr: <svg viewBox="0 0 24 24" width="16"><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M8 8l8 8M16 10v6h-6" stroke="var(--bg)" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>,
  gear: <svg viewBox="0 0 24 24" width="22"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  star: (on: boolean) => <svg viewBox="0 0 24 24" width="20"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill={on ? "#f5b400" : "none"} stroke={on ? "#f5b400" : "currentColor"} strokeWidth="1.6" /></svg>,
  edit: <svg viewBox="0 0 24 24" width="22"><path d="M4 20l1-4L16 5l3 3L8 19z" fill="currentColor" /></svg>,
  alert: <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5L2.8 19.5h18.4z" /><path d="M12 10v4.2M12 17v.01" /></svg>,
  globe: <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3z" /></svg>,
  takeoff: <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20h18" /><path d="M4.5 14.5l3 1.2 12.2-5.2a1.8 1.8 0 0 0-1.4-3.3l-4 1.7L8 5.5 6.3 6.2l3.2 4.3-3.6 1.5-2-1.1-1 .5z" /></svg>,
  land: <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20h18" /><path d="M4 9.5l2.6 4.8 13 3.4a1.8 1.8 0 0 0 .9-3.5l-4.2-1.1-2.3-6.4-1.8-.5.4 5.4-3.8-1L7.7 7.4 6.6 7z" /></svg>,
  sliders: <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>,
  cal: <svg viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  bag: <svg viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="7" width="14" height="13" rx="2.5" /><path d="M9 7V4.5h6V7M9 11v5M15 11v5" /></svg>,
  glyph: <svg viewBox="0 0 24 24" width="18"><path fill="currentColor" transform="rotate(90 12 12)" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>,
  grid: <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></svg>,
  spark: <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3l2 6.2L20 12l-6 2.8L12 21l-2-6.2L4 12l6-2.8z" /></svg>,
  more: <svg viewBox="0 0 24 24" width="22"><circle cx="5" cy="12" r="2" fill="currentColor" /><circle cx="12" cy="12" r="2" fill="currentColor" /><circle cx="19" cy="12" r="2" fill="currentColor" /></svg>,
};
export function RoundBtn({ onClick, children, accent }: { onClick?: () => void; children: ReactNode; accent?: boolean }) {
  return <button className={"round" + (accent ? " accent" : "")} onClick={onClick}>{children}</button>;
}
/** iOS-style draggable bottom sheet. snaps = fraction of viewport height visible. Drag from the header. */
export function Sheet({ children, snaps = [0.42, 0.94], initial = 1, onClose, z = 10, header }: { children: ReactNode; snaps?: number[]; initial?: number; onClose?: () => void; z?: number; header?: ReactNode }) {
  const H = () => window.innerHeight, yFor = (s: number) => H() * (1 - s);
  const y = useMotionValue(H()); const spring = { type: "spring" as const, damping: 34, stiffness: 320 };
  useEffect(() => { animate(y, yFor(snaps[initial]), spring); }, []);
  const end = (_: any, i: PanInfo) => { const proj = y.get() + i.velocity.y * 0.18;
    if (onClose && proj > H() * 0.8) { animate(y, H(), { duration: 0.22 }).then(onClose); return; }
    let b = snaps[0], bd = 1e9; for (const s of snaps) { const d = Math.abs(yFor(s) - proj); if (d < bd) { bd = d; b = s; } } animate(y, yFor(b), spring); };
  return <motion.div className="sheet" style={{ zIndex: z, y }}>
    <motion.div className="sheet-head" onPan={(_, i) => y.set(Math.max(yFor(snaps.at(-1)!) - 20, y.get() + i.delta.y))} onPanEnd={end}><div className="grabber" />{header}</motion.div>
    <div className="sheet-body">{children}</div>
  </motion.div>;
}
export const Badge = ({ k, v, icon }: { k?: string; v?: string; icon?: ReactNode }) => <div className="ybadge">{icon}<b>{v || "--"}</b>{k && <small>{k}</small>}</div>;
