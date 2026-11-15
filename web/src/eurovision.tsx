import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource-variable/fredoka";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/outfit/700.css";
import "@fontsource/outfit/800.css";
import "@fontsource/outfit/900.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FullScreen } from "./gate";
import {
  EV_STYLES, EV_STYLE_LABEL, EV_ROUNDS, EV_ROUND_LABEL, EV_REVEAL_VALUES,
  ISO_COUNTRIES, COUNTRY_BY_CC, type EvStyle, type EvCard, type EvBoard, type EvStore,
  evFlag, countryFromName, sortRows, qualifies, boardColumns, setPoints, addPoints,
  addCountry, removeCountry, loadStore, saveStore, padRank, isSemi,
} from "./eurovision-data";
import "./eurovision.css";
import { JescBoard } from "./evjesc";
export { jescLayout } from "./evjesc";

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function useCount(n: number) {
  const [v, setV] = useState(n);
  const from = useRef(n);
  useEffect(() => {
    if (reduced() || n === from.current) { setV(n); from.current = n; return; }
    const a = from.current, b = n, t0 = performance.now(), dur = Math.min(700, 240 + Math.abs(b - a) * 6);
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - (1 - p) ** 3;
      setV(Math.round(a + (b - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return v;
}

function useFlip(dep: string) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced()) return;
    const next = new Map<string, DOMRect>();
    root.querySelectorAll<HTMLElement>("[data-id]").forEach(el => {
      const id = el.dataset.id!;
      const now = el.getBoundingClientRect();
      next.set(id, now);
      const was = prev.current.get(id);
      if (!was) return;
      const dx = was.left - now.left, dy = was.top - now.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform .55s cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "";
        const done = () => { el.style.transition = ""; el.removeEventListener("transitionend", done); };
        el.addEventListener("transitionend", done);
      });
    });
    prev.current = next;
  }, [dep]);
  return ref;
}


export function EvFlag({ cc, variant = "rect" }: { cc: string; variant?: "rect" | "framed" | "round" }) {
  const c = (cc || "").toLowerCase();
  const [img, setImg] = useState(!!c);
  return (
    <span className={"ev-flag ev-flag-" + variant} title={COUNTRY_BY_CC[cc.toUpperCase()] || cc}>
      {img && <img src={`/flags/4x3/${c}.svg`} alt="" aria-hidden="true" onError={() => setImg(false)} />}
      <span className="ev-flag-e" aria-hidden="true">{evFlag(cc)}</span>
    </span>
  );
}

const lyricLines = (s: string) => (s || "").split(/\s*(?:\n|&|\/)\s*/).map(x => x.trim()).filter(Boolean);

/* Large thermal hearts packed into the left and right thirds, plus top/bottom corners. Size is % of card width. */
const HEARTS: { x: number; y: number; s: number; r: number; d: string; spin: number; g: number }[] = [
  { x: 1, y: 10, s: 36, r: -22, d: "0s", spin: 6, g: 0 },
  { x: 18, y: 2, s: 30, r: 14, d: ".18s", spin: -5, g: 1 },
  { x: -4, y: 30, s: 40, r: -30, d: ".36s", spin: 7, g: 2 },
  { x: 16, y: 26, s: 28, r: 18, d: ".08s", spin: -6, g: 0 },
  { x: 6, y: 48, s: 34, r: -8, d: ".28s", spin: 5, g: 1 },
  { x: 22, y: 50, s: 24, r: 24, d: ".48s", spin: -4, g: 2 },
  { x: -2, y: 68, s: 38, r: 16, d: ".12s", spin: 6, g: 0 },
  { x: 18, y: 72, s: 30, r: -16, d: ".32s", spin: -5, g: 1 },
  { x: 4, y: 90, s: 34, r: 10, d: ".22s", spin: 4, g: 2 },
  { x: 22, y: 92, s: 26, r: -24, d: ".42s", spin: -7, g: 0 },
  { x: 28, y: 14, s: 22, r: 28, d: ".16s", spin: 5, g: 1 },
  { x: 27, y: 36, s: 20, r: -12, d: ".4s", spin: -4, g: 2 },
  { x: 26, y: 66, s: 22, r: 8, d: ".06s", spin: 6, g: 0 },
  { x: 99, y: 8, s: 36, r: 20, d: ".1s", spin: -6, g: 1 },
  { x: 82, y: 0, s: 30, r: -14, d: ".3s", spin: 5, g: 2 },
  { x: 104, y: 28, s: 40, r: 26, d: ".05s", spin: -7, g: 0 },
  { x: 84, y: 24, s: 28, r: -20, d: ".25s", spin: 4, g: 1 },
  { x: 96, y: 48, s: 34, r: 10, d: ".45s", spin: -5, g: 2 },
  { x: 78, y: 48, s: 24, r: -26, d: ".15s", spin: 6, g: 0 },
  { x: 103, y: 70, s: 38, r: -18, d: ".35s", spin: -4, g: 1 },
  { x: 82, y: 70, s: 30, r: 16, d: ".02s", spin: 7, g: 2 },
  { x: 96, y: 90, s: 34, r: -10, d: ".22s", spin: -6, g: 0 },
  { x: 78, y: 92, s: 26, r: 22, d: ".38s", spin: 5, g: 1 },
  { x: 72, y: 12, s: 22, r: -28, d: ".28s", spin: -5, g: 2 },
  { x: 73, y: 36, s: 20, r: 12, d: ".18s", spin: 4, g: 0 },
  { x: 74, y: 64, s: 22, r: -8, d: ".48s", spin: -6, g: 1 },
];

