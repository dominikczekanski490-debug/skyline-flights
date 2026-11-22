// Shared bits for the v44 mini-games: a rAF loop that sleeps when the page is hidden, a DPR-aware canvas, hold-to-press buttons and the end card.
import { useEffect, useRef, type ReactNode } from "react";
export { sfx } from "../mgr/sfx";
import "./games44.css";

/** Calls cb(dt seconds) every animation frame while `on`; skips hidden pages and clamps long frames. */
export function useLoop(cb: (dt: number) => void, on: boolean) { const r = useRef(cb); r.current = cb;
  useEffect(() => { if (!on) return; let raf = 0, last = performance.now(); const f = (t: number) => { raf = requestAnimationFrame(f); const dt = Math.min(0.05, (t - last) / 1000); last = t; if (!document.hidden) r.current(dt); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [on]); }

/** Canvas sized to its box × devicePixelRatio (max 2). draw(ctx, w, h) gets CSS-pixel units. */
export function useCanvas() { const ref = useRef<HTMLCanvasElement>(null);
  const get = () => { const c = ref.current; if (!c) return null; const d = Math.min(2, devicePixelRatio || 1); const w = c.clientWidth, h = c.clientHeight; if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); } const x = c.getContext("2d")!; x.setTransform(d, 0, 0, d, 0, 0); return { x, w, h }; };
  return [ref, get] as const; }

/** A button that reports while it is held down (touch, mouse or pen). */
export function Hold({ on, children, cls = "", label }: { on: (down: boolean) => void; children: ReactNode; cls?: string; label?: string }) {
  return <button className={"g4-hold " + cls} aria-label={label} onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); on(true); }} onPointerUp={() => on(false)} onPointerCancel={() => on(false)} onPointerLeave={() => on(false)} onContextMenu={e => e.preventDefault()}>{children}</button>; }

export function End({ big, unit, nb, msg, children }: { big?: ReactNode; unit?: string; nb?: boolean; msg?: ReactNode; children?: ReactNode }) {
  return <div className="gq-end g4-end">{big != null && <><div className="gq-big">{big}</div>{unit && <div>{unit}</div>}</>}{nb && <div className="gq-nb">New best!</div>}{msg && <p className="sm muted">{msg}</p>}{children}</div>; }
export const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** A simple original airliner silhouette for canvas (nose pointing +x, size ≈ 2·s). */
export function drawPlane(x: CanvasRenderingContext2D, cx: number, cy: number, s: number, ang: number, body = "#f4f6fa", tail = "#2563eb") {
  x.save(); x.translate(cx, cy); x.rotate(ang); x.scale(s / 7, s / 7); x.beginPath();
  x.moveTo(7, 0); x.lineTo(4.5, 1); x.lineTo(1, 1.1); x.lineTo(-2.5, 4.6); x.lineTo(-3.6, 4.6); x.lineTo(-1.8, 1); x.lineTo(-5, .9); x.lineTo(-6.4, 2.2); x.lineTo(-7.2, 2.2); x.lineTo(-6.4, 0); x.lineTo(-7.2, -2.2); x.lineTo(-6.4, -2.2); x.lineTo(-5, -.9); x.lineTo(-1.8, -1); x.lineTo(-3.6, -4.6); x.lineTo(-2.5, -4.6); x.lineTo(1, -1.1); x.lineTo(4.5, -1); x.closePath();
  x.fillStyle = body; x.fill(); x.lineWidth = .35; x.strokeStyle = "#0b1220"; x.stroke(); x.beginPath(); x.moveTo(-5, -.9); x.lineTo(-6.4, -2.2); x.lineTo(-7.2, -2.2); x.lineTo(-6.4, 0); x.lineTo(-7.2, 2.2); x.lineTo(-6.4, 2.2); x.lineTo(-5, .9); x.closePath(); x.fillStyle = tail; x.fill(); x.restore(); }
