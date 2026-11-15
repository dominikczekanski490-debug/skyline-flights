/** Junior Eurovision 2026 results board — fan-made broadcast-style recreation.
 *  Fixed 1600×900 TV frame scaled to fit; rows are absolutely placed by rank so re-sorts are pure transform transitions. */
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { sortRows, qualifies, EV_ROUND_LABEL, type EvBoard, type EvRow } from "./eurovision-data";
import "./evjesc.css";

const W = 1600, H = 900;
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const NAME_FONT = "Montserrat";

/** Board geometry for n rows: 1 column up to 7, then column-major 2 columns. */
export function jescLayout(n: number) {
  const cols = n <= 7 ? 1 : 2;
  const per = Math.max(1, Math.ceil(n / cols));
  const h = Math.min(78, 744 / (per + 0.25 * (per - 1)));
  const gap = h * 0.25, w = h * 6.5, colGap = 124;
  const totW = cols * w + (cols - 1) * colGap, totH = per * h + (per - 1) * gap;
  const x0 = (W - totW) / 2, y0 = (H - totH) / 2 + 14;
  const pos = (i: number) => ({ x: x0 + Math.floor(i / per) * (w + colGap), y: y0 + (i % per) * (h + gap) });
  return { cols, per, h, w, gap, pos };
}

/* Deterministic starfield as one static SVG background. */
function starSvg(seed: number, count: number, maxR: number, alpha: number) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let c = "";
  for (let i = 0; i < count; i++) c += `<circle cx='${(rnd() * W).toFixed(1)}' cy='${(rnd() * H).toFixed(1)}' r='${(0.5 + rnd() * maxR).toFixed(2)}' fill='#fff' fill-opacity='${(alpha * (0.35 + rnd() * 0.65)).toFixed(2)}'/>`;
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>${c}</svg>`)}")`;
}

const BOKEH: { x: number; y: number; s: number; c: string; d: number; p: number; dx: number; dy: number }[] = [
  { x: 4, y: 8, s: 150, c: "255,79,160", d: 26, p: 7, dx: 40, dy: 24 },
  { x: 16, y: 72, s: 110, c: "62,224,143", d: 31, p: 6, dx: -30, dy: -36 },
  { x: 1, y: 44, s: 70, c: "57,208,255", d: 22, p: 5, dx: 26, dy: 30 },
  { x: 27, y: 2, s: 60, c: "255,216,74", d: 28, p: 8, dx: -24, dy: 20 },
  { x: 88, y: 10, s: 130, c: "57,208,255", d: 29, p: 6.5, dx: -36, dy: 26 },
  { x: 94, y: 56, s: 160, c: "255,79,160", d: 34, p: 7.5, dx: -28, dy: -30 },
  { x: 76, y: 84, s: 90, c: "255,216,74", d: 24, p: 5.5, dx: 30, dy: -22 },
  { x: 68, y: 4, s: 50, c: "62,224,143", d: 27, p: 6, dx: 22, dy: 28 },
  { x: 45, y: 92, s: 120, c: "255,79,160", d: 33, p: 8, dx: -34, dy: -18 },
  { x: 52, y: 1, s: 80, c: "57,208,255", d: 25, p: 7, dx: 28, dy: 22 },
  { x: 8, y: 92, s: 64, c: "255,216,74", d: 23, p: 6, dx: 26, dy: -26 },
  { x: 98, y: 92, s: 54, c: "62,224,143", d: 30, p: 5, dx: -22, dy: -24 },
  { x: 36, y: 50, s: 46, c: "57,208,255", d: 36, p: 9, dx: 20, dy: -26 },
  { x: 62, y: 46, s: 40, c: "255,216,74", d: 32, p: 7, dx: -18, dy: 24 },
  { x: 84, y: 34, s: 44, c: "62,224,143", d: 27, p: 6, dx: 18, dy: 22 },
  { x: 20, y: 26, s: 38, c: "255,79,160", d: 29, p: 8, dx: -20, dy: 18 },
];

const Background = memo(function Background() {
  const far = useMemo(() => starSvg(7, 240, 0.9, 0.55), []);
  const near = useMemo(() => starSvg(91, 60, 1.4, 0.9), []);
  return (
    <div className="jb-bg" aria-hidden="true">
      <i className="jb-stars" style={{ backgroundImage: far }} />
      <i className="jb-stars tw" style={{ backgroundImage: near }} />
      {BOKEH.map((b, i) => (
        <i key={i} className="jb-bk" style={{ left: b.x + "%", top: b.y + "%", width: b.s, height: b.s, "--c": b.c, "--d": b.d + "s", "--p": b.p + "s", "--dx": b.dx + "px", "--dy": b.dy + "px", "--o": `${-(i * 1.7)}s` } as CSSProperties}><b /></i>
      ))}
      <i className="jb-vig" />
    </div>
  );
});

