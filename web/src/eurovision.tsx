import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FullScreen } from "./gate";
import {
  EV_STYLES, EV_STYLE_LABEL, EV_ROUNDS, EV_ROUND_LABEL, EV_REVEAL_VALUES,
  ISO_COUNTRIES, COUNTRY_BY_CC, type EvStyle, type EvCard, type EvBoard, type EvStore,
  evFlag, countryFromName, sortRows, qualifies, boardColumns, setPoints, addPoints,
  addCountry, removeCountry, loadStore, saveStore, padRank, isSemi,
} from "./eurovision-data";
import "./eurovision.css";

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

export function EvFlag({ cc }: { cc: string }) {
  const c = (cc || "").toLowerCase();
  const [img, setImg] = useState(!!c);
  return (
    <span className="ev-flag" title={COUNTRY_BY_CC[cc.toUpperCase()] || cc}>
      {img && <img src={`/flags/4x3/${c}.svg`} alt="" aria-hidden="true" onError={() => setImg(false)} />}
      <span className="ev-flag-e" aria-hidden="true">{evFlag(cc)}</span>
    </span>
  );
}

const HEARTS = [
  { a: 8, c: "#ff3355", s: 46, rad: "-47%", d: "0s" },
  { a: 32, c: "#3b7bff", s: 40, rad: "-45%", d: ".2s" },
  { a: 55, c: "#ffe14a", s: 48, rad: "-48%", d: ".4s" },
  { a: 78, c: "#ff8a2a", s: 38, rad: "-44%", d: ".1s" },
  { a: 102, c: "#b14bff", s: 50, rad: "-47%", d: ".3s" },
  { a: 125, c: "#ff3355", s: 36, rad: "-45%", d: ".5s" },
  { a: 148, c: "#3b7bff", s: 44, rad: "-48%", d: ".15s" },
  { a: 170, c: "#ffe14a", s: 40, rad: "-44%", d: ".35s" },
  { a: 192, c: "#ff8a2a", s: 48, rad: "-47%", d: ".25s" },
  { a: 215, c: "#b14bff", s: 38, rad: "-45%", d: ".45s" },
  { a: 238, c: "#ff3355", s: 44, rad: "-48%", d: ".05s" },
  { a: 260, c: "#3b7bff", s: 50, rad: "-44%", d: ".3s" },
  { a: 282, c: "#ffe14a", s: 36, rad: "-46%", d: ".2s" },
  { a: 305, c: "#ff8a2a", s: 46, rad: "-47%", d: ".4s" },
  { a: 328, c: "#b14bff", s: 40, rad: "-45%", d: ".1s" },
  { a: 350, c: "#ff3355", s: 42, rad: "-48%", d: ".35s" },
];

function PuffyHeart() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path fill="currentColor" d="M32 56C12 40 2 28 8 16 13 6 24 6 32 16 40 6 51 6 56 16 62 28 52 40 32 56z" />
      <path fill="#fff" opacity=".42" d="M22 18c5-7 14-5 12 5 2-9 13-9 9 2C40 16 28 14 22 18z" />
    </svg>
  );
}

function Beams({ n, swing }: { n: number; swing?: number }) {
  return (
    <div className="ev-beams" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ "--r": `${-40 + (i * 80) / Math.max(1, n - 1)}deg`, "--d": `${(i % 5) * -0.7}s`, "--swing": `${swing ?? 24}deg` } as CSSProperties} />
      ))}
    </div>
  );
}

function Sparks({ n = 22 }: { n?: number }) {
  const pts = useMemo(() => Array.from({ length: n }, (_, i) => ({
    x: `${(i * 37 + 11) % 100}%`, y: `${(i * 53 + 7) % 100}%`, z: `${2 + (i % 4)}px`, d: `${(i * 0.17) % 2.2}s`,
  })), [n]);
  return (
    <div className="ev-sparks" aria-hidden="true">
      {pts.map((p, i) => <i key={i} className="ev-spark" style={{ "--x": p.x, "--y": p.y, "--z": p.z, "--d": p.d } as CSSProperties} />)}
    </div>
  );
}