function ThermalHeart({ g, id }: { g: number; id: string }) {
  const gid = id;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="36%" cy="30%" r="72%">
          <stop offset="0" stopColor={g === 1 ? "#f07aff" : g === 2 ? "#d44cff" : "#e04cff"} />
          <stop offset=".16" stopColor="#c026d3" />
          <stop offset=".32" stopColor="#ffe14a" />
          <stop offset=".5" stopColor="#ff8c1a" />
          <stop offset=".72" stopColor="#e0222a" />
          <stop offset=".9" stopColor="#1a3ad8" />
          <stop offset="1" stopColor="#1528a0" />
        </radialGradient>
      </defs>
      <path fill={`url(#${gid})`} d="M32 58C10 42 1 30 6 16 10 5 23 4 32 16 41 4 54 5 58 16 63 30 54 42 32 58z" />
      <path fill="#fff" opacity=".38" d="M20 16c6-8 14-6 13 6 2-10 14-10 10 2C38 14 26 10 20 16z" />
    </svg>
  );
}

function ThinBeams({ n = 15 }: { n?: number }) {
  const start = -58, span = 116;
  return (
    <div className="ev-thin" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ "--r": `${start + (i * span) / (n - 1)}deg`, "--d": `${(i % 6) * -0.4}s` } as CSSProperties} />
      ))}
    </div>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M8 0l1.15 6.35L16 8l-6.85 1.15L8 16l-1.15-6.85L0 8l6.85-1.15z" />
    </svg>
  );
}

function Stars({ n = 28 }: { n?: number }) {
  const pts = useMemo(() => Array.from({ length: n }, (_, i) => ({
    x: `${(i * 37 + 8) % 100}%`, y: `${(i * 53 + 5) % 100}%`, z: `${5 + (i % 5) * 2.4}px`, d: `${(i * 0.13) % 2}s`,
  })), [n]);
  return (
    <div className="ev-stars" aria-hidden="true">
      {pts.map((p, i) => <span key={i} className="ev-star" style={{ "--x": p.x, "--y": p.y, "--z": p.z, "--d": p.d } as CSSProperties}><Star /></span>)}
    </div>
  );
}

function Rays() {
  const items = [
    { r: -48, c: "red", d: "0s", s: 18 },
    { r: -32, c: "mag", d: "-.8s", s: 14 },
    { r: -16, c: "blue", d: "-.3s", s: 20 },
    { r: 2, c: "red", d: "-1.1s", s: 16 },
    { r: 18, c: "blue", d: "-.5s", s: 18 },
    { r: 34, c: "mag", d: "-1.4s", s: 14 },
    { r: 50, c: "red", d: "-.2s", s: 20 },
    { r: -60, c: "blue", d: "-.9s", s: 12 },
  ];
  return (
    <div className="ev-rays" aria-hidden="true">
      {items.map((x, i) => <i key={i} className={"ev-ray " + x.c} style={{ "--r": `${x.r}deg`, "--d": x.d, "--swing": `${x.s}deg` } as CSSProperties} />)}
    </div>
  );
}

