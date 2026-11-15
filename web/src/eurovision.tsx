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
import { StageCardTV } from "./evcards";
import { PostcardTV, SAMPLE_PHOTO, loadPhoto, savePhoto, downscalePhoto, type PcInfo } from "./evpostcard";
import { unlockAudio, playPostcard, playCardSting, stopAll, isMuted, setMuted } from "./evaudio";
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

function FanNote() {
  return <span className="ev-fan">Fan-made recreation</span>;
}

export function StageCard({ card, play, full }: { card: EvCard; play: number; full?: boolean }) {
  return <StageCardTV card={card} play={play} full={full} />;
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
  const [tab, setTab] = useState<"stage" | "board" | "postcard">("stage");
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
  // postcard maker
  const [pcs, setPcs] = useState<Record<EvStyle, PcInfo>>(() => loadPcs());
  const [photoSrc, setPhotoSrc] = useState<"sample" | "mine">("sample");
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [pcStart, setPcStart] = useState<number | null>(null);
  const [muted, setMute] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setMute(isMuted()); setPcs(loadPcs()); loadPhoto().then(u => { if (u) { setMyPhoto(u); setPhotoSrc("mine"); } }); }, []);
  useEffect(() => { if (ready.current) savePcs(pcs); }, [pcs]);
  useEffect(() => { setPcStart(null); stopAll(); }, [tab, style]);
  useEffect(() => () => stopAll(), []);

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

  const pc = pcs[style];
  const patchPc = (p: Partial<PcInfo>) => setPcs(x => ({ ...x, [style]: { ...x[style], ...p } }));
  // Sound must start inside the tap itself (iPhone): unlock synchronously, then schedule.
  const replayCard = () => { if (!isMuted()) { unlockAudio(); playCardSting(style); } setPlay(n => n + 1); };
  const playPc = () => { unlockAudio(); const a = playPostcard(style); setPcStart(performance.now() + (a ? Math.max(0, (a.at - a.ctx.currentTime) * 1000) : 0)); };
  const toggleMute = () => { const m = !muted; setMute(m); if (!m) unlockAudio(); setMuted(m); };
  const pickPhoto = async (f: File | undefined) => {
    if (!f) return; setPhotoErr("");
    try { const u = await downscalePhoto(f); setMyPhoto(u); setPhotoSrc("mine"); setPcStart(null); await savePhoto(u); }
    catch { setPhotoErr("Couldn't open that photo — try another one."); }
  };
  const photo = photoSrc === "mine" && myPhoto ? myPhoto : SAMPLE_PHOTO;
  const soundBtn = <button type="button" className="ev-replay ev-mute" aria-label={muted ? "Turn sound on" : "Mute sound"} aria-pressed={muted} onClick={e => { e.stopPropagation(); toggleMute(); }}>{muted ? "🔇" : "🔊"}</button>;

  const preview = (isFull: boolean) => tab === "postcard"
    ? <div className="ev-stage tv ev-pc"><PostcardTV style={style} info={pc} photo={photo} start={pcStart} full={isFull} onPlay={playPc} />
        {pcStart != null && <button className="ev-replay" type="button" aria-label="Play postcard again" onClick={e => { e.stopPropagation(); playPc(); }}>↻</button>}{soundBtn}</div>
    : tab === "stage"
    ? <div className="ev-stage tv"><StageCard card={card} play={play} full={isFull} /><button className="ev-replay" type="button" aria-label="Replay animation" onClick={e => { e.stopPropagation(); replayCard(); }}>↻</button>{soundBtn}</div>
    : <div className={"ev-board-wrap" + (style === "jesc" ? " jb" : "")}><ScoreBoard board={board} wide={isFull || wide} full={isFull} play={play} highlight={flash} onPick={reveal ? id => { if (pick != null) award(id, pick); } : undefined} /></div>;

  return (
    <div className="ev">
      <div className="ev-tabs" role="tablist">
        <button type="button" role="tab" className={tab === "stage" ? "on" : ""} aria-selected={tab === "stage"} onClick={() => setTab("stage")}>Stage</button>
        <button type="button" role="tab" className={tab === "board" ? "on" : ""} aria-selected={tab === "board"} onClick={() => setTab("board")}>Scoreboard</button>
        <button type="button" role="tab" className={tab === "postcard" ? "on" : ""} aria-selected={tab === "postcard"} onClick={() => setTab("postcard")}>Postcard</button>
      </div>
      <Seg value={style} opts={EV_STYLES.map(s => ({ id: s, label: EV_STYLE_LABEL[s] }))} onChange={id => setStyle(id as EvStyle)} />
      {preview(false)}
      <div className="ev-actions">
        {tab === "postcard" && <button type="button" className="ev-btn pri" onClick={playPc}>▶ Play</button>}
        {tab === "stage" && <button type="button" className="ev-btn" onClick={replayCard}>Replay</button>}
        {tab === "board" && style === "jesc" && <button type="button" className="ev-btn" onClick={() => setPlay(n => n + 1)}>Replay</button>}
        <button type="button" className={"ev-btn" + (tab === "postcard" ? "" : " pri")} onClick={() => { if (tab === "postcard") playPc(); setFull(true); }}>⛶ Fullscreen</button>
        {tab !== "board" && <button type="button" className="ev-btn" aria-pressed={muted} onClick={toggleMute}>{muted ? "🔇 Sound off" : "🔊 Sound on"}</button>}
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

      {tab === "postcard" && (
        <div className="ev-form">
          <div className="ev-photo">
            <span className="ev-photo-t" style={{ backgroundImage: `url("${photo}")` }} aria-hidden="true" />
            <div className="ev-photo-b">
              <button type="button" className="ev-btn pri" onClick={() => fileRef.current?.click()}>📷 {myPhoto ? "Change photo" : "Choose a photo"}</button>
              <div className="ev-styles" role="tablist" aria-label="Photo">
                <button type="button" role="tab" className={photoSrc === "sample" || !myPhoto ? "on" : ""} aria-selected={photoSrc === "sample" || !myPhoto} onClick={() => { setPhotoSrc("sample"); setPcStart(null); }}>✨ Sample photo</button>
                {myPhoto && <button type="button" role="tab" className={photoSrc === "mine" ? "on" : ""} aria-selected={photoSrc === "mine"} onClick={() => { setPhotoSrc("mine"); setPcStart(null); }}>My photo</button>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {photoErr && <p className="ev-note">{photoErr}</p>}
          <label>Country
            <input list="ev-countries" value={pc.country} onChange={e => { const v = e.target.value; const hit = countryFromName(v); patchPc({ country: v, cc: hit.cc || pc.cc }); }} autoComplete="off" />
          </label>
          <label>Artist
            <input value={pc.artist} onChange={e => patchPc({ artist: e.target.value })} />
          </label>
          <label>Song
            <input value={pc.song} onChange={e => patchPc({ song: e.target.value })} />
          </label>
          <label>Music &amp; Lyrics <small>(shown on the stage card)</small>
            <textarea value={pc.lyrics} onChange={e => patchPc({ lyrics: e.target.value })} rows={2} />
          </label>
          <p className="ev-note">Your photo stays on this phone — it's never uploaded. The music is original and made live by the app.</p>
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
      <p className="ev-note">A fan-made recreation of the look of Eurovision Asia, Eurovision 2026 and Junior Eurovision 2026. Not affiliated with the EBU or any broadcaster. Boards, postcards and photos you make stay on this device.</p>
      {isSemi(board.round) && tab === "board" && <p className="ev-note">Top 10 in a semi-final are marked Q.</p>}
      {full && <FullScreen onClose={() => setFull(false)} bg="#05060a">{preview(true)}</FullScreen>}
    </div>
  );
}

function defaultSafe(): EvStore { return loadStore(); }

const PC_KEY = "sk.games.euro.pc.v1";
function loadPcs(): Record<EvStyle, PcInfo> {
  const base = loadStore().cards;
  const def = Object.fromEntries(EV_STYLES.map(s => [s, { country: base[s].country, cc: base[s].cc, artist: base[s].artist, song: base[s].song, lyrics: base[s].lyrics }])) as Record<EvStyle, PcInfo>;
  try { const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PC_KEY) : null; if (!raw) return def; const j = JSON.parse(raw); for (const s of EV_STYLES) if (j?.[s]) def[s] = { ...def[s], ...j[s] }; } catch { /* corrupt */ }
  return def;
}
function savePcs(p: Record<EvStyle, PcInfo>) { try { localStorage.setItem(PC_KEY, JSON.stringify(p)); } catch { /* full */ } }

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

