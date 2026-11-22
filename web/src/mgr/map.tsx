// Airport Manager: the top-down build map (SVG grid) with animated planes, day/night lighting and build highlights.
import { memo } from "react";
import { MY_AL, myLiveryCached } from "../g/myair";
import { W, H, taxiPath, standName, type Save, type Tile, type Rot } from "./sim";

export const TERM_COL: Record<string, [string, string]> = { glass: ["#a9c9e8", "#5b7fa6"], timber: ["#d9b483", "#8a6239"], concrete: ["#b4b6b8", "#6d6f72"], heritage: ["#e3d3ad", "#7a5b3a"] };
export const AL_COL = (al: string) => { if (al === MY_AL) return myLiveryCached()?.tail || "#2563eb"; let h = 0; for (const c of al || "XX") h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 70% 48%)`; };
/** 0 = full day, 1 = full night (sunrise ~06:30, sunset ~18:30, soft dusk/dawn). */
export const nightOf = (clock: number) => { const m = ((clock % 1440) + 1440) % 1440; const k = (a: number, b: number) => Math.max(0, Math.min(1, (m - a) / (b - a))); return m < 360 ? 1 : m < 420 ? 1 - k(360, 420) : m < 1080 ? 0 : m < 1170 ? k(1080, 1170) : 1; };
const ICON: Partial<Record<Tile, string>> = { sh: "🛍️", fd: "🍔", pk: "🚗", rl: "🚆", sc: "🛂", bg: "🧳", hg: "🛠️" };
const cx = (i: number) => (i % W) * 10 + 5, cy = (i: number) => Math.floor(i / W) * 10 + 5;

/** Where a plane is drawn (x, y in map units, heading in degrees, 0 = east) for its phase and progress. */
export function planePos(s: Save, r: Rot, clock: number): { x: number; y: number; h: number; z: number } | null {
  if (r.stand == null || ["sched", "gone", "cxl", "hold"].includes(r.ph)) return null; const path = taxiPath(s.grid, r.stand); if (!path.length) return null;
  const pr = (d: number) => Math.max(0, Math.min(1, (clock - r.t0) / d)); const rwY = cy(path[0]); const ex = cx(path[0]);
  const along = (p: number[], t: number) => { const n = p.length - 1; const f = t * n; const i = Math.min(n - 1, Math.floor(f)), u = f - i; const a = p[i], b = p[Math.min(n, i + 1)]; return { x: cx(a) + (cx(b) - cx(a)) * u, y: cy(a) + (cy(b) - cy(a)) * u, h: Math.atan2(cy(b) - cy(a), cx(b) - cx(a)) * 180 / Math.PI }; };
  switch (r.ph) {
    case "app": { const t = pr(6); if (t < 0.5) return null; const u = (t - 0.5) * 2; return { x: -40 + u * 40, y: rwY, h: 0, z: 1.6 - u * 0.6 }; }
    case "land": { const t = pr(2); const u = 1 - (1 - t) * (1 - t); return { x: u * ex, y: rwY, h: 0, z: 1 }; }
    case "taxiIn": { const p = along(path, pr(4)); return { ...p, z: 1 }; }
    case "park": { const st = path.at(-1)!, prev = path.at(-2)!; return { x: cx(st), y: cy(st), h: Math.atan2(cy(st) - cy(prev), cx(st) - cx(prev)) * 180 / Math.PI, z: 1 }; }
    case "push": { const st = path.at(-1)!, prev = path.at(-2)!; const u = pr(3) * 0.55; return { x: cx(st) + (cx(prev) - cx(st)) * u, y: cy(st) + (cy(prev) - cy(st)) * u, h: Math.atan2(cy(st) - cy(prev), cx(st) - cx(prev)) * 180 / Math.PI, z: 1 }; }
    case "taxiOut": { const rev = path.slice(0, -1).reverse(); const p = rev.length > 1 ? along(rev, pr(4)) : { x: cx(path[0]), y: rwY, h: 0 }; return { ...p, z: 1 }; }
    case "tkof": { const t = pr(2); return { x: ex + t * t * (W * 10 + 40 - ex), y: rwY, h: 0, z: 1 + t * t * 0.8 }; }
  } return null; }

export const PlaneShape = ({ col }: { col: string }) => <g><path d="M7 0 L4.5 1 L1 1.1 L-2.5 4.6 L-3.6 4.6 L-1.8 1 L-5 0.9 L-6.4 2.2 L-7.2 2.2 L-6.4 0 L-7.2 -2.2 L-6.4 -2.2 L-5 -0.9 L-1.8 -1 L-3.6 -4.6 L-2.5 -4.6 L1 -1.1 L4.5 -1 Z" fill="#f4f6fa" stroke="#0b1220" strokeWidth=".35" /><path d="M-5 -0.9 L-6.4 -2.2 L-7.2 -2.2 L-6.4 0 L-7.2 2.2 L-6.4 2.2 L-5 0.9 Z" fill={col} /></g>;

type P = { s: Save; clock: number; ok?: (i: number) => boolean; onTile: (i: number) => void; sel?: number | null; floats: { id: number; i: number; txt: string; k: string }[]; follow?: string | null };
export const MgrMap = memo(function MgrMap({ s, clock, ok, onTile, sel, floats }: P) {
  const g = s.grid; const n = nightOf(clock); const [tc, tcd] = TERM_COL[s.term] || TERM_COL.glass; const grass = n > 0.5 ? "#173a27" : "#3f7d4e";
  const tiles = g.map((t, i) => { const x = (i % W) * 10, y = Math.floor(i / W) * 10; const k = `t${i}`;
    let body: any;
    switch (t) {
      case "g": { const h = (i * 2654435761) >>> 0; const tree = Math.floor(i / W) >= 5 && h % 5 === 0; body = <g><rect x={x} y={y} width={10} height={10} fill={grass} />{h % 3 === 0 && <rect x={x + (h % 7)} y={y + (h % 5) + 2} width={2.4} height={.5} fill="#ffffff" opacity={.08} />}{tree && <><circle cx={x + 3 + (h % 4)} cy={y + 4} r={2.2} fill={n > .5 ? "#0f2a1b" : "#2f6b3c"} /><circle cx={x + 6 + (h % 3)} cy={y + 6.5} r={1.7} fill={n > .5 ? "#10301e" : "#35753f"} /></>}</g>; break; }
      case "rw": body = <g><rect x={x} y={y} width={10} height={10} fill="#2a2e35" /><rect x={x + 2} y={y + 4.7} width={6} height={0.6} fill="#e8e8e8" opacity={.85} />{n > 0.25 && <><circle cx={x + 5} cy={y + 0.8} r={0.55} fill="#ffe27a" opacity={n} /><circle cx={x + 5} cy={y + 9.2} r={0.55} fill="#ffe27a" opacity={n} /></>}</g>; break;
      case "tx": body = <g><rect x={x} y={y} width={10} height={10} fill="#454b57" /><rect x={x} y={y + 4.75} width={10} height={0.5} fill="#f5c400" opacity={.8} />{n > 0.25 && <circle cx={x + 5} cy={y + 5} r={0.45} fill="#22c55e" opacity={n} />}</g>; break;
      case "st": body = <g><rect x={x} y={y} width={10} height={10} fill="#5b6170" /><rect x={x + 1.2} y={y + 1.2} width={7.6} height={7.6} fill="none" stroke="#f5c400" strokeWidth=".5" strokeDasharray="1.2 .8" /><text x={x + 5} y={y + 6.4} fontSize="3.6" textAnchor="middle" fill="#fff" fontWeight="700">{standName(g, i)}</text></g>; break;
      case "gt": body = <g><rect x={x} y={y} width={10} height={10} fill="#5b6170" /><rect x={x + 4} y={y} width={2} height={7} fill={tcd} rx=".6" /><text x={x + 2.2} y={y + 9} fontSize="3.2" fill="#fff" fontWeight="700">{standName(g, i)}</text></g>; break;
      case "tm": body = <g><rect x={x} y={y} width={10} height={10} fill={tc} stroke={tcd} strokeWidth=".6" />{[1.5, 4.5, 7.5].map(o => <rect key={o} x={x + o} y={y + 2} width={1.6} height={6} fill={n > 0.3 ? "#ffd98a" : "#2c3e57"} opacity={n > 0.3 ? .9 : .45} />)}</g>; break;
      case "tw": body = <g><rect x={x} y={y} width={10} height={10} fill={grass} /><rect x={x + 4} y={y + 3} width={2} height={7} fill="#cfd6e0" /><path d={`M${x + 2} ${y + 4} L${x + 8} ${y + 4} L${x + 7} ${y + 1} L${x + 3} ${y + 1} Z`} fill={n > 0.3 ? "#7dd3fc" : "#334155"} stroke="#cfd6e0" strokeWidth=".5" /><circle cx={x + 5} cy={y + .6} r=".5" fill="#ef4444" className="mg-blink" /></g>; break;
      default: body = <g><rect x={x} y={y} width={10} height={10} fill={t === "pk" ? "#6b7280" : t === "rl" ? "#4b5563" : tc} stroke={tcd} strokeWidth=".4" /><text x={x + 5} y={y + 6.8} fontSize="5.4" textAnchor="middle">{ICON[t]}</text></g>;
    }
    const can = ok?.(i); return <g key={k} onClick={() => onTile(i)} className={"mg-tile" + (can ? " can" : "") + (sel === i ? " sel" : "")}>{body}{ok && <rect x={x + .3} y={y + .3} width={9.4} height={9.4} fill={can ? "rgba(74,222,128,.22)" : "rgba(0,0,0,.18)"} stroke={can ? "#4ade80" : "none"} strokeWidth=".5" rx="1" />}{sel === i && <rect x={x + .3} y={y + .3} width={9.4} height={9.4} fill="none" stroke="#fff" strokeWidth=".8" rx="1" />}</g>; });
  const planes = s.rots.map(r => { const p = planePos(s, r, clock); if (!p) return null; return <g key={r.id} className="mg-plane" style={{ transform: `translate(${p.x}px,${p.y}px) rotate(${p.h}deg) scale(${p.z * 0.68})` }}>{p.z > 1.05 && <ellipse cx={-1.5} cy={3} rx={6} ry={2} fill="#000" opacity={.18} />}<PlaneShape col={r.vip ? "#111" : AL_COL(r.al)} />{r.ph === "park" && <g className="mg-cart"><rect x={-2} y={5.5} width={3} height={1.6} rx=".4" fill="#facc15" /><rect x={1.4} y={5.7} width={2} height={1.2} rx=".3" fill="#e2e8f0" /></g>}{n > 0.3 && <><circle cx={-1.8} cy={-4.4} r=".5" fill="#ef4444" /><circle cx={-1.8} cy={4.4} r=".5" fill="#22c55e" /></>}</g>; });
  const holding = s.rots.filter(r => r.ph === "hold").length;
  return <div className="mg-mapw"><svg viewBox={`0 0 ${W * 10} ${H * 10}`} className="mg-svg" role="img" aria-label="Airport map">{tiles}<rect x={0} y={0} width={W * 10} height={H * 10} fill="#0a1430" opacity={n * 0.42} pointerEvents="none" /><g pointerEvents="none">{planes}</g>
    {floats.map(f => <text key={f.id} x={cx(f.i)} y={cy(f.i)} className={"mg-float " + f.k} textAnchor="middle" fontSize="4.2" fontWeight="800" pointerEvents="none">{f.txt}</text>)}</svg>
    {holding > 0 && <div className="mg-holding">✈︎ {holding} holding: no free stand!</div>}</div>;
});