function Lasers() {
  const lines = [
    { x: "-20%", y: "28%", r: 18, d: "0s" },
    { x: "-10%", y: "58%", r: -22, d: "-.7s" },
    { x: "-30%", y: "42%", r: 8, d: "-1.2s" },
    { x: "-5%", y: "72%", r: -12, d: "-.4s" },
    { x: "-25%", y: "18%", r: 32, d: "-1.6s" },
  ];
  return (
    <div className="ev-lasers" aria-hidden="true">
      {lines.map((l, i) => <i key={i} style={{ "--x": l.x, "--y": l.y, "--r": `${l.r}deg`, "--d": l.d } as CSSProperties} />)}
    </div>
  );
}

/** Original line-art tiara — not the official JESC mark. */
function Crown() {
  return (
    <div className="ev-crown-wrap">
      <svg className="ev-crown" viewBox="0 0 200 120" fill="none" aria-hidden="true">
        <polygon pathLength="1" points="100,4 110,22 90,22" stroke="#ff7ad9" strokeWidth="2.1" style={{ "--d": "0s" } as CSSProperties} />
        <circle pathLength="1" cx="100" cy="40" r="15.5" stroke="#ff7ad9" strokeWidth="2.1" style={{ "--d": ".08s" } as CSSProperties} />
        <path pathLength="1" d="M100 50c-7-6-10-12-6-16 3-3 6 0 6 0s3-3 6 0c4 4 1 10-6 16z" stroke="#ff7ad9" strokeWidth="2" style={{ "--d": ".16s" } as CSSProperties} />
        <path pathLength="1" d="M88 50c-16 0-26-18-12-26 8-5 14 4 8 10-5 5 0 12 14 12" stroke="#ffe566" strokeWidth="2" style={{ "--d": ".2s" } as CSSProperties} />
        <path pathLength="1" d="M112 50c16 0 26-18 12-26-8-5-14 4-8 10 5 5 0 12-14 12" stroke="#ffe566" strokeWidth="2" style={{ "--d": ".2s" } as CSSProperties} />
        <path pathLength="1" d="M82 54c-28 4-42-18-24-32 10-8 20 4 10 12-8 6-4 20 22 20" stroke="#ff7ad9" strokeWidth="2.15" style={{ "--d": ".12s" } as CSSProperties} />
        <path pathLength="1" d="M118 54c28 4 42-18 24-32-10-8-20 4-10 12 8 6 4 20-22 20" stroke="#ff7ad9" strokeWidth="2.15" style={{ "--d": ".12s" } as CSSProperties} />
        <path pathLength="1" d="M70 40c-12-16-6-26 8-18 4-10 14-6 10 6" stroke="#ffe566" strokeWidth="1.8" style={{ "--d": ".28s" } as CSSProperties} />
        <path pathLength="1" d="M130 40c12-16 6-26-8-18-4-10-14-6-10 6" stroke="#ffe566" strokeWidth="1.8" style={{ "--d": ".28s" } as CSSProperties} />
        <path pathLength="1" d="M48 68c-10-8-16-2-8 8" stroke="#ff7ad9" strokeWidth="1.8" style={{ "--d": ".34s" } as CSSProperties} />
        <path pathLength="1" d="M152 68c10-8 16-2 8 8" stroke="#ff7ad9" strokeWidth="1.8" style={{ "--d": ".34s" } as CSSProperties} />
        <path pathLength="1" d="M36 78c26-14 102-14 128 0" stroke="#7ecbff" strokeWidth="2" style={{ "--d": ".22s" } as CSSProperties} />
        <path pathLength="1" d="M40 78c8 12 112 12 120 0" stroke="#7ecbff" strokeWidth="1.9" style={{ "--d": ".3s" } as CSSProperties} />
        <path pathLength="1" d="M48 78c8 6 96 6 104 0" stroke="#ff7ad9" strokeWidth="1.5" style={{ "--d": ".38s" } as CSSProperties} />
        <circle pathLength="1" cx="36" cy="78" r="2.6" stroke="#7ecbff" strokeWidth="1.6" style={{ "--d": ".44s" } as CSSProperties} />
        <circle pathLength="1" cx="164" cy="78" r="2.6" stroke="#7ecbff" strokeWidth="1.6" style={{ "--d": ".44s" } as CSSProperties} />
        <circle pathLength="1" cx="58" cy="46" r="2.4" stroke="#ffe566" strokeWidth="1.5" style={{ "--d": ".4s" } as CSSProperties} />
        <circle pathLength="1" cx="142" cy="46" r="2.4" stroke="#ffe566" strokeWidth="1.5" style={{ "--d": ".4s" } as CSSProperties} />
        <circle pathLength="1" cx="100" cy="40" r="2.2" stroke="#7ecbff" strokeWidth="1.4" style={{ "--d": ".48s" } as CSSProperties} />
      </svg>
      <i className="ev-crown-shimmer" aria-hidden="true" />
    </div>
  );
}

