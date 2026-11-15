/** Eurovision studio stage cards — fan-made broadcast-style postcards in a fixed 1600×900 frame.
 *  Original artwork only (no official marks). Motion is transform/opacity (plus a short blur-in on text). */
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource-variable/fredoka";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/900.css";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { EvCard } from "./eurovision-data";
import "./evcards.css";

const W = 1600, H = 900;
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = (o: Record<string, string | number>) => o as CSSProperties;
const rng = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

const FONTS = ["800 100px 'Baloo 2'", "700 40px 'Baloo 2'", "700 100px 'Fredoka Variable'", "900 100px Montserrat", "700 40px Montserrat", "600 30px Montserrat"];
let fontsPromise: Promise<unknown> | null = null;
function useFontsReady() {
  const [ok, setOk] = useState(typeof document === "undefined");
  useEffect(() => {
    let dead = false; const done = () => { if (!dead) setOk(true); };
    const f = (document as any).fonts;
    if (!f?.load) { done(); return; }
    fontsPromise ||= Promise.all(FONTS.map(x => f.load(x).catch(() => null)));
    fontsPromise.then(done, done);
    const t = setTimeout(done, 2500);
    return () => { dead = true; clearTimeout(t); };
  }, []);
  return ok;
}

/** Largest font size (≤ max) at which text fits target width, measured with the real webfont. */
function fitSize(text: string, font: (px: number) => string, target: number, max: number, spacingEm = 0, ok = true) {
  if (!ok || typeof document === "undefined") return max;
  const g = document.createElement("canvas").getContext("2d"); if (!g) return max;
  g.font = font(100);
  const w = g.measureText(text).width + spacingEm * 100 * text.length;
  return Math.max(24, Math.min(max, (target / w) * 100));
}

