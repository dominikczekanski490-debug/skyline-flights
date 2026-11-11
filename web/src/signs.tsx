// Sign studio (Games): design hanging airport wayfinding signs in three looks recreated from photos —
// Kraków (charcoal, silver frame, Polish white + English yellow), Manchester (black backlit box, yellow pictogram squares,
// white arrow tiles) and Heathrow (yellow, black circular pictograms, three ruled rows). Recreations only: no airport marks.
import { useMemo, useState } from "react";
import { Picto, PICTOS, PICTO_KEYS, ArrowSvg, ARROWS, type Arrow } from "./pictos";
import { AirlineTile } from "./brand";
import { LOGOS } from "./logoset";
import { AL_NAMES } from "./alnames";
import { enc, dec, FullScreen } from "./gate";
import "./signs.css";

export type SThemeK = "krk" | "man" | "lhr";
export type SLine = { t: string; en?: string; al?: string[]; cross?: boolean };
export type SRow = { arrow: Arrow; ics: string[]; lines: SLine[] };
export type SignSpec = { v: 1; theme: SThemeK; rows: SRow[]; corner?: string[] };
export const STHEMES: [SThemeK, string][] = [["krk", "Kraków"], ["man", "Manchester"], ["lhr", "Heathrow"]];
const ARROW_KEYS = ARROWS.map(a => a[0]);