function FanNote() {
  return <span className="ev-fan">Fan-made recreation</span>;
}

export function StageCard({ card, play }: { card: EvCard; play: number }) {
  const { style, country, song, artist, lyrics } = card;
  const key = `${style}-${play}`;
  const ly = lyricLines(lyrics);
  if (style === "asia") {
    return (
      <div className="ev-card asia" key={key}>
        <div className="ev-asia-bg" />
        <div className="ev-asia-arena" />
        <ThinBeams />
        <div className="ev-asia-spot" />
        <div className="ev-hearts" aria-hidden="true">
          {HEARTS.map((h, i) => (
            <span key={i} className="ev-theart" style={{ "--x": h.x + "%", "--y": h.y + "%", "--s": h.s + "cqw", "--r": h.r + "deg", "--d": h.d, "--spin": h.spin + "deg" } as CSSProperties}>
              <ThermalHeart g={h.g} id={'th'+i} />
            </span>
          ))}
        </div>
        <div className="ev-asia-copy">
          <div className="ev-asia-song ev-in" style={{ "--d": ".15s" } as CSSProperties}>{song || "Song"}</div>
          <div className="ev-asia-by ev-in" style={{ "--d": ".28s" } as CSSProperties}>{artist ? `By ${artist}` : "By artist"}</div>
          <div className="ev-asia-country ev-in" style={{ "--d": ".42s" } as CSSProperties}>{country || "Country"}</div>
          <div className="ev-asia-ml ev-in" style={{ "--d": ".58s" } as CSSProperties}>Music &amp; Lyrics</div>
          {lyrics ? <div className="ev-asia-ly ev-in" style={{ "--d": ".68s" } as CSSProperties}>{lyrics}</div> : null}
        </div>
        <FanNote />
      </div>
    );
  }
  if (style === "esc") {
    return (
      <div className="ev-card esc" key={key}>
        <div className="ev-esc-bg" />
        <div className="ev-esc-floor" />
        <Rays />
        <Lasers />
        <Stars />
        <div className="ev-esc-copy">
          <div className="ev-neon ev-in" data-text={(country || "Country").toUpperCase()} style={{ "--d": ".15s" } as CSSProperties}>{(country || "Country").toUpperCase()}</div>
          <div className="ev-esc-cols">
            <div className="ev-in" style={{ "--d": ".4s" } as CSSProperties}>
              <div className="ev-esc-song">{(song || "Song").toUpperCase()}</div>
              <div className="ev-esc-art">{artist ? `BY ${artist.toUpperCase()}` : ""}</div>
            </div>
            <div className="r ev-in" style={{ "--d": ".55s" } as CSSProperties}>
              <div className="ev-esc-k">Music &amp; Lyrics</div>
              {ly.map((line, i) => <div key={i} className="ev-esc-ly">{line.toUpperCase()}</div>)}
            </div>
          </div>
        </div>
        <FanNote />
      </div>
    );
  }
  return (
    <div className="ev-card jesc" key={key}>
      <div className="ev-jesc-bg" />
      <div className="ev-jesc-rig" />
      <div className="ev-jesc-copy">
        <div className="ev-in" style={{ "--d": "0s" } as CSSProperties}><Crown /></div>
        <div className="ev-jesc-country ev-in" style={{ "--d": ".55s" } as CSSProperties}>{(country || "Country").toUpperCase()}</div>
        <div className="ev-jesc-song ev-in" style={{ "--d": ".7s" } as CSSProperties}>{(song || "Song").toUpperCase()}{artist ? ` - ${artist.toUpperCase()}` : ""}</div>
        {lyrics ? <div className="ev-jesc-ly ev-in" style={{ "--d": ".85s" } as CSSProperties}>MUSIC &amp; LYRICS: {lyrics.toUpperCase()}</div> : null}
      </div>
      <FanNote />
    </div>
  );
}