/** Fixed 1600×900 stage scaled to the host; in fullscreen on a portrait phone it turns sideways. */
export function TvFrame({ full, children, className = "", ready }: { full?: boolean; children: ReactNode; className?: string; ready: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [k, setK] = useState({ s: 358 / W, rot: false });
  useIso(() => {
    const el = host.current; if (!el) return;
    const fit = () => {
      const bw = el.clientWidth, bh = el.clientHeight || bw * 9 / 16;
      if (full) { const rot = bh > bw * 1.05; setK({ s: rot ? Math.min(bh / W, bw / H) : Math.min(bw / W, bh / H), rot }); }
      else setK({ s: bw / W, rot: false });
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el); addEventListener("resize", fit);
    return () => { ro?.disconnect(); removeEventListener("resize", fit); };
  }, [full]);
  return (
    <div ref={host} className={"sc-host" + (full ? " full" : "")}>
      <div className={"sc-tv " + className + (ready ? " ready" : "") + (reduced() ? "" : " anim")}
        style={{ transform: `translate(-50%,-50%)${k.rot ? " rotate(90deg)" : ""} scale(${k.s})` }}>
        {children}
        <span className="sc-fan">Fan-made recreation</span>
      </div>
    </div>
  );
}

const Txt = ({ d, className, children, style }: { d: number; className: string; children: ReactNode; style?: CSSProperties }) =>
  <div className={"sc-txt " + className} style={{ ...style, "--d": d + "s" } as CSSProperties}>{children}</div>;

/* ───────────────────────── 1. Eurovision Asia — thermal hearts ───────────────────────── */

// Three organic heart outlines (100×100 box), deliberately uneven.
const HEART_PATHS = [
  "M50 91C30 77 6 60 4 36 2 17 17 5 33 7c9 1 14 7 17 15 3-9 9-15 19-16 16-1 30 12 27 31-3 24-26 41-46 54z",
  "M48 93C26 80 3 62 5 37 6 18 20 8 35 9c8 1 12 6 15 13 4-8 11-14 21-13 15 1 27 14 24 32-4 22-25 40-47 52z",
  "M52 90C32 79 8 63 5 40 3 20 15 6 31 6c10 0 15 7 18 15 2-9 9-16 20-16 17 0 30 14 26 33-4 22-23 39-43 52z",
];
// Thermal palettes, outer rim → core. Each band is the heart itself shrunk toward a hot spot,
// so the isotherms follow the heart's shape like a real heat-camera blob.
const PALS: { c: string; s: number }[][] = [
  [{ c: "#1a2cc0", s: 1 }, { c: "#2f45e4", s: .93 }, { c: "#c3162f", s: .84 }, { c: "#ef3a1c", s: .72 }, { c: "#ff8a18", s: .6 }, { c: "#ffc62a", s: .47 }, { c: "#ffef7a", s: .34 }, { c: "#fffbd6", s: .24 }, { c: "#d14fd6", s: .12 }],
  [{ c: "#1a2cc0", s: 1 }, { c: "#3049e8", s: .9 }, { c: "#7a1a8a", s: .8 }, { c: "#d01a2a", s: .74 }, { c: "#f2461a", s: .58 }, { c: "#ff9a1c", s: .44 }, { c: "#ffe04a", s: .3 }, { c: "#fff6c0", s: .2 }, { c: "#c23ad2", s: .1 }],
  [{ c: "#172aba", s: 1 }, { c: "#2c42e2", s: .86 }, { c: "#3a4cf0", s: .72 }, { c: "#a01650", s: .62 }, { c: "#d81c26", s: .5 }, { c: "#f04a1a", s: .36 }, { c: "#ff9a1e", s: .24 }, { c: "#ffe066", s: .14 }, { c: "#b232cc", s: .06 }],
];

function HeartDefs() {
  return (
    <svg className="sc-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <filter id="scthblur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.9" /></filter>
        <radialGradient id="scthshade" cx=".42" cy=".36" r=".7">
          <stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".32" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function HeartSvg({ shape, pal, hx, hy, seed }: { shape: number; pal: number; hx: number; hy: number; seed: number }) {
  const P = PALS[pal], d = HEART_PATHS[shape];
  const R = rng(seed * 7919 + pal * 31 + 1);
  // each isotherm wanders a little so the bands are uneven, like real heat spread
  const bands = P.slice(1).map(b => ({ ...b, s: Math.max(.04, b.s + (R() - .5) * .1), ox: (R() - .5) * 7, oy: (R() - .5) * 7 }));
  return (
    <svg viewBox="-4 -4 108 108" aria-hidden="true">
      <path d={d} fill={P[0].c} stroke="#13209a" strokeWidth="2.6" strokeLinejoin="round" />
      <g filter="url(#scthblur)">
        {bands.map((b, i) => <path key={i} d={d} fill={b.c} transform={`translate(${hx + b.ox * (1 - b.s)} ${hy + b.oy * (1 - b.s)}) scale(${b.s}) translate(${-hx} ${-hy})`} />)}
      </g>
      <path d={d} fill="url(#scthshade)" />
    </svg>
  );
}

type Heart = { x: number; y: number; s: number; r: number; sx: number; shape: number; ramp: number; alt: number; hx: number; hy: number; d: number; p: number; dx: number; dy: number; k: number };
function makeHearts(): Heart[] {
  const R = rng(20261114); const out: Heart[] = [];
  const add = (x: number, y: number, s: number, k: number) => {
    const ramp = Math.floor(R() * 3);
    out.push({ x, y, s, r: (R() - .5) * 80, sx: .86 + R() * .28, shape: Math.floor(R() * 3), ramp, alt: (ramp + 1 + Math.floor(R() * 2)) % 3, hx: 42 + R() * 16, hy: 38 + R() * 14,
      d: R() * -12, p: 6 + R() * 5, dx: (R() - .5) * 26, dy: (R() - .5) * 26, k });
  };
  // dense side bands (≈28% each side), staggered rows
  for (let side = 0; side < 2; side++) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 3; col++) {
        const cx = [-40, 150, 330][col] + (row % 2 ? 70 : 0) + (R() - .5) * 60;
        const cy = -60 + row * 138 + (R() - .5) * 50;
        const s = 210 + R() * 110 - (col === 2 ? 40 : 0);
        add(side ? W - cx : cx, cy, s, Math.abs(cy - H / 2) / H + (col * .2));
      }
    }
  }
  // spill along the top and bottom corners
  for (const [cx, cy] of [[470, -50], [600, -80], [1130, -50], [1000, -80], [480, 950], [620, 980], [1120, 950], [980, 980], [540, 20], [1060, 20], [530, 900], [1070, 900]] as const)
    add(cx + (R() - .5) * 40, cy + (R() - .5) * 30, 150 + R() * 70, .6);
  return out.sort((a, b) => b.s - a.s);
}