/** Writes the number straight to the DOM so 16 count-ups don't re-render React each frame. */
function useTicker(n: number, introDelay: number | null) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(introDelay != null ? 0 : n);
  useIso(() => {
    const el = ref.current; if (!el) return;
    const from = shown.current, to = n;
    if (reduced() || from === to) { shown.current = to; el.textContent = String(to); return; }
    el.textContent = String(from);
    const delay = shown.current === 0 && introDelay != null ? introDelay : 0;
    const dur = introDelay != null && from === 0 ? 900 : Math.min(900, 380 + Math.abs(to - from) * 14);
    let raf = 0; const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - t0) / dur));
      const e = 1 - (1 - p) ** 3;
      const v = Math.round(from + (to - from) * e);
      if (String(v) !== el.textContent) el.textContent = String(v);
      shown.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); };
  }, [n]);
  return ref;
}

/* Flags are drawn once into canvases: a canvas is a ready texture, so moving/scaling layers never
   shows an undecoded (blank) SVG image mid-animation. Vector source = bundled flag-icons SVGs. */
const FW = 300, FH = 207;
const flagCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadFlag(cc: string) {
  let p = flagCache.get(cc);
  if (!p) {
    p = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `/flags/4x3/${cc}.svg`; });
    flagCache.set(cc, p);
  }
  return p;
}
function FlagCanvas({ cc }: { cc: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useIso(() => {
    let dead = false;
    loadFlag(cc).then(im => {
      const cv = ref.current; if (dead || !cv || !im) return;
      const g = cv.getContext("2d"); if (!g) return;
      // cover-fit the 4:3 source into the 1.45:1 frame
      const dh = FW * 3 / 4;
      g.clearRect(0, 0, FW, FH);
      g.drawImage(im, 0, (FH - dh) / 2, FW, dh);
      cv.dataset.drawn = "1";
    });
    return () => { dead = true; };
  }, [cc]);
  return <canvas ref={ref} width={FW} height={FH} data-src={`/flags/4x3/${cc}.svg`} aria-hidden="true" />;
}

const SHORT: Record<string, string> = { BA: "Bosnia & Herzegovina", GB: "United Kingdom", CD: "DR Congo", CF: "Central African Rep.", AG: "Antigua & Barbuda", KN: "St Kitts & Nevis", VC: "St Vincent", ST: "São Tomé & Príncipe", TT: "Trinidad & Tobago" };

type RowProps = { r: EvRow; rank: number; x: number; y: number; w: number; h: number; q: boolean; fit: number; intro: boolean; onPick?: (id: string) => void };

const JRow = memo(function JRow({ r, rank, x, y, w, h, q, fit, intro, onPick }: RowProps) {
  const idx = rank - 1;
  const ticker = useTicker(r.points, intro ? 420 + idx * 60 : null);
  const prev = useRef(r.points);
  const [hit, setHit] = useState(0);
  const [hot, setHot] = useState(false);
  useEffect(() => {
    if (r.points > prev.current) { setHit(k => k + 1); setHot(true); }
    prev.current = r.points;
  }, [r.points]);
  useEffect(() => { if (!hot) return; const t = setTimeout(() => setHot(false), 1700); return () => clearTimeout(t); }, [hot, hit]);
  const c = (r.cc || "").toLowerCase();
  const style = { transform: `translate3d(${x}px,${y}px,0)`, width: w, height: h, "--h": h + "px", "--i": idx, "--fit": Math.max(fit, 0.74), "--sx": fit < 0.74 ? fit / 0.74 : 1, zIndex: hot ? 3 : 1 } as CSSProperties;
  const cls = "jb-row" + (rank === 1 ? " lead" : "") + (hot ? " hit" : "") + (onPick ? " pick" : "");
  const inner = (
    <>
      <i className="jb-glow" />
      <span className="jb-bar"><i className="jb-ptsbg" /></span>
      <span className="jb-flag">{c && <FlagCanvas cc={c} />}</span>
      <span className="jb-name"><span>{SHORT[r.cc] || r.name}</span></span>
      {q && <span className="jb-q">Q</span>}
      <span className="jb-pts"><span className="jb-num" key={hit}><span ref={ticker}>{r.points}</span></span></span>
      <span className="jb-sweep" key={hit}>{hit > 0 && <i />}</span>
    </>
  );
  return onPick
    ? <button type="button" className={cls} style={style} data-id={r.id} aria-label={`${r.name}, ${r.points} points`} onClick={e => { e.stopPropagation(); onPick(r.id); }}>{inner}</button>
    : <div className={cls} style={style} data-id={r.id}>{inner}</div>;
});

/** Name width fit using canvas metrics (exact for the bundled font, no layout reads). */
function useFits(rows: EvRow[], h: number, qOn: boolean, fontsOk: boolean) {
  return useMemo(() => {
    const out: Record<string, number> = {};
    if (typeof document === "undefined") return out;
    const ctx = document.createElement("canvas").getContext("2d"); if (!ctx) return out;
    const fs = h * 0.37;
    ctx.font = `800 ${fs}px ${NAME_FONT}`;
    const w = h * 6.5;
    const avail = w - (h * 0.16 + h * 0.66 * 1.45 + h * 0.26) - w * 0.165 - h * 0.22 - (qOn ? h * 0.5 : 0);
    for (const r of rows) {
      const t = (SHORT[r.cc] || r.name).toUpperCase();
      const m = ctx.measureText(t).width + fs * 0.02 * t.length;
      out[r.id] = Math.min(1, avail / m);
    }
    return out;
  }, [rows.map(r => r.id + r.name).join("|"), h, qOn, fontsOk]);
}

export function JescBoard({ board, full, play = 0, onPick }: { board: EvBoard; full?: boolean; play?: number; onPick?: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [k, setK] = useState({ s: 390 / W, rot: false });
  const [fontsOk, setFontsOk] = useState(typeof document === "undefined");
  const [introNow] = useState(() => !reduced());

  useEffect(() => {
    let dead = false;
    const done = () => { if (!dead) setFontsOk(true); };
    const f = (document as any).fonts;
    const flags = board.rows.map(r => loadFlag(r.cc.toLowerCase()));
    Promise.all([f?.load ? f.load(`800 40px ${NAME_FONT}`) : null, f?.load ? f.load(`700 20px ${NAME_FONT}`) : null, ...flags]).then(done, done);
    const t = setTimeout(done, 2500);
    return () => { dead = true; clearTimeout(t); };
  }, []);

  useIso(() => {
    const el = host.current; if (!el) return;
    const fit = () => {
      const bw = el.clientWidth, bh = el.clientHeight || bw * 9 / 16;
      if (full) {
        const rot = bh > bw * 1.05;
        setK({ s: rot ? Math.min(bh / W, bw / H) : Math.min(bw / W, bh / H), rot });
      } else setK({ s: bw / W, rot: false });
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el); addEventListener("resize", fit);
    return () => { ro?.disconnect(); removeEventListener("resize", fit); };
  }, [full]);

  // Displayed order lags the data so a reveal reads as: number ticks + flash, then the board re-sorts.
  const sorted = useMemo(() => sortRows(board.rows).map(r => r.id), [board.rows]);
  const [order, setOrder] = useState(sorted);
  const byId = useMemo(() => new Map(board.rows.map(r => [r.id, r])), [board.rows]);
  useIso(() => {
    const same = order.length === sorted.length && order.every(id => byId.has(id));
    if (!same) { setOrder(sorted); return; }
    if (order.join() === sorted.join()) return;
    const t = setTimeout(() => setOrder(sorted), reduced() ? 0 : 560);
    return () => clearTimeout(t);
  }, [sorted.join(), byId]);
  const live = order.filter(id => byId.has(id));

  const L = jescLayout(live.length);
  const anyQ = live.some((_, i) => qualifies(board.round, i + 1));
  const fits = useFits(board.rows, L.h, anyQ, fontsOk);

  const tv = { transform: `translate(-50%,-50%)${k.rot ? " rotate(90deg)" : ""} scale(${k.s})` } as CSSProperties;
  return (
    <div ref={host} className={"jb-host" + (full ? " full" : "")}>
      <div className={"jb-tv" + (fontsOk ? " ready" : "") + (introNow ? " intro" : "")} style={tv} key={play}>
        <Background />
        <div className="jb-round">{EV_ROUND_LABEL[board.round]}</div>
        <div className="jb-rows">
          {/* DOM order stays stable (data order) so moving a row never re-inserts it and restarts its animations. */}
          {board.rows.map(r => {
            const i = live.indexOf(r.id); if (i < 0) return null; const id = r.id; const p = L.pos(i);
            return <JRow key={id} r={r} rank={i + 1} x={p.x} y={p.y} w={L.w} h={L.h} q={qualifies(board.round, i + 1)} fit={fits[id] ?? 1} intro={introNow} onPick={onPick} />;
          })}
        </div>
        <span className="jb-fan">Fan-made recreation</span>
      </div>
    </div>
  );
}
