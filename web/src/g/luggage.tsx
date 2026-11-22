// Lost Luggage Detective: a made-up bag went on its own adventure. Check airports' scan logs (one per day), follow the clues
// through mis-sorts and transfers, then pick the right bag out of lost property. All cases are invented for the game.
import { useState } from "react";
import { useBest } from "../games";
import { End, sfx, pick } from "./kit";

type Apt = { c: string; n: string; cc: string; x: number; y: number };
const APTS: Apt[] = [
  { c: "DUB", n: "Dublin", cc: "Ireland", x: 8, y: 38 }, { c: "MAN", n: "Manchester", cc: "the UK", x: 20, y: 36 }, { c: "LHR", n: "London", cc: "the UK", x: 23, y: 50 }, { c: "AMS", n: "Amsterdam", cc: "the Netherlands", x: 37, y: 40 },
  { c: "CDG", n: "Paris", cc: "France", x: 27, y: 61 }, { c: "FRA", n: "Frankfurt", cc: "Germany", x: 44, y: 51 }, { c: "MUC", n: "Munich", cc: "Germany", x: 49, y: 63 }, { c: "CPH", n: "Copenhagen", cc: "Denmark", x: 51, y: 27 },
  { c: "OSL", n: "Oslo", cc: "Norway", x: 48, y: 10 }, { c: "KRK", n: "Kraków", cc: "Poland", x: 72, y: 49 }, { c: "VIE", n: "Vienna", cc: "Austria", x: 64, y: 62 }, { c: "BCN", n: "Barcelona", cc: "Spain", x: 35, y: 78 },
  { c: "MAD", n: "Madrid", cc: "Spain", x: 20, y: 82 }, { c: "LIS", n: "Lisbon", cc: "Portugal", x: 6, y: 86 }, { c: "FCO", n: "Rome", cc: "Italy", x: 54, y: 80 }, { c: "ATH", n: "Athens", cc: "Greece", x: 82, y: 88 },
];
const COLOURS: [string, string][] = [["red", "#dc2626"], ["navy", "#1e3a8a"], ["green", "#15803d"], ["yellow", "#eab308"], ["purple", "#7e22ce"], ["silver", "#94a3b8"]];
const STICK = ["🦩", "⭐", "🍕", "🐱", "⚽", "🌵"]; const KIND = ["hard case", "soft holdall", "backpack"]; const TAG = ["a pink ribbon", "a green ribbon", "no ribbon"];
type Bag = { col: number; st: number; k: number; tag: number };
type Case = { owner: string; from: Apt; to: Apt; route: Apt[]; bag: Bag; tag: string; clue: Record<string, string> };
const NAMES = ["Aunt Margaret", "Mr Kowalski", "Captain Lopez", "Ingrid", "Dev", "Sofia", "Grandad Joe", "Lena"];
function makeCase(): Case { const sh = [...APTS].sort(() => Math.random() - .5); const from = sh[0], to = sh[1]; const route = [from, ...sh.slice(2, 4 + Math.floor(Math.random() * 2))];
  const bag: Bag = { col: Math.floor(Math.random() * 6), st: Math.floor(Math.random() * 6), k: Math.floor(Math.random() * 3), tag: Math.floor(Math.random() * 3) }; const tag = to.c + Math.floor(100000 + Math.random() * 899999);
  const clue: Record<string, string> = {}; route.forEach((a, i) => { const nx = route[i + 1]; if (!nx) { clue[a.c] = "found"; return; }
    const kind = i === 0 ? pick(["mis", "code"]) : pick(["country", "code", "letters", "direct"]); const others = APTS.filter(o => o.cc === nx.cc && o.c !== nx.c);
    clue[a.c] = kind === "mis" ? `Tag ${tag} read wrongly by the sorter. Belt camera shows the bag going onto a cart for ${nx.n}.` : kind === "code" ? `Scanner log: ${tag} → loaded on a flight to “${nx.c[0]}·${nx.c[2]}”. The middle letter is smudged.`
      : kind === "country" && others.length ? `Transfer desk note: “Sent on the next flight to ${nx.cc}.” (More than one airport there…)` : kind === "letters" ? `A handler remembers the cart sign: it had the letters ${[...nx.c].sort().join(", ")} on it, jumbled.` : `Loaded onto a flight to ${nx.n}. Why?! Nobody knows.`; });
  return { owner: pick(NAMES), from, to, route, bag, tag, clue }; }