const ThermalHearts = memo(function ThermalHearts() {
  const hearts = useMemo(makeHearts, []);
  return (
    <div className="sc-hearts" aria-hidden="true">
      <HeartDefs />
      {hearts.map((h, i) => (
        <div key={i} className="sc-ht" style={css({ left: h.x - h.s / 2, top: h.y - h.s / 2, width: h.s, height: h.s, transform: `rotate(${h.r}deg) scaleX(${h.sx})`, "--k": h.k.toFixed(2) })}>
          <div className="sc-ht-in">
            <div className="sc-ht-b" style={css({ "--d": h.d + "s", "--p": h.p + "s", "--dx": h.dx + "px", "--dy": h.dy + "px" })}>
              <HeartSvg shape={h.shape} pal={h.ramp} hx={h.hx} hy={h.hy} seed={i} />
              <div className="sc-ht-alt" style={css({ "--d": h.d * .7 + "s", "--p": h.p * .8 + "s" })}><HeartSvg shape={h.shape} pal={h.alt} hx={h.hx + 3} hy={h.hy - 2} seed={i + 500} /></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

const AsiaStage = memo(function AsiaStage() {
  const lx = 800, ly = 250;
  const beams = useMemo(() => {
    const R = rng(77); const out: { a: number; len: number; w: number; o: number }[] = [];
    for (let i = 0; i < 34; i++) { const a = -84 + (i / 33) * 168 + (R() - .5) * 3; out.push({ a, len: 760 + R() * 300, w: 5 + R() * 10, o: .35 + R() * .45 }); }
    return out;
  }, []);
  const crowd = useMemo(() => {
    const R = rng(5); const out: { x: number; y: number; r: number }[] = [];
    for (let x = 360; x < 1260; x += 16 + R() * 14) out.push({ x, y: 868 + R() * 18, r: 13 + R() * 6 });
    return out;
  }, []);
  const beamSvg = (set: number) => (
    <svg viewBox={`0 0 ${W} ${H}`} className="sc-svgfill">
      <defs>
        <linearGradient id={`scbeam${set}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".35" stopColor="#fff" stopOpacity=".45" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {beams.filter((_, i) => i % 2 === set).map((b, i) => (
        <polygon key={i} points={`0,-1.2 ${b.len},${-b.w} ${b.len},${b.w} 0,1.2`} fill={`url(#scbeam${set})`} opacity={b.o}
          transform={`translate(${lx} ${ly}) rotate(${b.a - 90})`} />
      ))}
    </svg>
  );
  return (
    <div className="sc-asia-stage" aria-hidden="true">
      <div className="sc-asia-haze" />
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svgfill">
        <defs>
          <linearGradient id="scdeck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3a46" /><stop offset="1" stopColor="#0c0c10" /></linearGradient>
          <radialGradient id="sccrowdlight" cx=".5" cy=".9" r=".6"><stop offset="0" stopColor="#4a4a5e" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        </defs>
        <path d="M430 612 L1170 612 L1290 700 L310 700Z" fill="url(#scdeck)" opacity=".35" />
        <path d="M520 610 L1080 610 L1080 613 L520 613Z" fill="#8a8aa0" opacity=".18" />
        <ellipse cx="800" cy="860" rx="560" ry="150" fill="url(#sccrowdlight)" />
        {crowd.map((c, i) => <g key={i} fill="#030305"><circle cx={c.x} cy={c.y} r={c.r} /><ellipse cx={c.x} cy={c.y + c.r * 2.2} rx={c.r * 1.9} ry={c.r * 1.4} /></g>)}
      </svg>
      <div className="sc-beams a">{beamSvg(0)}</div>
      <div className="sc-beams b">{beamSvg(1)}</div>
      <div className="sc-asia-sun" />
    </div>
  );
});

function AsiaCard({ card, ok }: { card: EvCard; ok: boolean }) {
  const country = card.country || "Country";
  const big = fitSize(country, px => `800 ${px}px 'Baloo 2'`, 860, 230, 0, ok);
  const lines = (card.lyrics || "").split(/\s*(?:\n|&)\s*/).map(s => s.trim()).filter(Boolean);
  return (
    <>
      <div className="sc-bgfade sc-asia-bg" />
      <AsiaStage />
      <ThermalHearts />
      <div className="sc-asia-copy">
        <Txt d={1.0} className="sc-asia-song">{card.song || "Song"}</Txt>
        <Txt d={1.12} className="sc-asia-by">{card.artist ? `By ${card.artist}` : "By artist"}</Txt>
        <Txt d={1.3} className="sc-asia-country" style={{ fontSize: big }}>{country}</Txt>
        <Txt d={1.55} className="sc-asia-ml">Music &amp; Lyrics</Txt>
        {lines.map((l, i) => <Txt key={i} d={1.65 + i * .1} className="sc-asia-ly">{l}{i < lines.length - 1 ? "," : ""}</Txt>)}
      </div>
    </>
  );
}

/* ───────────────────────── 2. Eurovision 2026 — neon arena ───────────────────────── */

const Star4 = () => <svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-10C.7-2.2 2.2-.7 10 0 2.2.7.7 2.2 0 10-.7 2.2-2.2.7-10 0-2.2-.7-.7-2.2 0-10z" fill="#fff" /></svg>;

const EscArena = memo(function EscArena() {
  const seats = useMemo(() => {
    const R = rng(2026); const pts: string[] = [];
    for (let t = 0; t < 11; t++) {
      const rx = 560 + t * 92, ry = 230 + t * 34, cy = 1130;
      for (let a = 0; a < 140; a++) {
        const th = Math.PI + (a / 139) * Math.PI; if (R() < .35) continue;
        const x = 800 + Math.cos(th) * rx, y = cy + Math.sin(th) * ry;
        if (y > 905 || x < -10 || x > 1610) continue;
        const warm = R() < .6;
        pts.push(`<circle cx='${x.toFixed(1)}' cy='${(y + (R() - .5) * 6).toFixed(1)}' r='${(.9 + R() * 1.5).toFixed(2)}' fill='${warm ? "#ffd9a8" : "#ff9ad0"}' fill-opacity='${(.35 + R() * .6).toFixed(2)}'/>`);
      }
    }
    const tiers = Array.from({ length: 11 }, (_, t) => `<ellipse cx='800' cy='1130' rx='${560 + t * 92}' ry='${230 + t * 34}' fill='none' stroke='${t % 2 ? "#1b0f22" : "#140a18"}' stroke-width='30'/>`).join("");
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>${tiers}${pts.join("")}</svg>`)}")`;
  }, []);
  const rays = [
    { x: -120, y: 980, a: -38, w: 260, c: "230,20,50", d: 0, s: 6 }, { x: -60, y: 760, a: -20, w: 180, c: "255,40,70", d: -3, s: 5 },
    { x: -140, y: 520, a: -6, w: 150, c: "200,10,40", d: -6, s: 7 }, { x: 0, y: 1000, a: -58, w: 140, c: "255,60,80", d: -2, s: 6 },
    { x: 620, y: 1000, a: -82, w: 220, c: "255,40,170", d: -1, s: 5 }, { x: 800, y: 1000, a: -96, w: 260, c: "255,90,200", d: -4, s: 6 },
    { x: 980, y: 1000, a: -108, w: 200, c: "220,40,190", d: -5, s: 5 },
    { x: 1720, y: 980, a: -142, w: 260, c: "60,70,255", d: -2, s: 6 }, { x: 1660, y: 760, a: -160, w: 180, c: "90,90,255", d: -5, s: 5 },
    { x: 1740, y: 520, a: -174, w: 150, c: "70,40,230", d: -1, s: 7 }, { x: 1600, y: 1000, a: -122, w: 140, c: "110,80,255", d: -6, s: 6 },
  ];
  const lasers = [
    { x: -100, y: 120, a: 14, d: 0 }, { x: -100, y: 640, a: -22, d: -4 }, { x: 1700, y: 200, a: 158, d: -2 }, { x: 1700, y: 700, a: 200, d: -6 },
    { x: 300, y: 950, a: -48, d: -3 }, { x: 1300, y: 950, a: -132, d: -1 },
  ];
  const stars = useMemo(() => {
    const R = rng(44); return Array.from({ length: 34 }, () => ({ x: R() * W, y: R() * 640, s: 12 + R() * 34, d: -R() * 4, p: 1.6 + R() * 2.4 }));
  }, []);
  return (
    <div className="sc-esc-arena" aria-hidden="true">
      <div className="sc-esc-glow" />
      <div className="sc-esc-seats" style={{ backgroundImage: seats }} />
      <div className="sc-esc-decor">
        {rays.map((r, i) => <i key={i} className="sc-ray" style={css({ left: r.x, top: r.y, width: 2000, height: r.w * (i >= 4 && i <= 6 ? 2 : 3), marginTop: -r.w * (i >= 4 && i <= 6 ? 1 : 1.5), "--a": r.a + "deg", "--c": r.c, "--d": r.d + "s", "--s": r.s + "deg" })}><b /></i>)}
        {lasers.map((l, i) => <i key={i} className="sc-laser" style={css({ left: l.x, top: l.y, "--a": l.a + "deg", "--d": l.d + "s" })} />)}
        {stars.map((s, i) => <span key={i} className="sc-star" style={css({ left: s.x - s.s / 2, top: s.y - s.s / 2, width: s.s, height: s.s, "--d": s.d + "s", "--p": s.p + "s" })}><Star4 /></span>)}
      </div>
    </div>
  );
});

function Neon({ text, ok }: { text: string; ok: boolean }) {
  const T = text.toUpperCase();
  const size = fitSize(T, px => `700 ${px}px 'Fredoka Variable'`, 1380, 220, .04, ok);
  const letters = [...T];
  const layer = (cls: string) => (
    <div className={"sc-neon-l " + cls} aria-hidden="true">
      {letters.map((ch, i) => <span key={i} style={css({ "--i": i })}>{ch === " " ? "\u00a0" : ch}</span>)}
    </div>
  );
  return (
    <div className="sc-neon" role="img" aria-label={T} style={{ fontSize: size }}>
      {layer("depth")}{layer("halo")}{layer("glow")}{layer("tube")}
    </div>
  );
}

function EscCard({ card, ok }: { card: EvCard; ok: boolean }) {
  const lines = (card.lyrics || "").split(/\s*(?:\n|&|\/)\s*/).map(s => s.trim()).filter(Boolean);
  const song = (card.song || "Song").toUpperCase();
  const songSize = fitSize(song, px => `700 ${px}px 'Fredoka Variable'`, 640, 128, .02, ok);
  return (
    <>
      <div className="sc-bgfade sc-esc-bg" />
      <EscArena />
      <div className="sc-esc-title"><Neon text={card.country || "Country"} ok={ok} /></div>
      <div className="sc-esc-l">
        <Txt d={1.7} className="sc-esc-song" style={{ fontSize: songSize }}>{song}</Txt>
        {card.artist ? <Txt d={1.85} className="sc-esc-by">BY {card.artist.toUpperCase()}</Txt> : null}
      </div>
      <div className="sc-esc-r">
        <Txt d={2.0} className="sc-esc-k">MUSIC &amp; LYRICS</Txt>
        {lines.map((l, i) => <Txt key={i} d={2.1 + i * .1} className="sc-esc-ly">{l.toUpperCase()}</Txt>)}
      </div>
    </>
  );
}

/* ───────────────────────── 3. Junior Eurovision 2026 — tiara ───────────────────────── */

/* Original symmetrical line-art tiara (not the official JESC mark). Left half is drawn, right half mirrored. */
type TP = { d: string; c: string; w: number; t: number };
const T_CENTRE: TP[] = [
  { d: "M141 12 L159 12 L150 28 Z", c: "#ff5fc8", w: 1.6, t: 0 },
  { d: "M150 34 a22 22 0 1 1 -.01 0 Z", c: "#ff7ad9", w: 1.5, t: .08 },
  { d: "M150 70c-9-7-13-14-8-19 4-4 8 0 8 0s4-4 8 0c5 5 1 12-8 19z", c: "#ff9be3", w: 1.4, t: .2 },
  { d: "M40 106 C100 119 200 119 260 106", c: "#f2c14e", w: 1.8, t: .35 },
  { d: "M58 112 C110 121 190 121 242 112", c: "#ff7ad9", w: 1.1, t: .5 },
];
const T_HALF: TP[] = [
  { d: "M131 72 C114 77 101 67 104 55 C106 46 117 45 119 53 C120 59 113 61 111 56", c: "#ffe566", w: 1.5, t: .3 },
  { d: "M128 84 C100 93 73 80 74 58 C75 41 93 37 99 48 C103 57 94 64 87 59", c: "#ff4fc0", w: 1.6, t: .42 },
  { d: "M120 96 C86 108 46 100 34 80 C26 64 40 54 49 62 C55 68 49 76 42 72", c: "#ff3fb0", w: 1.5, t: .55 },
  { d: "M112 40 C104 28 108 18 117 20 C122 21 122 28 117 29", c: "#ffe566", w: 1.3, t: .62 },
  { d: "M64 44 C58 36 62 28 70 30", c: "#8fd3ff", w: 1.2, t: .7 },
  { d: "M92 100 C84 102 80 98 82 94", c: "#8fd3ff", w: 1.2, t: .72 },
];
const T_DOTS: [number, number, number, string][] = [[150, 36, 1.6, "#8fd3ff"], [126, 50, 1.8, "#ffe566"], [174, 50, 1.8, "#ffe566"], [133, 30, 1.3, "#8fd3ff"], [167, 30, 1.3, "#8fd3ff"],
  [150, 86, 1.8, "#ffe566"], [40, 106, 2.4, "#8fd3ff"], [260, 106, 2.4, "#8fd3ff"], [58, 50, 1.6, "#ff9be3"], [242, 50, 1.6, "#ff9be3"], [96, 32, 1.3, "#ffe566"], [204, 32, 1.3, "#ffe566"]];

function Tiara({ sparkle }: { sparkle: boolean }) {
  const strokes = (k: number) => (
    <>
      {T_CENTRE.map((p, i) => <path key={"c" + i} d={p.d} pathLength={1} stroke={p.c} strokeWidth={p.w * k} style={css({ "--d": p.t + "s" })} />)}
      {T_HALF.map((p, i) => <path key={"l" + i} d={p.d} pathLength={1} stroke={p.c} strokeWidth={p.w * k} style={css({ "--d": p.t + "s" })} />)}
      <g transform="translate(300 0) scale(-1 1)">
        {T_HALF.map((p, i) => <path key={"r" + i} d={p.d} pathLength={1} stroke={p.c} strokeWidth={p.w * k} style={css({ "--d": p.t + "s" })} />)}
      </g>
      {T_DOTS.map(([x, y, r, c], i) => <circle key={"d" + i} cx={x} cy={y} r={r} pathLength={1} stroke={c} strokeWidth={1.1 * k} style={css({ "--d": .8 + (i % 6) * .05 + "s" })} />)}
    </>
  );
  return (
    <div className="sc-tiara">
      <svg className="sc-tiara-glow" viewBox="0 0 300 130" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{strokes(3)}</svg>
      <svg className="ev-crown sc-tiara-line" viewBox="0 0 300 130" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {strokes(1)}
        {sparkle && (
          <g className="sc-spark">
            <circle r="4" fill="#fff" opacity=".3" /><circle r="1.3" fill="#fff" />
            <path d="M0-7L.6-.6 7 0 .6.6 0 7-.6.6-7 0-.6-.6z" fill="#fff" />
            <animateMotion dur="2.6s" begin="1.2s" repeatCount="indefinite" path="M40 106 C100 119 200 119 260 106 C200 119 100 119 40 106" />
          </g>
        )}
      </svg>
    </div>
  );
}

const JescArena = memo(function JescArena() {
  const lights = useMemo(() => { const R = rng(9); return Array.from({ length: 12 }, (_, i) => ({ x: 30 + i * 56, y: 92 + (30 + i * 56) * (78 / 700), d: -R() * 3, p: 2 + R() * 2 })); }, []);
  return (
    <div className="sc-jesc-arena" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svgfill">
        <defs><linearGradient id="sctruss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6c7cc8" stopOpacity=".55" /><stop offset="1" stopColor="#6c7cc8" stopOpacity="0" /></linearGradient></defs>
        <g stroke="url(#sctruss)" strokeWidth="2" fill="none">
          <path d="M0 52 L700 130" /><path d="M0 82 L700 160" />
          {Array.from({ length: 24 }, (_, i) => <path key={i} d={`M${i * 29} ${52 + i * 3.25} L${i * 29 + 14.5} ${82 + i * 3.25 + 1.6} L${i * 29 + 29} ${52 + (i + 1) * 3.25}`} />)}
        </g>
        {Array.from({ length: 9 }, (_, t) => <ellipse key={t} cx="800" cy="1180" rx={620 + t * 110} ry={300 + t * 40} fill="none" stroke="#1d2a6e" strokeOpacity={.35 - t * .025} strokeWidth="22" />)}
      </svg>
      {lights.map((l, i) => <i key={i} className="sc-jl" style={css({ left: l.x, top: l.y, "--d": l.d + "s", "--p": l.p + "s" })} />)}
      <i className="sc-haze h1" /><i className="sc-haze h2" /><i className="sc-haze h3" />
    </div>
  );
});

function JescCard({ card, ok }: { card: EvCard; ok: boolean }) {
  const C = (card.country || "Country").toUpperCase();
  const big = fitSize(C, px => `900 ${px}px Montserrat`, 1180, 220, .03, ok);
  const songLine = `${(card.song || "Song").toUpperCase()}${card.artist ? ` - ${card.artist.toUpperCase()}` : ""}`;
  const songSize = fitSize(songLine, px => `700 ${px}px Montserrat`, 1240, 48, .1, ok);
  return (
    <>
      <div className="sc-bgfade sc-jesc-bg" />
      <JescArena />
      <div className="sc-jesc-copy">
        <Tiara sparkle={!reduced()} />
        <Txt d={1.5} className="sc-jesc-country" style={{ fontSize: big }}>{C}</Txt>
        <Txt d={1.7} className="sc-jesc-song" style={{ fontSize: songSize }}>{songLine}</Txt>
        {card.lyrics ? <Txt d={1.85} className="sc-jesc-ly">MUSIC &amp; LYRICS: {card.lyrics.toUpperCase()}</Txt> : null}
      </div>
    </>
  );
}

export function StageCardTV({ card, play, full }: { card: EvCard; play: number; full?: boolean }) {
  const ok = useFontsReady();
  const body = card.style === "asia" ? <AsiaCard card={card} ok={ok} /> : card.style === "esc" ? <EscCard card={card} ok={ok} /> : <JescCard card={card} ok={ok} />;
  return (
    <TvFrame full={full} ready={ok} className={"sc-" + card.style} key={`${card.style}-${play}`}>
      {body}
    </TvFrame>
  );
}