/** Original line-art tiara — not the official JESC mark. */
function Crown() {
  return (
    <div style={{ position: "relative" }}>
      <svg className="ev-crown" viewBox="0 0 200 118" fill="none" aria-hidden="true">
        <path pathLength="1" d="M100 4c-5-8-18-6-16 6-2-12-18-10-16 6 0 12 24 26 32 34 8-8 32-22 32-34 2-16-14-18-16-6 2-12-11-14-16-6z" stroke="#ff7ad9" strokeWidth="2.4" style={{ "--d": ".05s" } as CSSProperties} />
        <path pathLength="1" d="M18 88c22-12 142-12 164 0" stroke="#ffe566" strokeWidth="2.3" style={{ "--d": ".12s" } as CSSProperties} />
        <path pathLength="1" d="M24 88c10 14 142 14 152 0" stroke="#7ecbff" strokeWidth="2.1" style={{ "--d": ".22s" } as CSSProperties} />
        <path pathLength="1" d="M30 88c8 6 132 6 140 0" stroke="#ff7ad9" strokeWidth="1.5" style={{ "--d": ".3s" } as CSSProperties} />
        <path pathLength="1" d="M70 54c10-32 50-32 60 0" stroke="#ffe566" strokeWidth="2.3" style={{ "--d": ".1s" } as CSSProperties} />
        <path pathLength="1" d="M34 78c8-36 28-42 42-20" stroke="#ff7ad9" strokeWidth="2.1" style={{ "--d": ".18s" } as CSSProperties} />
        <path pathLength="1" d="M166 78c-8-36-28-42-42-20" stroke="#ff7ad9" strokeWidth="2.1" style={{ "--d": ".18s" } as CSSProperties} />
        <path pathLength="1" d="M16 86c8-38 22-48 34-22" stroke="#7ecbff" strokeWidth="2" style={{ "--d": ".26s" } as CSSProperties} />
        <path pathLength="1" d="M184 86c-8-38-22-48-34-22" stroke="#7ecbff" strokeWidth="2" style={{ "--d": ".26s" } as CSSProperties} />
        <path pathLength="1" d="M48 46c-10-16-4-24 8-16 4-10 14-6 10 6" stroke="#ffe566" strokeWidth="1.8" style={{ "--d": ".34s" } as CSSProperties} />
        <path pathLength="1" d="M152 46c10-16 4-24-8-16-4-10-14-6-10 6" stroke="#ffe566" strokeWidth="1.8" style={{ "--d": ".34s" } as CSSProperties} />
        <path pathLength="1" d="M28 62c-8-8-14-4-8 6" stroke="#ff7ad9" strokeWidth="1.7" style={{ "--d": ".4s" } as CSSProperties} />
        <path pathLength="1" d="M172 62c8-8 14-4 8 6" stroke="#ff7ad9" strokeWidth="1.7" style={{ "--d": ".4s" } as CSSProperties} />
        <circle pathLength="1" cx="100" cy="22" r="4.6" stroke="#7ecbff" strokeWidth="2" style={{ "--d": ".42s" } as CSSProperties} />
        <circle pathLength="1" cx="58" cy="42" r="3.4" stroke="#ff7ad9" strokeWidth="1.8" style={{ "--d": ".48s" } as CSSProperties} />
        <circle pathLength="1" cx="142" cy="42" r="3.4" stroke="#ff7ad9" strokeWidth="1.8" style={{ "--d": ".48s" } as CSSProperties} />
        <circle pathLength="1" cx="30" cy="70" r="3.1" stroke="#7ecbff" strokeWidth="1.8" style={{ "--d": ".54s" } as CSSProperties} />
        <circle pathLength="1" cx="170" cy="70" r="3.1" stroke="#7ecbff" strokeWidth="1.8" style={{ "--d": ".54s" } as CSSProperties} />
        <circle pathLength="1" cx="100" cy="54" r="3.2" stroke="#ffe566" strokeWidth="1.8" style={{ "--d": ".5s" } as CSSProperties} />
        <circle className="gem" cx="100" cy="22" r="2.2" color="#7ecbff" />
        <circle className="gem" cx="58" cy="42" r="1.6" color="#ff7ad9" />
        <circle className="gem" cx="142" cy="42" r="1.6" color="#ff7ad9" />
        <circle className="gem" cx="100" cy="54" r="1.5" color="#ffe566" />
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
  if (style === "asia") {
    return (
      <div className="ev-card asia" key={key}>
        <div className="ev-asia-bg" />
        <Beams n={7} swing={22} />
        <div className="ev-hearts" aria-hidden="true">
          {HEARTS.map((h, i) => (
            <span key={i} className="ev-heart" style={{ "--a": `${h.a}deg`, "--c": h.c, "--s": `${h.s}px`, "--rad": h.rad, "--d": h.d } as CSSProperties}>
              <PuffyHeart />
            </span>
          ))}
        </div>
        <div className="ev-asia-copy">
          <div className="ev-asia-song ev-in" style={{ "--d": ".15s" } as CSSProperties}>{song || "Song"}</div>
          <div className="ev-asia-by ev-in" style={{ "--d": ".28s" } as CSSProperties}>{artist ? `By ${artist}` : "By artist"}</div>
          <div className="ev-asia-country ev-in" style={{ "--d": ".42s" } as CSSProperties}>{country || "Country"}</div>
          {lyrics ? <div className="ev-asia-ly ev-in" style={{ "--d": ".6s" } as CSSProperties}><span style={{ opacity: .7 }}>Music &amp; Lyrics </span>{lyrics}</div> : null}
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
        <Beams n={8} swing={32} />
        <Sparks />
        <div className="ev-esc-copy">
          <div className="ev-esc-name ev-in" style={{ "--d": ".2s" } as CSSProperties}>{country || "Country"}</div>
          <div />
          <div className="ev-esc-cols">
            <div className="ev-in" style={{ "--d": ".4s" } as CSSProperties}>
              <div className="ev-esc-k">Song</div>
              <div className="ev-esc-song">{song || "Song"}</div>
              <div className="ev-esc-art">{artist}</div>
            </div>
            <div className="r ev-in" style={{ "--d": ".55s" } as CSSProperties}>
              <div className="ev-esc-k">Music &amp; Lyrics</div>
              <div className="ev-esc-ly">{lyrics}</div>
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
      <Beams n={5} swing={16} />
      <div className="ev-jesc-copy">
        <div className="ev-in" style={{ "--d": "0s", position: "relative" } as CSSProperties}><Crown /></div>
        <div className="ev-jesc-country ev-in" style={{ "--d": ".55s" } as CSSProperties}>{country || "Country"}</div>
        <div className="ev-jesc-song ev-in" style={{ "--d": ".7s" } as CSSProperties}>{(song || "Song").toUpperCase()}{artist ? ` – ${artist.toUpperCase()}` : ""}</div>
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
      {[18, 42, 68, 88].map((y, i) => (
        <i key={i} className="ev-gold" style={{ "--y": `${y}%`, "--r": `${-22 + i * 4}deg`, "--d": `${-i}s` } as CSSProperties} />
      ))}
    </div>
  );
}

function Pts({ n }: { n: number }) {
  const v = useCount(n);
  return <span className="ev-pts">{v}</span>;
}

export function ScoreBoard({ board, wide, highlight, onPick }: { board: EvBoard; wide: boolean; highlight?: string; onPick?: (id: string) => void }) {
  const ranked = useMemo(() => sortRows(board.rows).map((r, i) => ({ ...r, rank: i + 1 })), [board.rows]);
  const cols = boardColumns(board.style, ranked.length, wide);
  const rows = Math.ceil(ranked.length / cols);
  const flip = useFlip(ranked.map(r => r.id + ":" + r.points).join("|"));
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
          const label = cols > 1 && r.name === "North Macedonia" ? "N. Macedonia" : r.name;
          const inner = board.style === "esc" ? (
            <>
              <span className="ev-rank">{r.rank}{q && <span className="ev-q">Q</span>}</span>
              <EvFlag cc={r.cc} />
              <span className="ev-pill">
                <span className="ev-name">{label}</span>
                <Pts n={r.points} />
              </span>
            </>
          ) : (
            <>
              {board.style === "asia" && <span className="ev-rank">{padRank(r.rank)}</span>}
              <EvFlag cc={r.cc} />
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

  const preview = tab === "stage"
    ? <div className={"ev-stage" + (full ? " fullish" : "")}><StageCard card={card} play={play} /><button className="ev-replay" type="button" aria-label="Replay animation" onClick={e => { e.stopPropagation(); setPlay(n => n + 1); }}>↻</button></div>
    : <div className="ev-board-wrap"><ScoreBoard board={board} wide={full || wide} highlight={flash} onPick={reveal ? id => { if (pick != null) award(id, pick); } : undefined} /></div>;

  return (
    <div className="ev">
      <div className="ev-tabs" role="tablist">
        <button type="button" role="tab" className={tab === "stage" ? "on" : ""} aria-selected={tab === "stage"} onClick={() => setTab("stage")}>Stage</button>
        <button type="button" role="tab" className={tab === "board" ? "on" : ""} aria-selected={tab === "board"} onClick={() => setTab("board")}>Scoreboard</button>
      </div>
      <Seg value={style} opts={EV_STYLES.map(s => ({ id: s, label: EV_STYLE_LABEL[s] }))} onChange={id => setStyle(id as EvStyle)} />
      {preview}
      <div className="ev-actions">
        {tab === "stage" && <button type="button" className="ev-btn" onClick={() => setPlay(n => n + 1)}>Replay</button>}
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
      {full && <FullScreen onClose={() => setFull(false)} bg="#05060a">{preview}</FullScreen>}
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