const descr = (b: Bag) => `a ${COLOURS[b.col][0]} ${KIND[b.k]} with a ${STICK[b.st]} sticker and ${TAG[b.tag]}`;
export default function LuggageDetective() {
  const [best, report] = useBest("luggage"); const [c, setC] = useState<Case | null>(null); const [seen, setSeen] = useState<string[]>([]); const [log, setLog] = useState<{ t: string; k: string }[]>([]); const [days, setDays] = useState(7); const [found, setFound] = useState(false); const [bags, setBags] = useState<Bag[]>([]); const [tries, setTries] = useState(0); const [end, setEnd] = useState<{ pts: number; txt: string } | null>(null); const [nb, setNb] = useState(false);
  const start = () => { const k = makeCase(); setC(k); setSeen([]); setLog([{ t: `${k.owner} flew ${k.from.n} → ${k.to.n}, but the bag (tag ${k.tag}) never arrived. Start where it was checked in.`, k: "info" }]); setDays(7); setFound(false); setTries(0); setEnd(null); setNb(false); sfx.chime(); };
  const check = (a: Apt) => { if (!c || found || seen.includes(a.c) || days <= 0) return; setSeen([...seen, a.c]); const d = days - 1; setDays(d); const cl = c.clue[a.c];
    if (cl === "found") { setFound(true); sfx.win(); setLog(l => [{ t: `${a.n}: “We have a few unclaimed bags in lost property…” Which one matches ${c.owner}'s description?`, k: "ok" }, ...l]);
      const near = (b: Bag): Bag => { const x = { ...b }; const f = pick(["col", "st", "k", "tag"] as const); (x as any)[f] = ((x as any)[f] + 1 + Math.floor(Math.random() * 2)) % (f === "col" || f === "st" ? 6 : 3); return x; };
      const set = [c.bag, ...Array.from({ length: 5 }, () => near(c.bag))].sort(() => Math.random() - .5); setBags(set); return; }
    if (cl) { sfx.cash(); setLog(l => [{ t: `${a.n}: ${cl}`, k: "ok" }, ...l]); } else { sfx.bad(); setLog(l => [{ t: `${a.n}: no scans of tag ${c.tag} here. A day gone.`, k: "bad" }, ...l]); }
    if (d <= 0) finish(0, "Out of days. The bag is still out there… somewhere sunny, probably."); };
  const finish = (pts: number, txt: string) => { setEnd({ pts, txt }); setNb(pts > 0 && report(pts)); };
  const choose = (b: Bag) => { if (!c) return; const ok = b === c.bag; if (ok) { sfx.win(); finish(days * 150 + (tries ? 150 : 400), `Reunited! ${c.owner} hugs the bag. Route: ${c.route.map(r => r.c).join(" → ")}.`); } else { sfx.bad(); setTries(tries + 1); if (tries >= 1) finish(days * 50, "Wrong bag again… the real one goes back on the shelf."); else setLog(l => [{ t: "That's someone else's bag! One more try.", k: "bad" }, ...l]); } };
  if (!c || end) return <div className="g4"><End big={end?.pts} unit={end ? "points" : undefined} nb={nb} msg={end?.txt || "A bag has gone missing. Check one airport per day to read its scan logs, follow the clues (smudged codes, jumbled letters, countries), and find the bag before 7 days are up. Then spot the right bag in lost property."}>{best != null && <p className="sm muted">Best {best}</p>}<button className="gp-btn pri" onClick={start}>{end ? "New case" : "Open the case file"}</button></End></div>;
  const path = c.route.filter(a => seen.includes(a.c));
  return <div className="g4"><div className="g4-hud"><span>📅 {days} days left</span><span>🏷 {c.tag}</span><span>🧳 {descr(c.bag)}</span></div>
    {!found ? <div className="g4-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none">{path.slice(1).map((a, i) => <line key={a.c} x1={path[i].x} y1={path[i].y} x2={a.x} y2={a.y} stroke="#fcd34d" strokeWidth=".8" strokeDasharray="2 1.5" />)}<line x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} stroke="rgba(255,255,255,.25)" strokeWidth=".5" /></svg>
      {APTS.map(a => <button key={a.c} className={(seen.includes(a.c) ? "seen" : "") + (a.c === c.from.c && !seen.length ? " here" : "")} style={{ left: a.x + "%", top: a.y + "%" }} onClick={() => check(a)}>{a.c}</button>)}</div>
      : <div className="g4-card"><b>Lost property at {c.route.at(-1)!.n}</b><p className="g4-intro">{c.owner}'s bag: {descr(c.bag)}.</p><div className="g4-bags">{bags.map((b, k) => <button key={k} onClick={() => choose(b)}><i style={{ background: COLOURS[b.col][1], borderRadius: b.k === 1 ? 16 : b.k === 2 ? "14px 14px 6px 6px" : 7 }}>{STICK[b.st]}</i>{KIND[b.k]}<small>{TAG[b.tag]}</small></button>)}</div></div>}
    <ul className="g4-log">{log.map((l, k) => <li key={k} className={l.k}>{l.t}</li>)}</ul></div>;
}