function Dots({ kind }: { kind: "asia" | "jesc" }) {
  const palette = kind === "asia"
    ? ["#7ea2ff", "#ffd56a", "#ff8ad4", "#9be7ff", "#ffffff"]
    : ["#ff4fa0", "#ffe14a", "#5ad0ff", "#7d6bff", "#50e3a2", "#ff8a2a"];
  const dots = useMemo(() => Array.from({ length: kind === "asia" ? 14 : 22 }, (_, i) => ({
    x: `${(i * 29 + 7) % 96}%`, y: `${(i * 47 + 5) % 94}%`, z: `${10 + (i * 13) % 22}px`,
    c: palette[i % palette.length], d: `${(i * 0.4) % 5}s`,
    dx: `${(i % 2 ? 14 : -16)}px`, dy: `${(i % 3 ? -18 : 12)}px`,
  })), [kind]);
  return (
    <div className={kind === "asia" ? "ev-asia-bokeh" : "ev-jesc-bokeh"} aria-hidden="true">
      {dots.map((p, i) => <i key={i} className={kind === "asia" ? "ev-asia-dot" : "ev-jesc-dot"} style={{ "--x": p.x, "--y": p.y, "--z": p.z, "--c": p.c, "--d": p.d, "--dx": p.dx, "--dy": p.dy } as CSSProperties} />)}
    </div>
  );
}

function GoldStreaks() {
  return (
    <div className="ev-esc-streaks" aria-hidden="true">
      {[16, 38, 62, 86].map((y, i) => (
        <i key={i} className="ev-gold" style={{ "--y": `${y}%`, "--r": `${-24 + i * 5}deg`, "--d": `${-i}s` } as CSSProperties} />
      ))}
    </div>
  );
}

function Pts({ n }: { n: number }) {
  const v = useCount(n);
  return <span className="ev-pts">{v}</span>;
}

export function ScoreBoard({ board, wide, highlight, onPick, full, play }: { board: EvBoard; wide: boolean; highlight?: string; onPick?: (id: string) => void; full?: boolean; play?: number }) {
  if (board.style === "jesc") return <JescBoard board={board} full={full} play={play} onPick={onPick} />;
  return <ClassicBoard board={board} wide={wide} highlight={highlight} onPick={onPick} />;
}

function ClassicBoard({ board, wide, highlight, onPick }: { board: EvBoard; wide: boolean; highlight?: string; onPick?: (id: string) => void }) {
  const ranked = useMemo(() => sortRows(board.rows).map((r, i) => ({ ...r, rank: i + 1 })), [board.rows]);
  const cols = boardColumns(board.style, ranked.length, wide);
  const rows = Math.ceil(ranked.length / cols);
  const flip = useFlip(ranked.map(r => r.id + ":" + r.points).join("|"));
  const flagVar = board.style === "esc" ? "round" : board.style === "jesc" ? "framed" : "rect";
  return (
    <div className={"ev-board " + board.style}>
      {board.style === "asia" && <Dots kind="asia" />}
      {board.style === "jesc" && <Dots kind="jesc" />}
      {board.style === "esc" && <GoldStreaks />}
      <div className="ev-board-hd">
        <h3 className="ev-board-title">{EV_ROUND_LABEL[board.round]}</h3>
        <span className="ev-board-style">{EV_STYLE_LABEL[board.style]}</span>
      </div>
      <div ref={flip} className={"ev-rows cols-" + cols} style={{ "--rows": rows } as CSSProperties}>
        {ranked.map((r, i) => {
          const q = qualifies(board.round, r.rank);
          const rowCls = "ev-row" + (r.rank === 1 ? " lead" : "") + (highlight === r.id ? " on flash" : "");
          const label = cols > 1 && (r.name === "North Macedonia" || r.cc === "MK") ? "N. Macedonia" : r.name;
          const inner = board.style === "esc" ? (
            <>
              <span className="ev-rank">{r.rank}{q && <span className="ev-q">Q</span>}</span>
              <EvFlag cc={r.cc} variant={flagVar} />
              <span className="ev-pill">
                <span className="ev-name">{label}</span>
                <Pts n={r.points} />
              </span>
            </>
          ) : (
            <>
              {board.style === "asia" && <span className="ev-rank">{padRank(r.rank)}</span>}
              <EvFlag cc={r.cc} variant={flagVar} />
              <span className="ev-name">{label}</span>
              {q && <span className="ev-q">Q</span>}
              <Pts n={r.points} />
            </>
          );
          return onPick ? (
            <button type="button" key={r.id} data-id={r.id} className={rowCls} style={{ "--i": i } as CSSProperties} onClick={() => onPick(r.id)}>{inner}</button>
          ) : (
            <div key={r.id} data-id={r.id} className={rowCls} style={{ "--i": i } as CSSProperties}>{inner}</div>
          );
        })}
      </div>
      <FanNote />
    </div>
  );
}