/** Defaults reproduce the three reference photos. Kraków rule: `t` = Polish (white), `en` = English (yellow) — one language per field. */
export const DEFAULTS: Record<SThemeK, SignSpec> = {
  krk: { v: 1, theme: "krk", corner: ["escalator", "wheelchair", "dog"], rows: [
    { arrow: "up", ics: ["plane"], lines: [{ t: "", en: "Check-in 1-18" }, { t: "", en: "VIP Terminal" }, { t: "Skrytki bagażowe", en: "Luggage lockers" }, { t: "Taras widokowy", en: "Observation deck" }] },
    { arrow: "right", ics: ["plane"], lines: [{ t: "", en: "Check-in 19-45" }, { t: "Kasy biletowe", en: "Ticket offices" }] }] },
  man: { v: 1, theme: "man", rows: [
    { arrow: "upright", ics: ["plane", "escalator"], lines: [{ t: "Departures" }] },
    { arrow: "upright", ics: ["checkin", "escalator"], lines: [{ t: "Check in" }] }] },
  lhr: { v: 1, theme: "lhr", rows: [
    { arrow: "left", ics: ["plane"], lines: [{ t: "Gates A19-A26" }] },
    { arrow: "left", ics: ["lounge", "pharmacy", "prayer"], lines: [{ t: "Lounges A1-A2", al: ["LH", "EI"] }, { t: "Pharmacy", cross: true }, { t: "Multi-faith prayer room" }] },
    { arrow: "left", ics: ["toilets", "wheelchair", "baby", "fountain"], lines: [{ t: "Toilets" }] }] },
};
// Common messages, written once in Polish + English and adapted to each look.
type G = { a: Arrow; i: string[]; l: [string, string][] };
const COMMON: Record<string, { n: string; rows: G[] }> = {
  dep: { n: "Departures", rows: [{ a: "up", i: ["plane"], l: [["Odloty", "Departures"], ["Odprawa", "Check-in"]] }, { a: "right", i: ["security"], l: [["Kontrola bezpieczeństwa", "Security"]] }] },
  arr: { n: "Arrivals", rows: [{ a: "left", i: ["arrivals"], l: [["Przyloty", "Arrivals"], ["Odbiór bagażu", "Baggage reclaim"]] }, { a: "right", i: ["taxi", "train", "bus"], l: [["Transport", "Taxis, trains & buses"]] }] },
  gates: { n: "Gates", rows: [{ a: "left", i: ["gates"], l: [["Wyjścia 1-12", "Gates 1-12"]] }, { a: "right", i: ["gates"], l: [["Wyjścia 14-28", "Gates 14-28"]] }, { a: "up", i: ["food", "shop"], l: [["Restauracje i sklepy", "Food & shops"]] }] },
  checkin: { n: "Check-in", rows: [{ a: "upright", i: ["checkin"], l: [["Odprawa A-D", "Check-in A-D"]] }, { a: "upleft", i: ["luggage"], l: [["Bagaż ponadgabarytowy", "Oversize baggage"]] }] },
  toilets: { n: "Toilets", rows: [{ a: "right", i: ["toilets", "wheelchair", "baby"], l: [["Toalety", "Toilets"]] }, { a: "left", i: ["fountain"], l: [["Woda pitna", "Drinking water"]] }] },
  security: { n: "Security", rows: [{ a: "up", i: ["security"], l: [["Kontrola bezpieczeństwa", "Security"], ["Wszystkie wyjścia", "All gates"]] }, { a: "right", i: ["passport"], l: [["Kontrola paszportowa", "Passport control"]] }] },
  reclaim: { n: "Baggage reclaim", rows: [{ a: "down", i: ["reclaim"], l: [["Odbiór bagażu", "Baggage reclaim"]] }, { a: "right", i: ["info"], l: [["Informacja", "Information"]] }, { a: "left", i: ["money"], l: [["Kantor", "Currency exchange"]] }] },
};
export const PRESET_KEYS = Object.keys(COMMON);
export function presetFor(theme: SThemeK, key: string): SignSpec {
  if (key === "default" || !COMMON[key]) return clone(DEFAULTS[theme]);
  const rows = COMMON[key].rows.map(g => ({ arrow: theme === "man" && g.a === "up" ? "upright" as Arrow : g.a, ics: theme === "man" ? g.i.slice(0, 2) : g.i, lines: g.l.map(([pl, en]) => theme === "krk" ? { t: pl, en } : { t: en }) }));
  return { v: 1, theme, rows, corner: theme === "krk" ? ["wheelchair", "lift"] : undefined };
}
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const isDefault = (s: SignSpec) => JSON.stringify({ r: s.rows, c: s.corner || [] }) === JSON.stringify({ r: DEFAULTS[s.theme].rows, c: DEFAULTS[s.theme].corner || [] });
/** Restyle a sign in another look, keeping the user's rows (Kraków keeps languages in separate fields). */
export function convert(s: SignSpec, theme: SThemeK): SignSpec {
  if (s.theme === theme) return s;
  const rows = s.rows.map(r => ({ ...r, ics: theme === "man" ? r.ics.slice(0, 3) : r.ics, lines: r.lines.map(l => theme === "krk" ? { ...l, t: "", en: l.t } : { ...l, t: s.theme === "krk" ? (l.en || l.t) : l.t, en: undefined }) }));
  return { v: 1, theme, rows, corner: theme === "krk" ? (s.corner || []) : undefined };
}
/** Validate a sign decoded from a share link / storage: unknown pictograms, arrows and logos are dropped, sizes capped. */
export function sanitize(o: any): SignSpec | null {
  if (!o || typeof o !== "object" || !["krk", "man", "lhr"].includes(o.theme) || !Array.isArray(o.rows)) return null;
  const str = (x: any, n = 48) => typeof x === "string" ? x.slice(0, n) : "";
  const rows: SRow[] = o.rows.slice(0, 8).map((r: any) => ({ arrow: ARROW_KEYS.includes(r?.arrow) ? r.arrow : "none", ics: (Array.isArray(r?.ics) ? r.ics : []).filter((k: any) => PICTOS[k]).slice(0, 4),
    lines: (Array.isArray(r?.lines) ? r.lines : []).slice(0, 6).map((l: any) => ({ t: str(l?.t), ...(l?.en ? { en: str(l.en) } : {}), ...(Array.isArray(l?.al) && l.al.length ? { al: l.al.filter((k: any) => LOGOS.has(k)).slice(0, 3) } : {}), ...(l?.cross ? { cross: true } : {}) })) }));
  return { v: 1, theme: o.theme, rows, ...(o.theme === "krk" ? { corner: (Array.isArray(o.corner) ? o.corner : []).filter((k: any) => PICTOS[k]).slice(0, 4) } : {}) };
}
export const signLink = (s: SignSpec, origin = "") => `${origin}/#games=signs&s=${enc(s)}`;
export const signFromHash = (h: string) => sanitize(dec(h.match(/[#&]s=([\w-]+)/)?.[1] || ""));

const Cross = () => <svg className="sg-cross" viewBox="0 0 24 24" aria-label="Pharmacy cross"><path d="M8.5 2h7v6.5H22v7h-6.5V22h-7v-6.5H2v-7h6.5z" fill="#1fa64a" stroke="#fff" strokeWidth="1.2" /></svg>;
const Al = ({ k }: { k: string }) => <AirlineTile a={{ iata: k, name: AL_NAMES[k] || k }} className={"sg-al al-" + k} mode="colour" />;

/** One sign, sized by its container width (CSS container units), so height follows content and never squashes. */
export function SignView({ s }: { s: SignSpec }) {
  const rows = s.rows.length ? s.rows : [{ arrow: "none" as Arrow, ics: [], lines: [{ t: "" }] }];
  if (s.theme === "krk") return <div className="sg-wrap"><div className="sg-hang krk"><i /><i /></div><div className="sg sg-krk" role="img" aria-label={rows.flatMap(r => r.lines.map(l => [l.t, l.en].filter(Boolean).join(" "))).join(", ")}>
    {!!s.corner?.length && <div className="sgk-corner">{s.corner.map(k => <Picto key={k} k={k} />)}</div>}
    {rows.map((r, i) => <div key={i} className={"sgk-row" + (i ? " div" : "")}><span className="sgk-ar"><ArrowSvg a={r.arrow} w={2.6} /></span><span className="sgk-ic">{r.ics.map(k => <Picto key={k} k={k} />)}</span>
      <div className="sgk-lines">{r.lines.map((l, j) => <div key={j} className={j ? "sgk-sub" : "sgk-head"}>{l.t && <span className="pl">{l.t}</span>}{l.en && <span className="en">{l.en}</span>}{l.cross && <Cross />}{l.al?.map(k => <Al key={k} k={k} />)}</div>)}</div></div>)}</div></div>;
  if (s.theme === "man") return <div className="sg-wrap"><div className="sg sg-man" role="img" aria-label={rows.map(r => r.lines.map(l => l.t).join(" ")).join(", ")}><span className="sm-pole" /><span className="sm-brk" /><span className="sm-brk b" />
    {rows.map((r, i) => <div key={i} className="sm-row"><span className="sm-ic">{r.ics.map(k => <span key={k} className="sm-sq"><Picto k={k} /></span>)}</span>
      <div className="sm-lines">{r.lines.map((l, j) => <div key={j} className={j ? "sm-sub" : "sm-t"}>{l.t}{l.cross && <Cross />}{l.al?.map(k => <Al key={k} k={k} />)}</div>)}</div>
      <span className={"sm-tile" + (r.arrow === "none" ? " none" : "")}><ArrowSvg a={r.arrow} w={2.4} /></span></div>)}</div></div>;
  return <div className="sg-wrap"><div className="sg-hang lhr"><i /><i /></div><div className="sg sg-lhr" role="img" aria-label={rows.map(r => r.lines.map(l => l.t).join(" ")).join(", ")}>
    {rows.map((r, i) => { const stack = r.lines.length > 1 && r.ics.length > 1; return <div key={i} className="sl-row"><span className="sl-ar"><ArrowSvg a={r.arrow} w={3} /></span>
      <span className={"sl-ic" + (stack ? " stack" : "")}>{r.ics.map(k => <span key={k} className="sl-c"><Picto k={k} /></span>)}</span>
      <div className="sl-lines">{r.lines.map((l, j) => <div key={j} className="sl-t">{l.t}{l.cross && <Cross />}{l.al?.map(k => <Al key={k} k={k} />)}</div>)}</div></div>; })}</div></div>;
}

const LS = "sk.games.sign";
const load = (): SignSpec => signFromHash(location.hash) || sanitize(JSON.parse(localStorage.getItem(LS) || "null")) || clone(DEFAULTS.krk);
const alList = () => [...LOGOS].map(k => [k, AL_NAMES[k] || k] as const).sort((a, b) => a[1].localeCompare(b[1]));

export function SignStudio() {
  const [s, setS0] = useState<SignSpec>(load); const [full, setFull] = useState(false); const [msg, setMsg] = useState(""); const [pick, setPick] = useState<number | "c" | null>(null);
  const [saved, setSaved] = useState<SignSpec[]>(() => { try { return (JSON.parse(localStorage.getItem(LS + "s") || "[]") as any[]).map(sanitize).filter(Boolean) as SignSpec[]; } catch { return []; } });
  const AL = useMemo(alList, []);
  const setS = (n: SignSpec) => { setS0(n); localStorage.setItem(LS, JSON.stringify(n)); };
  const rows = s.rows; const setRows = (r: SRow[]) => setS({ ...s, rows: r });
  const setRow = (i: number, p: Partial<SRow>) => setRows(rows.map((r, k) => k === i ? { ...r, ...p } : r));
  const setLine = (i: number, j: number, p: Partial<SLine>) => setRow(i, { lines: rows[i].lines.map((l, k) => k === j ? { ...l, ...p } : l) });
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rows.length) return; const r = rows.slice(); [r[i], r[j]] = [r[j], r[i]]; setRows(r); };
  const theme = (th: SThemeK) => setS(isDefault(s) ? clone(DEFAULTS[th]) : convert(s, th));
  const share = async () => { const u = signLink(s, location.origin); history.replaceState(history.state, "", `#games=signs&s=${enc(s)}`); try { if (navigator.share) await navigator.share({ url: u, title: "My airport sign" }); else { await navigator.clipboard.writeText(u); setMsg("Link copied"); } } catch { try { await navigator.clipboard.writeText(u); setMsg("Link copied"); } catch { setMsg(u); } } };
  const save = () => { const n = [s, ...saved.filter(x => JSON.stringify(x) !== JSON.stringify(s))].slice(0, 20); setSaved(n); localStorage.setItem(LS + "s", JSON.stringify(n)); setMsg("Saved on this device"); };
  const reset = () => { if (isDefault(s) || confirm(`Reset to the ${STHEMES.find(t => t[0] === s.theme)![1]} default sign? Your rows will be replaced.`)) setS(clone(DEFAULTS[s.theme])); };
  const kr = s.theme === "krk";
  const Picker = ({ have, add }: { have: string[]; add: (k: string) => void }) => <div className="sg-pick">{PICTO_KEYS.filter(k => !have.includes(k)).map(k => <button key={k} onClick={() => add(k)} title={PICTOS[k].n}><Picto k={k} /><small>{PICTOS[k].n}</small></button>)}</div>;
  return <div className="gsx sgs">
    <div className={"sg-stage " + s.theme} onClick={() => setFull(true)}><SignView s={s} /></div>
    <div className="gp-ctl"><button className="gp-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button><button className="gp-btn" onClick={share}>Share link</button><button className="gp-btn" onClick={save}>Save</button><button className="gp-btn" onClick={reset}>Reset</button>{msg && <span className="faint xs">{msg}</span>}</div>
    <div className="gp-seg sg-themes" role="tablist">{STHEMES.map(([k, n]) => <button key={k} role="tab" aria-selected={s.theme === k} className={s.theme === k ? "on" : ""} onClick={() => theme(k)}>{n}</button>)}</div>
    <div className="gsx-pre">{["default", ...PRESET_KEYS].map(k => <button key={k} onClick={() => { if (isDefault(s) || confirm("Replace this sign with the preset?")) setS(presetFor(s.theme, k)); }}>{k === "default" ? "Photo sign" : COMMON[k].n}</button>)}</div>
    {kr && <div className="sg-card"><div className="sg-card-h"><b>Corner pictograms</b></div><div className="sg-chips">{(s.corner || []).map(k => <button key={k} className="sg-chip" onClick={() => setS({ ...s, corner: (s.corner || []).filter(x => x !== k) })} aria-label={"Remove " + PICTOS[k].n}><Picto k={k} />✕</button>)}{(s.corner || []).length < 4 && <button className="sg-chip add" onClick={() => setPick(pick === "c" ? null : "c")}>＋ Pictogram</button>}</div>
      {pick === "c" && <Picker have={s.corner || []} add={k => { setS({ ...s, corner: [...(s.corner || []), k].slice(0, 4) }); setPick(null); }} />}</div>}
    {rows.map((r, i) => <div key={i} className="sg-card">
      <div className="sg-card-h"><b>Row {i + 1}</b><span><button className="sg-mini" disabled={!i} onClick={() => move(i, -1)} aria-label="Move up">↑</button><button className="sg-mini" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button><button className="sg-mini del" onClick={() => setRows(rows.filter((_, k) => k !== i))} aria-label="Delete row">✕</button></span></div>
      <label className="gsx-f"><span>Arrow</span><select value={r.arrow} onChange={e => setRow(i, { arrow: e.target.value as Arrow })}>{ARROWS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      <div className="gsx-f"><span>Pictograms</span><div className="sg-chips">{r.ics.map(k => <button key={k} className="sg-chip" onClick={() => setRow(i, { ics: r.ics.filter(x => x !== k) })} aria-label={"Remove " + PICTOS[k].n}><Picto k={k} />✕</button>)}{r.ics.length < (s.theme === "man" ? 3 : 4) && <button className="sg-chip add" onClick={() => setPick(pick === i ? null : i)}>＋ Pictogram</button>}</div></div>
      {pick === i && <Picker have={r.ics} add={k => { setRow(i, { ics: [...r.ics, k].slice(0, 4) }); setPick(null); }} />}
      {r.lines.map((l, j) => <div key={j} className="sg-line">
        {kr ? <><label className="gsx-f"><span>{j ? "Polski (white)" : "Polski (white, optional)"}</span><input value={l.t} maxLength={48} placeholder="np. Odloty" onChange={e => setLine(i, j, { t: e.target.value })} /></label>
          <label className="gsx-f"><span>English (yellow)</span><input value={l.en || ""} maxLength={48} placeholder="e.g. Departures" onChange={e => setLine(i, j, { en: e.target.value || undefined })} /></label></>
          : <label className="gsx-f"><span>{j ? `Line ${j + 1}` : "Text"}</span><input value={l.t} maxLength={48} placeholder="e.g. Gates A1-A10" onChange={e => setLine(i, j, { t: e.target.value })} /></label>}
        <div className="sg-line-x"><select aria-label="Airline logo" value={l.al?.[0] || ""} onChange={e => setLine(i, j, { al: e.target.value ? [e.target.value, ...(l.al || []).slice(1)].filter((x, k, a) => a.indexOf(x) === k) : undefined })}><option value="">No airline logo</option>{AL.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          <button className={"sg-mini" + (l.cross ? " on" : "")} onClick={() => setLine(i, j, { cross: !l.cross || undefined })} aria-pressed={!!l.cross} title="Green pharmacy cross">✚</button>
          <button className="sg-mini del" disabled={r.lines.length < 2} onClick={() => setRow(i, { lines: r.lines.filter((_, k) => k !== j) })} aria-label="Delete line">✕</button></div></div>)}
      {r.lines.length < 6 && <button className="gp-btn sg-add" onClick={() => setRow(i, { lines: [...r.lines, kr ? { t: "", en: "" } : { t: "" }] })}>＋ Add line</button>}
    </div>)}
    {rows.length < 8 && <button className="gp-btn sg-add" onClick={() => setRows([...rows, { arrow: s.theme === "lhr" ? "left" : s.theme === "man" ? "upright" : "right", ics: ["plane"], lines: [kr ? { t: "Wyjścia", en: "Gates" } : { t: "Gates" }] }])}>＋ Add row</button>}
    {saved.length > 0 && <><h3 className="gsx-h">Saved signs</h3><div className="gsx-saved">{saved.map((x, k) => <button key={k} onClick={() => setS(clone(x))}>{x.rows[0]?.lines[0]?.en || x.rows[0]?.lines[0]?.t || "Sign"}<small>{x.theme.toUpperCase()}</small></button>)}</div></>}
    <p className="faint xs mt8">Fun recreations of Kraków-, Manchester- and Heathrow-style wayfinding signs, not official airport signs. Pictograms are drawn for Skyline; airline logos come from Skyline's own set. No airport logos are used.</p>
    {full && <FullScreen onClose={() => setFull(false)} bg="radial-gradient(120% 90% at 50% 0%,#3a3f4a,#0c0e12)"><div className="sg-full"><SignView s={s} /></div></FullScreen>}</div>;
}