function Seg({ value, opts, onChange }: { value: string; opts: { id: string; label: string }[]; onChange: (id: string) => void }) {
  return (
    <div className="ev-styles" role="tablist">
      {opts.map(o => <button key={o.id} type="button" role="tab" className={value === o.id ? "on" : ""} aria-selected={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

export function EuroStudio() {
  const [store, setStore] = useState<EvStore>(() => defaultSafe());
  const [tab, setTab] = useState<"stage" | "board">("stage");
  const [style, setStyle] = useState<EvStyle>("asia");
  const [play, setPlay] = useState(0);
  const [full, setFull] = useState(false);
  const [wide, setWide] = useState(typeof window !== "undefined" ? window.innerWidth >= 560 : false);
  const [reveal, setReveal] = useState(false);
  const [left, setLeft] = useState<number[]>([...EV_REVEAL_VALUES]);
  const [pick, setPick] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | undefined>();
  const [addCc, setAddCc] = useState("");
  const ready = useRef(false);

  useEffect(() => { setStore(loadStore()); ready.current = true; }, []);
  useEffect(() => { if (ready.current) saveStore(store); }, [store]);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 560);
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);

  const card = store.cards[style];
  const board = store.boards[style];
  const used = new Set(board.rows.map(r => r.cc));
  const leftover = ISO_COUNTRIES.filter(c => !used.has(c.cc));

  const patchCard = (p: Partial<EvCard>) => setStore(s => ({ ...s, cards: { ...s.cards, [style]: { ...s.cards[style], ...p } } }));
  const patchBoard = (p: Partial<EvBoard> | ((b: EvBoard) => EvBoard)) => setStore(s => ({ ...s, boards: { ...s.boards, [style]: typeof p === "function" ? p(s.boards[style]) : { ...s.boards[style], ...p } } }));

  const onCountry = (name: string) => {
    const hit = countryFromName(name);
    patchCard({ country: name, cc: hit.cc || card.cc });
  };

  const award = (id: string, pts: number) => {
    patchBoard(b => ({ ...b, rows: addPoints(b.rows, id, pts) }));
    setLeft(xs => xs.filter(x => x !== pts));
    setPick(null);
    setFlash(id);
    setTimeout(() => setFlash(undefined), 700);
  };

  const preview = (isFull: boolean) => tab === "stage"
    ? <div className={"ev-stage" + (isFull ? " fullish" : "")}><StageCard card={card} play={play} /><button className="ev-replay" type="button" aria-label="Replay animation" onClick={e => { e.stopPropagation(); setPlay(n => n + 1); }}>↻</button></div>
    : <div className={"ev-board-wrap" + (style === "jesc" ? " jb" : "")}><ScoreBoard board={board} wide={isFull || wide} full={isFull} play={play} highlight={flash} onPick={reveal ? id => { if (pick != null) award(id, pick); } : undefined} /></div>;

  return (
    <div className="ev">
      <div className="ev-tabs" role="tablist">
        <button type="button" role="tab" className={tab === "stage" ? "on" : ""} aria-selected={tab === "stage"} onClick={() => setTab("stage")}>Stage</button>
        <button type="button" role="tab" className={tab === "board" ? "on" : ""} aria-selected={tab === "board"} onClick={() => setTab("board")}>Scoreboard</button>
      </div>
      <Seg value={style} opts={EV_STYLES.map(s => ({ id: s, label: EV_STYLE_LABEL[s] }))} onChange={id => setStyle(id as EvStyle)} />
      {preview(false)}
      <div className="ev-actions">
        {(tab === "stage" || style === "jesc") && <button type="button" className="ev-btn" onClick={() => setPlay(n => n + 1)}>Replay</button>}
        <button type="button" className="ev-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button>
      </div>

      {tab === "stage" && (
        <div className="ev-form">
          <label>Country
            <input list="ev-countries" value={card.country} onChange={e => onCountry(e.target.value)} autoComplete="off" />
          </label>
          <label>Song
            <input value={card.song} onChange={e => patchCard({ song: e.target.value })} />
          </label>
          <label>Artist
            <input value={card.artist} onChange={e => patchCard({ artist: e.target.value })} />
          </label>
          <label>Music &amp; Lyrics
            <textarea value={card.lyrics} onChange={e => patchCard({ lyrics: e.target.value })} rows={2} />
          </label>
        </div>
      )}

      {tab === "board" && (
        <>
          <div className="ev-rounds" role="tablist">
            {EV_ROUNDS.map(r => <button key={r} type="button" className={board.round === r ? "on" : ""} aria-selected={board.round === r} onClick={() => patchBoard({ round: r })}>{EV_ROUND_LABEL[r]}</button>)}
          </div>
          <div className="ev-mode">
            <button type="button" className={!reveal ? "on" : ""} onClick={() => setReveal(false)}>Edit</button>
            <button type="button" className={reveal ? "on" : ""} onClick={() => { setReveal(true); setLeft([...EV_REVEAL_VALUES]); setPick(null); }}>Reveal</button>
          </div>
          {reveal && (
            <div className="ev-reveal">
              <p>{pick == null ? "Pick 12, 10 or 8 — then tap a country. The board re-ranks itself." : `Tap a country to give ${pick} points.`}</p>
              <div className="ev-styles">
                {EV_REVEAL_VALUES.map(n => (
                  <button key={n} type="button" className={"ev-btn ev-pts-chip" + (pick === n ? " on" : "") + (left.includes(n) ? "" : " used")} onClick={() => setPick(n)}>{n}</button>
                ))}
                <button type="button" className="ev-btn" onClick={() => { setLeft([...EV_REVEAL_VALUES]); setPick(null); }}>Reset votes</button>
              </div>
            </div>
          )}
          {!reveal && (
            <div className="ev-edit">
              {sortRows(board.rows).map(r => (
                <div key={r.id} className="ev-edit-row">
                  <EvFlag cc={r.cc} />
                  <span className="nm">{r.name}</span>
                  <input type="number" min={0} inputMode="numeric" value={r.points} onChange={e => patchBoard(b => ({ ...b, rows: setPoints(b.rows, r.id, Number(e.target.value)) }))} aria-label={r.name + " points"} />
                  <button type="button" className="ev-btn rm" aria-label={"Remove " + r.name} onClick={() => patchBoard(b => ({ ...b, rows: removeCountry(b.rows, r.id) }))}>✕</button>
                </div>
              ))}
              <div className="ev-add">
                <select value={addCc} onChange={e => setAddCc(e.target.value)} aria-label="Add a country">
                  <option value="">Add a country…</option>
                  {leftover.map(c => <option key={c.cc} value={c.cc}>{evFlag(c.cc)} {c.name}</option>)}
                </select>
                <button type="button" className="ev-btn pri" disabled={!addCc} onClick={() => { if (!addCc) return; patchBoard(b => ({ ...b, rows: addCountry(b.rows, addCc) })); setAddCc(""); }}>Add</button>
              </div>
            </div>
          )}
        </>
      )}

      <datalist id="ev-countries">
        {ISO_COUNTRIES.map(c => <option key={c.cc} value={c.name} />)}
      </datalist>
      <p className="ev-note">A fan-made recreation of the look of Eurovision Asia, Eurovision 2026 and Junior Eurovision 2026. Not affiliated with the EBU or any broadcaster. Boards you edit stay on this device.</p>
      {isSemi(board.round) && tab === "board" && <p className="ev-note">Top 10 in a semi-final are marked Q.</p>}
      {full && <FullScreen onClose={() => setFull(false)} bg="#05060a">{preview(true)}</FullScreen>}
    </div>
  );
}

function defaultSafe(): EvStore { return loadStore(); }

/** Mini art for the Games home studio card. */
export function EuroTileArt() {
  return (
    <div className="gm-ev" aria-hidden="true">
      <i style={{ left: "8%", top: "18%", "--c": "#ff3355" } as CSSProperties} />
      <i style={{ right: "12%", top: "22%", "--c": "#3b7bff" } as CSSProperties} />
      <i style={{ left: "18%", bottom: "16%", "--c": "#ffe14a" } as CSSProperties} />
      <i style={{ right: "16%", bottom: "20%", "--c": "#b14bff" } as CSSProperties} />
      Stage
    </div>
  );
}

