// Airport Manager v2 simulation: pure functions only (no React, no DOM) so the economy and the day loop can be unit-tested.
// Game numbers (fees, wages, costs) are made-up game balance, not real-world figures.

export type Look = { bg: string; fg: string; acc: string; font: "rounded" | "frutiger" | "condensed" | "mono"; picto: "square" | "circle" | "line"; bi: boolean };
export type GStyleK = "mag" | "krk" | "lpa" | "lhr" | "spot";
// ---------- grid ----------
export const W = 14, H = 10;
export type Tile = "g" | "rw" | "tx" | "st" | "gt" | "tm" | "tw" | "sh" | "fd" | "pk" | "rl" | "sc" | "bg" | "hg";
export type BuildDef = { k: Tile; n: string; e: string; cost: number; upkeep: number; lvl: number; sub: string };
export const BUILD: BuildDef[] = [
  { k: "tx", n: "Taxiway", e: "▦", cost: 600, upkeep: 5, lvl: 1, sub: "Connects runways to stands" },
  { k: "st", n: "Remote stand", e: "🅿️", cost: 2500, upkeep: 30, lvl: 1, sub: "Parks a plane; passengers take a bus (less happy)" },
  { k: "tm", n: "Terminal", e: "🏢", cost: 4000, upkeep: 120, lvl: 1, sub: "Gates must touch the terminal" },
  { k: "sc", n: "Security", e: "🛂", cost: 3500, upkeep: 60, lvl: 1, sub: "2 lanes; needs 2 security staff per lane" },
  { k: "gt", n: "Gate + jet bridge", e: "🌉", cost: 7000, upkeep: 90, lvl: 2, sub: "Touches a terminal and a taxiway; happier passengers" },
  { k: "tw", n: "Control tower", e: "🗼", cost: 15000, upkeep: 150, lvl: 1, sub: "Lets ATC staff raise runway capacity" },
  { k: "sh", n: "Shops", e: "🛍️", cost: 3000, upkeep: 40, lvl: 1, sub: "Passengers spend money before flying" },
  { k: "fd", n: "Restaurant", e: "🍔", cost: 3000, upkeep: 40, lvl: 1, sub: "Food and coffee: money and happiness" },
  { k: "bg", n: "Baggage hall", e: "🧳", cost: 4000, upkeep: 70, lvl: 1, sub: "Bag belts for arriving passengers" },
  { k: "pk", n: "Car park", e: "🚗", cost: 2500, upkeep: 20, lvl: 1, sub: "Parking fees" },
  { k: "rl", n: "Rail link", e: "🚆", cost: 25000, upkeep: 300, lvl: 3, sub: "More passengers want to fly from you" },
  { k: "hg", n: "Hangar", e: "🛠️", cost: 9000, upkeep: 120, lvl: 4, sub: "Faster turnarounds, fewer technical delays" },
];
export const RUNWAY_TILE = 2500;
export const bdef = (k: Tile) => BUILD.find(b => b.k === k);
const nb = (i: number) => { const x = i % W, y = (i / W) | 0; const o: number[] = []; if (x > 0) o.push(i - 1); if (x < W - 1) o.push(i + 1); if (y > 0) o.push(i - W); if (y < H - 1) o.push(i + W); return o; };
export const count = (g: Tile[], k: Tile) => g.reduce((n, t) => n + (t === k ? 1 : 0), 0);
export const runwayRows = (g: Tile[]) => { const r: number[] = []; for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (g[y * W + x] === "rw") n++; if (n >= W - 2) r.push(y); } return r; };
/** Shortest taxi route (tile indexes) from a runway tile to a stand/gate, over runway + taxiway tiles. Empty if unreachable. */
export function taxiPath(g: Tile[], stand: number): number[] {
  const start = nb(stand).filter(i => g[i] === "tx"); if (!start.length) return [];
  const prev = new Map<number, number>(); const q = [...start]; start.forEach(s => prev.set(s, -1));
  while (q.length) { const c = q.shift()!; if (g[c] === "rw") { const p: number[] = []; for (let k = c; k !== -1; k = prev.get(k)!) p.push(k); return [...p, stand]; }
    for (const n of nb(c)) if (!prev.has(n) && (g[n] === "tx" || g[n] === "rw")) { prev.set(n, c); q.push(n); } }
  return []; }
export const isStand = (t: Tile) => t === "st" || t === "gt";
export const usableStands = (g: Tile[]) => g.map((t, i) => isStand(t) && (t !== "gt" || nb(i).some(n => g[n] === "tm")) && taxiPath(g, i).length ? i : -1).filter(i => i >= 0);
export function canBuild(s: Save, i: number, k: Tile): string | null {
  const d = bdef(k); if (!d) return "Unknown building"; if (s.level < d.lvl) return `Needs level ${d.lvl} (${LEVELS[d.lvl - 1].n})`;
  if (s.grid[i] !== "g") return "Bulldoze this tile first"; if (s.money < d.cost) return "Not enough money";
  if (k === "gt" && !nb(i).some(n => s.grid[n] === "tm")) return "A gate must touch a terminal";
  if ((k === "gt" || k === "st") && !nb(i).some(n => s.grid[n] === "tx")) return "Stands need a taxiway next to them";
  if ((k === "sh" || k === "fd" || k === "sc" || k === "bg") && !nb(i).some(n => s.grid[n] === "tm" || s.grid[n] === k || s.grid[n] === "sh" || s.grid[n] === "fd")) return "Build it next to the terminal";
  if (k === "tw" && s.grid.includes("tw")) return "You already have a tower";
  return null; }
export function canRunway(s: Save, y: number): string | null { const row = s.grid.slice(y * W, y * W + W); if (row.every(t => t === "rw")) return "Already a runway";
  if (row.some(t => t !== "g" && t !== "rw")) return "Clear the whole row first"; if (runwayRows(s.grid).length >= 1 && s.level < 3) return "A second runway needs level 3 (City airport)";
  if (runwayRows(s.grid).length >= 2) return "Two runways is the maximum"; const c = row.filter(t => t !== "rw").length * RUNWAY_TILE; if (s.money < c) return "Not enough money"; return null; }
export const runwayCost = (s: Save, y: number) => s.grid.slice(y * W, y * W + W).filter(t => t !== "rw").length * RUNWAY_TILE;

// ---------- world data ----------
export type Staff = { sec: number; chk: number; gnd: number; atc: number };
export const WAGE: Staff = { sec: 140, chk: 110, gnd: 130, atc: 260 };
export const STAFF_INFO: Record<keyof Staff, [string, string, string]> = { sec: ["Security officers", "👮", "Staff security lanes (2 per lane)"], chk: ["Check-in agents", "🧑‍💼", "Each handles ~120 passengers an hour"], gnd: ["Ground crew", "🦺", "Faster turnarounds and pushbacks"], atc: ["Air traffic controllers", "🎧", "More take-offs and landings per hour (needs a tower)"] };
export type Research = { id: string; n: string; e: string; cost: number; days: number; need?: string; sub: string };
export const RESEARCH: Research[] = [
  { id: "auto", n: "Smart gate planner", e: "🧠", cost: 2000, days: 1, sub: "Auto-assign puts flights on jet-bridge gates first (happier passengers, VIP bonus)" },
  { id: "egate", n: "eGates", e: "🛂", cost: 6000, days: 1, sub: "Security lanes 40% faster" },
  { id: "bagdrop", n: "Self bag drop", e: "🏷️", cost: 5000, days: 1, sub: "Check-in agents handle twice as many passengers" },
  { id: "push", n: "Electric tugs", e: "🔌", cost: 7000, days: 1, need: "auto", sub: "Pushback and turnaround 8 min faster" },
  { id: "deice", n: "De-icing pads", e: "❄️", cost: 9000, days: 2, sub: "Snow no longer stops flights" },
  { id: "bird", n: "Bird radar", e: "🦅", cost: 8000, days: 2, sub: "Bird strikes close the runway for 5 min, not 25" },
  { id: "ils", n: "ILS CAT III", e: "📡", cost: 12000, days: 2, sub: "Fog doesn't cut runway capacity" },
  { id: "lounge", n: "Premium lounge", e: "🛋️", cost: 10000, days: 2, need: "egate", sub: "+£2 per passenger and happier passengers" },
  { id: "solar", n: "Solar roofs", e: "☀️", cost: 11000, days: 2, sub: "Building upkeep 30% lower" },
  { id: "night", n: "Night operations", e: "🌙", cost: 15000, days: 3, need: "ils", sub: "Flights also from 05:00 and until 01:00" },
  { id: "sorter", n: "Bag sorting robots", e: "🤖", cost: 9000, days: 2, need: "bagdrop", sub: "Baggage halls handle twice the bags, no lost bags" },
  { id: "app", n: "Airport app", e: "📱", cost: 6000, days: 1, sub: "Passengers get gate alerts: fewer late passengers, +3 happiness" },
];
export const LEVELS = [
  { n: "Airfield", pax: 0, stars: 0 }, { n: "Regional airport", pax: 1200, stars: 2 }, { n: "City airport", pax: 3500, stars: 3 },
  { n: "International airport", pax: 7000, stars: 3.5 }, { n: "Hub", pax: 13000, stars: 4 }, { n: "Mega hub", pax: 22000, stars: 4.5 },
];
export type Mission = { id: string; n: string; reward: number; done?: boolean };
export const MISSIONS: { id: string; n: string; reward: number; ok: (s: Save) => boolean }[] = [
  { id: "fl10", n: "Handle 10 flights in one day", reward: 3000, ok: s => (s.hist.at(-1)?.flights || 0) >= 10 },
  { id: "gate2", n: "Build 2 gates with jet bridges", reward: 4000, ok: s => count(s.grid, "gt") >= 2 },
  { id: "con3", n: "Have 3 airline contracts", reward: 5000, ok: s => s.contracts.length >= 3 },
  { id: "shop", n: "Open shops and a restaurant", reward: 2500, ok: s => s.grid.includes("sh") && s.grid.includes("fd") },
  { id: "ot90", n: "End a day with 90%+ on time (8+ flights)", reward: 5000, ok: s => { const h = s.hist.at(-1); return !!h && h.flights >= 8 && h.ontime >= 90; } },
  { id: "star3", n: "Reach 3 stars", reward: 8000, ok: s => stars(s) >= 3 },
  { id: "tower", n: "Build a control tower and hire ATC", reward: 4000, ok: s => s.grid.includes("tw") && s.staff.atc > 0 },
  { id: "res3", n: "Finish 3 upgrades", reward: 6000, ok: s => Object.keys(s.research).length >= 3 },
  { id: "pax3k", n: "Serve 3,000 passengers in a day", reward: 9000, ok: s => (s.hist.at(-1)?.pax || 0) >= 3000 },
  { id: "rw2", n: "Open a second runway", reward: 15000, ok: s => runwayRows(s.grid).length >= 2 },
  { id: "rail", n: "Connect a rail link", reward: 10000, ok: s => s.grid.includes("rl") },
  { id: "prof", n: "Make £25,000 profit in one day", reward: 12000, ok: s => { const h = s.hist.at(-1); return !!h && h.profit >= 25000; } },
];
export const ACH: { id: string; n: string; e: string; ok: (s: Save) => boolean }[] = [
  { id: "first", n: "First landing", e: "🛬", ok: s => s.tot.flights >= 1 },
  { id: "k1", n: "1,000 passengers", e: "🧍", ok: s => s.tot.pax >= 1000 },
  { id: "k10", n: "10,000 passengers", e: "👥", ok: s => s.tot.pax >= 10000 },
  { id: "k100", n: "100,000 passengers", e: "🏟️", ok: s => s.tot.pax >= 100000 },
  { id: "gate", n: "Jet bridge", e: "🌉", ok: s => s.grid.includes("gt") },
  { id: "tower", n: "Eyes on the sky", e: "🗼", ok: s => s.grid.includes("tw") },
  { id: "rw2", n: "Parallel runways", e: "🛫", ok: s => runwayRows(s.grid).length >= 2 },
  { id: "s4", n: "Four-star airport", e: "⭐", ok: s => stars(s) >= 4 },
  { id: "perfect", n: "Perfect day (100% on time)", e: "💯", ok: s => { const h = s.hist.at(-1); return !!h && h.flights >= 10 && h.ontime === 100; } },
  { id: "rich", n: "Cash £250,000", e: "💰", ok: s => s.money >= 250000 },
  { id: "debtfree", n: "Paid off a loan", e: "🧾", ok: s => !!s.flags.repaid },
  { id: "storm", n: "Weathered a storm", e: "⛈️", ok: s => !!s.flags.storm },
  { id: "vip", n: "VIP treatment", e: "🎩", ok: s => !!s.flags.vip },
  { id: "hub", n: "Hub status", e: "🌍", ok: s => s.level >= 5 },
  { id: "lab", n: "Mad scientist (6 upgrades)", e: "🔬", ok: s => Object.keys(s.research).length >= 6 },
  { id: "air5", n: "Five airlines", e: "🤝", ok: s => s.contracts.length >= 5 },
];

// ---------- flights ----------
export type Ph = "sched" | "app" | "land" | "taxiIn" | "park" | "push" | "taxiOut" | "tkof" | "gone" | "cxl" | "hold";
export type Rot = { id: string; num: string; al: string; city: string; arr: number; dep: number; pax: number; stand?: number; ph: Ph; t0: number; delay: number; vip?: boolean; div?: boolean; ready?: number };
export type Contract = { id: string; al: string; perDay: number; pax: number; fee: number; days: number; left: number; demand: { gates?: number; stars?: number; ontime?: number }; strikes: number; ot?: [number, number] };
export type Ev = { id: string; k: "storm" | "snow" | "strike" | "bird" | "vip" | "fog" | "divert" | "heat"; at: number; until?: number; done?: boolean; choice?: string };
export type DayLog = { d: number; flights: number; pax: number; ontime: number; cxl: number; rev: number; cost: number; profit: number; cash: number; mood: number; lost?: number; fees: number; shops: number; parking: number; wages: number; upkeep: number; interest: number };
export type Save = {
  v: 2; stage: "setup" | "play"; step: number; name: string; code: string; region: string; op: string; look: Look; gstyle: GStyleK; term: string; board: string;
  grid: Tile[]; money: number; loan: number; rep: number; mood: number; level: number; staff: Staff; contracts: Contract[]; offers: Contract[]; research: Record<string, 1>; rsch: { id: string; left: number } | null;
  day: number; clock: number; phase: "day" | "night" | "summary"; rots: Rot[]; evs: Ev[]; q: number; seed: number; hist: DayLog[]; ach: string[]; missions: Mission[]; reviews: { t: string; s: number }[];
  tot: { pax: number; flights: number }; flags: Record<string, any>; today: { pax: number; ot: number; late: number; cxl: number; fees: number; shops: number; parking: number; other: number; lost: number; moodSum: number; moodN: number };
  lastMove: number; auto: boolean; best?: number };
export const stars = (s: Pick<Save, "rep">) => Math.round((1 + Math.max(0, Math.min(100, s.rep)) / 25) * 2) / 2;
export const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const emptyToday = () => ({ pax: 0, ot: 0, late: 0, cxl: 0, fees: 0, shops: 0, parking: 0, other: 0, lost: 0, moodSum: 0, moodN: 0 });
export function startGrid(): Tile[] { const g: Tile[] = Array(W * H).fill("g"); for (let x = 0; x < W; x++) { g[W + x] = "rw"; g[2 * W + x] = "tx"; }
  g[3 * W + 3] = "st"; g[3 * W + 4] = "st"; g[4 * W + 3] = "tm"; g[4 * W + 4] = "tm"; g[4 * W + 5] = "tm"; g[5 * W + 4] = "sc"; g[7 * W + 3] = "pk"; return g; }
export function freshSave(seed = Date.now() % 1e9): Save {
  return { v: 2, stage: "setup", step: 0, name: "", code: "", region: "uk", op: "indie", look: { bg: "#111418", fg: "#ffd200", acc: "#ffd200", font: "frutiger", picto: "square", bi: false }, gstyle: "mag", term: "glass", board: "mag",
    grid: startGrid(), money: 60000, loan: 0, rep: 40, mood: 70, level: 1, staff: { sec: 2, chk: 2, gnd: 2, atc: 0 }, contracts: [], offers: [], research: {}, rsch: null,
    day: 1, clock: 300, phase: "summary", rots: [], evs: [], q: 0, seed, hist: [], ach: [], missions: [], reviews: [], tot: { pax: 0, flights: 0 }, flags: {}, today: emptyToday(), lastMove: -99, auto: true }; }
export const OPEN = (s: Save) => s.research.night ? 300 : 360, CLOSE = (s: Save) => s.research.night ? 1500 : 1380;
export const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m) % 60).padStart(2, "0")}`;
export const runwayCap = (s: Save) => { const r = runwayRows(s.grid).length; if (!r) return 0; const atc = s.grid.includes("tw") ? Math.min(s.staff.atc, 3 * r) : 0; return r * (6 + 3 * atc / r); }; // movements per hour
export const turnMin = (s: Save) => Math.max(25, 50 - 3 * Math.min(s.staff.gnd, 6) - (s.research.push ? 8 : 0) - (s.grid.includes("hg") ? 4 : 0));
export const secRate = (s: Save) => { const lanes = Math.min(count(s.grid, "sc") * 2, Math.floor(s.staff.sec / 2)); return lanes * 150 * (s.research.egate ? 1.4 : 1); }; // pax per hour
export const chkRate = (s: Save) => s.staff.chk * 120 * (s.research.bagdrop ? 2 : 1);
export const bagRate = (s: Save) => count(s.grid, "bg") * 400 * (s.research.sorter ? 2 : 1) + 150; // a baggage cart service even without a hall
export const upkeepOf = (s: Save) => Math.round(s.grid.reduce((n, t) => n + (t === "rw" ? 15 : bdef(t)?.upkeep || 0), 0) * (s.research.solar ? 0.7 : 1));
export const wagesOf = (s: Save) => (Object.keys(WAGE) as (keyof Staff)[]).reduce((n, k) => n + WAGE[k] * s.staff[k], 0);
export const loanMax = (s: Save) => 40000 * s.level;
export const spendPerPax = (s: Save) => { const sh = count(s.grid, "sh"), fd = count(s.grid, "fd"); return 4 * (1 - Math.exp(-sh / 2)) + 3 * (1 - Math.exp(-fd / 2)) + (s.research.lounge ? 1.5 : 0); };
export const opsCost = (pax: number) => Math.round(120 + pax * 0.6); // handling, power, cleaning per turnaround

// Airlines per region (codes only; names come from the app's airline list). Fees are game numbers.
export const REGION_ALS: Record<string, string[]> = { uk: ["U2", "FR", "LS", "BA", "EI", "EK", "TK", "KL", "W6"], pl: ["W6", "FR", "LO", "LH", "U2", "TK", "KL", "DY"], es: ["VY", "FR", "U2", "IB", "LS", "X3", "BA", "UX"], gr: ["A3", "FR", "U2", "W6", "DE", "LS", "BA", "TK"], de: ["LH", "EW", "FR", "U2", "TK", "EK", "OS", "LX"], no: ["DY", "SK", "WF", "KL", "LH", "FR", "AY"] };
export const REGION_DESTS: Record<string, string[]> = { uk: ["Dublin", "Alicante", "Palma", "Tenerife", "Amsterdam", "Paris", "Dubai", "Istanbul", "Faro", "Rome", "Malaga", "Geneva"], pl: ["London", "Dortmund", "Warsaw", "Munich", "Malaga", "Barcelona", "Larnaca", "Oslo", "Paris", "Rome", "Eindhoven"], es: ["Madrid", "Barcelona", "Manchester", "London", "Dusseldorf", "Bilbao", "Seville", "Hanover", "Oslo", "Dublin"], gr: ["Athens", "London", "Manchester", "Dusseldorf", "Vienna", "Milan", "Amsterdam", "Krakow", "Rome", "Stuttgart"], de: ["Frankfurt", "Berlin", "Hamburg", "Palma", "Vienna", "London", "Istanbul", "Dubai", "Antalya", "Zurich"], no: ["Oslo", "Bergen", "Stavanger", "Tromso", "Copenhagen", "Amsterdam", "London", "Gdansk", "Alicante", "Reykjavik"] };
const WX: Record<string, Ev["k"][]> = { uk: ["storm", "fog", "fog", "bird", "strike", "vip", "divert"], pl: ["snow", "snow", "fog", "strike", "vip", "bird", "divert"], es: ["heat", "storm", "bird", "vip", "divert", "strike"], gr: ["heat", "storm", "storm", "vip", "bird", "divert"], de: ["snow", "fog", "storm", "strike", "vip", "bird", "divert"], no: ["snow", "snow", "fog", "storm", "bird", "divert"] };
export const EV_INFO: Record<Ev["k"], { n: string; e: string; txt: string; ch: [string, string, number][] }> = {
  storm: { n: "Thunderstorm", e: "⛈️", txt: "Storm cells over the airport for an hour: runway capacity halves.", ch: [["wait", "Hold and wait it out", 0], ["divert", "Send arrivals to a neighbour (-£1,500, fewer delays)", 1500]] },
  snow: { n: "Snow", e: "❄️", txt: "Snow is settling on the runway.", ch: [["plough", "Plough the runway now (-£3,000, 20 min closed)", 3000], ["wait", "Keep going and hope (long delays without de-icing)", 0]] },
  strike: { n: "Security staff strike", e: "✊", txt: "Security officers walk out for 3 hours unless you pay a bonus.", ch: [["pay", "Pay the bonus (-£4,000)", 4000], ["refuse", "Refuse: half the lanes close", 0]] },
  bird: { n: "Bird strike", e: "🐦", txt: "A plane hit a flock on take-off and returned safely. The runway must be checked.", ch: [["check", "Inspect the runway (closed for a while)", 0]] },
  vip: { n: "VIP flight", e: "🎩", txt: "A celebrity's private jet arrives soon. Give it a stand with a jet bridge for a bonus.", ch: [["ok", "Roll out the red carpet", 0]] },
  fog: { n: "Fog", e: "🌫️", txt: "Thick fog for two hours: fewer landings per hour without ILS CAT III.", ch: [["ok", "Understood", 0]] },
  divert: { n: "Diversion", e: "↪️", txt: "A flight that can't land at its destination asks to divert to you. It needs a free stand.", ch: [["accept", "Accept (+£2,500 if it gets a stand)", 0], ["decline", "Decline", 0]] },
  heat: { n: "Heatwave", e: "🥵", txt: "Very hot: passengers want cold drinks and shade.", ch: [["water", "Hand out free water (-£800, happier passengers)", 800], ["ok", "Carry on", 0]] },
};

export function makeOffer(s: Save, r: () => number): Contract { const als = REGION_ALS[s.region] || REGION_ALS.uk; const have = new Set([...s.contracts, ...s.offers].map(c => c.al));
  const pool = als.filter(a => !have.has(a)); const al = (pool.length ? pool : als)[Math.floor(r() * (pool.length || als.length))];
  const big = r() < 0.15 + s.level * 0.08; const perDay = Math.max(1, Math.round((big ? 4 : 2) + r() * (1 + s.level * 1.2))); const pax = Math.round((120 + r() * 70 + (big ? 60 : 0)) / 5) * 5;
  const demand: Contract["demand"] = {}; if (r() < 0.45) demand.ontime = 75 + Math.round(r() * 3) * 5; if (s.level >= 2 && r() < 0.35) demand.gates = Math.min(6, 1 + Math.floor(r() * (s.level + 1))); if (s.level >= 2 && r() < 0.3) demand.stars = Math.min(4.5, 2 + Math.floor(r() * s.level) * 0.5);
  const fee = Math.round((200 + pax * 2.4 + Object.keys(demand).length * 120 + r() * 150) / 25) * 25;
  return { id: "c" + Math.floor(r() * 1e9).toString(36), al, perDay, pax, fee, days: 5 + Math.floor(r() * 6), left: 0, demand, strikes: 0 }; }
export const meets = (s: Save, c: Contract) => { const m: string[] = []; if (c.demand.gates && count(s.grid, "gt") < c.demand.gates) m.push(`${c.demand.gates} jet-bridge gates`); if (c.demand.stars && stars(s) < c.demand.stars) m.push(`${c.demand.stars}★ rating`); return m; };

/** Builds the day's rotations (arrive → turn around → depart) from the airline contracts. */
export function planDay(s: Save, r: () => number): Rot[] { const out: Rot[] = []; const dests = REGION_DESTS[s.region] || REGION_DESTS.uk; const o = OPEN(s) + 20, c = CLOSE(s) - 70; const tm = turnMin(s);
  for (const k of s.contracts) for (let i = 0; i < k.perDay; i++) { const arr = Math.round((o + ((i + r() * 0.8) / k.perDay) * (c - o)) / 5) * 5;
    out.push({ id: k.id + "-" + i, num: k.al + (100 + Math.floor(r() * 8800)), al: k.al, city: dests[Math.floor(r() * dests.length)], arr, dep: arr + tm + 10 + Math.round(r() * 3) * 5, pax: Math.round(k.pax * (0.8 + r() * 0.25) * (s.grid.includes("rl") ? 1.12 : 1)), ph: "sched", t0: 0, delay: 0 }); }
  return out.sort((a, b) => a.arr - b.arr); }
export function startDay(s: Save): Save { const r = rng(s.seed + s.day * 7919); const n: Save = { ...s, phase: "day", clock: OPEN(s), rots: [], evs: [], q: 0, today: emptyToday(), lastMove: -99, flags: { ...s.flags, fx: {} } };
  n.rots = planDay(n, r); const pool = WX[s.region] || WX.uk; const ne = r() < 0.25 ? 0 : r() < 0.7 ? 1 : 2;
  for (let i = 0; i < ne; i++) n.evs.push({ id: "e" + s.day + i, k: pool[Math.floor(r() * pool.length)], at: Math.round((OPEN(s) + 90 + r() * (CLOSE(s) - OPEN(s) - 240)) / 5) * 5 });
  return n; }

export type FX = { k: "land" | "tkof" | "cash" | "alert" | "event" | "level" | "mission" | "ach" | "bad"; txt?: string; id?: string };
const standBusy = (s: Save, st: number, from: number, to: number, except?: string) => s.rots.some(o => o.id !== except && o.stand === st && !["gone", "cxl"].includes(o.ph) && !(to <= o.arr + o.delay - 10 || from >= o.dep + o.delay + 10));
export function freeStands(s: Save, r: Rot): number[] { const all = usableStands(s.grid); return all.filter(st => !standBusy(s, st, r.arr + r.delay - 10, r.dep + r.delay + 10, r.id)).sort((a, b) => s.research.auto ? (s.grid[b] === "gt" ? 1 : 0) - (s.grid[a] === "gt" ? 1 : 0) || a - b : a - b); }
export function assign(s: Save, id: string, stand: number): Save | string { const r = s.rots.find(x => x.id === id); if (!r) return "No such flight"; if (!usableStands(s.grid).includes(stand)) return "That stand can't be reached";
  if (standBusy(s, stand, Math.max(s.clock, r.arr + r.delay - 10), r.dep + r.delay + 10, r.id)) return "Stand is busy then"; if (["taxiIn", "park", "push", "taxiOut", "tkof", "gone", "cxl"].includes(r.ph)) return "Too late to move this flight";
  return { ...s, rots: s.rots.map(x => x.id === id ? { ...x, stand } : x) }; }
const fxFlag = (s: Save) => (s.flags.fx || {}) as Record<string, number>;

/** Advance the simulation by `dm` game minutes (≤ 5 per call). Returns the new state and sound/toast effects. */
export function step(s0: Save, dm: number): { s: Save; fx: FX[] } {
  if (s0.phase !== "day") return { s: s0, fx: [] }; const fx: FX[] = []; const r = rng(s0.seed + Math.floor(s0.clock * 13) + s0.day); const s: Save = { ...s0, rots: s0.rots.map(x => ({ ...x })), evs: s0.evs.map(e => ({ ...e })), today: { ...s0.today }, flags: { ...s0.flags, fx: { ...fxFlag(s0) } } };
  const now = s.clock + dm; const f = fxFlag(s); const cap = runwayCap(s) * (now < (f.storm || 0) ? 0.5 : 1) * (now < (f.fog || 0) && !s.research.ils ? 0.5 : 1) * (now < (f.snow || 0) && !s.research.deice ? 0.3 : 1);
  const closed = now < (f.rwClosed || 0); const sep = cap > 0 ? 60 / cap : 1e9; const can = () => !closed && now - s.lastMove >= sep;
  // events
  for (const e of s.evs) if (!e.done && !e.choice && now >= e.at && s.clock < e.at + 1) { fx.push({ k: "event", id: e.id, txt: EV_INFO[e.k].n }); }
  for (const e of s.evs) if (!e.choice && now >= e.at + 30 && !e.done) resolve(s, e, EV_INFO[e.k].ch[0][0]); // unanswered → default
  // security queue (departing passengers arrive 2 h → 40 min before departure)
  const arrRate = s.rots.filter(x => !["gone", "cxl"].includes(x.ph) && x.dep + x.delay - now > 40 && x.dep + x.delay - now <= 120).reduce((n, x) => n + x.pax / 80, 0); // pax/min
  const sr = secRate(s) * (now < (f.strike || 0) ? 0.5 : 1) / 60; s.q = Math.max(0, s.q + (arrRate - sr) * dm); const qMin = sr > 0 ? s.q / sr : (s.q > 0 ? 99 : 0);
  const chkOver = Math.max(0, arrRate * 60 - chkRate(s)) / 60;
  for (const x of s.rots) {
    const T = (m: number) => x.t0 + m <= now;
    switch (x.ph) {
      case "sched": if (now >= x.arr + x.delay - 8) { if (s.auto) { const fr = freeStands(s, x); if (fr.length && x.stand == null) x.stand = fr[0]; } x.ph = "app"; x.t0 = now; } break;
      case "app": if (T(6)) { if (x.stand == null || !usableStands(s.grid).includes(x.stand)) { x.ph = "hold"; x.t0 = now; } else if (can()) { x.ph = "land"; x.t0 = now; s.lastMove = now; fx.push({ k: "land" }); } else x.delay += dm; } break;
      case "hold": x.delay += dm; if (x.stand != null && can()) { x.ph = "land"; x.t0 = now; s.lastMove = now; fx.push({ k: "land" }); } else if (now - x.t0 > 50) { x.ph = "cxl"; s.today.cxl++; fx.push({ k: "bad", txt: `${x.num} diverted away: no stand` }); }
        else if (s.auto && x.stand == null) { const fr = freeStands(s, x); if (fr.length) x.stand = fr[0]; } break;
      case "land": if (T(2)) { x.ph = "taxiIn"; x.t0 = now; } break;
      case "taxiIn": if (T(4)) { x.ph = "park"; x.t0 = now; x.ready = now + turnMin(s) + (s.grid[x.stand!] === "st" ? 5 : 0); s.today.pax += x.pax; const bags = s.rots.filter(o => o.ph === "park" || o === x).filter(o => now - o.t0 < 60 || o === x).reduce((n, o) => n + o.pax * 0.8, 0); if (bags > bagRate(s) && !s.research.sorter) s.today.lost += Math.round((bags - bagRate(s)) * 0.03); } break;
      case "park": { const lateQ = qMin > 25 ? Math.min(15, (qMin - 25) / 2) : 0; const want = Math.max(x.dep + x.delay, x.ready || 0); if (now >= want + lateQ) { if (can()) { x.ph = "push"; x.t0 = now; } else x.delay += dm; } else if (now >= x.dep + x.delay) x.delay += dm; } break;
      case "push": if (T(s.research.push ? 2 : 3)) { x.ph = "taxiOut"; x.t0 = now; } break;
      case "taxiOut": if (T(4)) { if (can() || T(12)) { x.ph = "tkof"; x.t0 = now; s.lastMove = now; fx.push({ k: "tkof" }); } else x.delay += dm; } break;
      case "tkof": if (T(2)) { x.ph = "gone"; x.t0 = now; const c = s.contracts.find(k => x.id.startsWith(k.id + "-")); const fee = (c?.fee || 800) + (x.div ? 2500 : 0) + (x.vip && s.grid[x.stand!] === "gt" ? 3000 : 0);
          if (x.vip && s.grid[x.stand!] === "gt") s.flags.vip = 1; const spend = x.pax * spendPerPax(s) * (0.6 + s.mood / 250); const park = Math.min(x.pax * 0.3, count(s.grid, "pk") * 60) * 3; const ops = opsCost(x.pax); s.today.other -= ops; s.money -= ops;
          s.today.fees += fee; s.today.shops += Math.round(spend); s.today.parking += Math.round(park); s.money += fee + Math.round(spend) + Math.round(park); s.today.pax += x.pax; s.tot.pax += x.pax * 2; s.tot.flights++;
          const late = x.delay > 15; if (late) s.today.late++; else s.today.ot++; if (c) c.ot = [(c.ot?.[0] || 0) + (late ? 0 : 1), (c.ot?.[1] || 0) + 1]; fx.push({ k: "cash", txt: `+£${(fee + Math.round(spend) + Math.round(park)).toLocaleString("en-GB")} ${x.num}` }); } break; }
  }
  s.contracts = s.contracts.map(c => ({ ...c }));
  // passenger mood drifts toward a target
  const live = s.rots.filter(x => ["park", "push", "hold", "app"].includes(x.ph)); const avgDelay = live.length ? live.reduce((n, x) => n + x.delay, 0) / live.length : 0; const remote = live.filter(x => x.stand != null && s.grid[x.stand] === "st").length / Math.max(1, live.length);
  const target = 78 - Math.min(30, qMin * 0.8) - Math.min(25, avgDelay * 0.5) - remote * 10 - Math.min(10, chkOver * 0.5) + (s.grid.includes("sh") ? 4 : 0) + (s.grid.includes("fd") ? 5 : 0) + (s.grid.includes("rl") ? 4 : 0) + (s.research.lounge ? 4 : 0) + (s.research.app ? 3 : 0) + (now < (f.water || 0) ? 6 : 0) - (now < (f.heat || 0) && !(now < (f.water || 0)) ? 8 : 0);
  s.mood = Math.max(0, Math.min(100, s.mood + (target - s.mood) * Math.min(1, 0.03 * dm))); s.today.moodSum += s.mood * dm; s.today.moodN += dm;
  s.clock = now; if (now >= CLOSE(s) && s.rots.every(x => ["gone", "cxl", "sched"].includes(x.ph))) { for (const x of s.rots) if (x.ph === "sched") { x.ph = "cxl"; s.today.cxl++; } return endDay(s, fx); }
  if (now >= CLOSE(s) + 120) { for (const x of s.rots) if (!["gone", "cxl"].includes(x.ph)) { x.ph = "cxl"; s.today.cxl++; } return endDay(s, fx); }
  void r; return { s, fx }; }

export function resolve(s: Save, e: Ev, choice: string) { const f = fxFlag(s); e.choice = choice; e.done = true; const cost = EV_INFO[e.k].ch.find(c => c[0] === choice)?.[2] || 0; s.money -= cost; s.today.other -= cost; const t = Math.max(s.clock, e.at);
  if (e.k === "storm") { f.storm = t + 60; s.flags.storm = 1; if (choice === "divert") s.rots.filter(x => x.ph === "sched" && x.arr - t < 60).forEach(x => { x.arr += 25; x.dep += 25; }); }
  if (e.k === "snow") { if (choice === "plough") f.rwClosed = t + 20; else f.snow = t + 120; }
  if (e.k === "strike" && choice !== "pay") f.strike = t + 180;
  if (e.k === "bird") f.rwClosed = t + (s.research.bird ? 5 : 25);
  if (e.k === "fog") f.fog = t + 120;
  if (e.k === "heat") { f.heat = t + 240; if (choice === "water") f.water = t + 240; }
  if (e.k === "vip") s.rots.push({ id: "vip-" + e.id, num: "VIP" + (10 + (e.at % 80)), al: "", city: "Private jet", arr: t + 30, dep: t + 120, pax: 8, ph: "sched", t0: 0, delay: 0, vip: true });
  if (e.k === "divert" && choice === "accept") s.rots.push({ id: "div-" + e.id, num: "DIV" + (100 + (e.at % 800)), al: (REGION_ALS[s.region] || ["FR"])[e.at % 5], city: "Diverted flight", arr: t + 20, dep: t + 95, pax: 150, ph: "sched", t0: 0, delay: 0, div: true });
  s.flags.fx = f; return s; }
export function answer(s0: Save, id: string, choice: string): Save { const s: Save = { ...s0, rots: s0.rots.map(x => ({ ...x })), evs: s0.evs.map(e => ({ ...e })), today: { ...s0.today }, flags: { ...s0.flags, fx: { ...fxFlag(s0) } } }; const e = s.evs.find(x => x.id === id); if (e && !e.done) resolve(s, e, choice); return s; }

export function endDay(s: Save, fx: FX[] = []): { s: Save; fx: FX[] } {
  const t = s.today; const flights = t.ot + t.late; const ontime = flights ? Math.round(t.ot / flights * 100) : 100; const mood = t.moodN ? Math.round(t.moodSum / t.moodN) : Math.round(s.mood);
  const wages = wagesOf(s), upkeep = upkeepOf(s), interest = Math.round(s.loan * 0.01); const rev = t.fees + t.shops + t.parking; const cost = wages + upkeep + interest - t.other;
  s.money -= wages + upkeep + interest; const profit = rev - cost;
  // reputation
  s.rep = Math.max(0, Math.min(100, s.rep + (mood - 60) / 8 + (ontime - 80) / 10 - t.cxl * 1.5 - Math.min(6, t.lost * 0.15) + (flights ? 0.5 : -2)));
  // contracts: demands, strikes, renewals
  const left: Contract[] = []; for (const c0 of s.contracts) { const c = { ...c0 }; const ot = c.ot && c.ot[1] ? c.ot[0] / c.ot[1] * 100 : 100; c.ot = undefined;
    if ((c.demand.ontime && ot < c.demand.ontime) || meets(s, c).length) { c.strikes++; fx.push({ k: "bad", txt: `${c.al} unhappy (${c.strikes}/3)` }); }
    c.left--; if (c.strikes >= 3) { s.rep = Math.max(0, s.rep - 6); fx.push({ k: "bad", txt: `${c.al} ended its contract` }); continue; }
    if (c.left <= 0) { s.money += 2000; c.left = c.days; c.strikes = 0; fx.push({ k: "cash", txt: `${c.al} renewed (+£2,000)` }); } left.push(c); }
  s.contracts = left;
  // research
  if (s.rsch) { s.rsch = { ...s.rsch, left: s.rsch.left - 1 }; if (s.rsch.left <= 0) { s.research = { ...s.research, [s.rsch.id]: 1 }; fx.push({ k: "level", txt: "Upgrade ready: " + (RESEARCH.find(x => x.id === s.rsch!.id)?.n || "") }); s.rsch = null; } }
  // offers
  const r = rng(s.seed + s.day * 104729); s.offers = s.offers.filter((_, i) => i < 2); const nOff = 1 + (r() < 0.5 ? 1 : 0); for (let i = 0; i < nOff && s.offers.length < 4; i++) s.offers.push(makeOffer(s, r));
  const day: DayLog = { d: s.day, flights, pax: t.pax, ontime, cxl: t.cxl, rev, cost, profit, cash: s.money, mood, lost: t.lost, fees: t.fees, shops: t.shops, parking: t.parking, wages, upkeep, interest };
  s.hist = [...s.hist, day].slice(-30); s.reviews = makeReviews(s, day, r).concat(s.reviews).slice(0, 12);
  // level up (best day so far vs thresholds)
  const best = Math.max(...s.hist.map(h => h.pax)); let lv = s.level; while (lv < LEVELS.length && best >= LEVELS[lv].pax && stars(s) >= LEVELS[lv].stars) lv++; if (lv > s.level) { s.level = lv; fx.push({ k: "level", txt: `Level up: ${LEVELS[lv - 1].n}!` }); }
  s.missions = s.missions.map(m => { if (m.done) return m; const d = MISSIONS.find(x => x.id === m.id); if (d?.ok(s)) { s.money += m.reward; fx.push({ k: "mission", txt: `Goal done: ${m.n} (+£${m.reward.toLocaleString("en-GB")})` }); return { ...m, done: true }; } return m; });
  s.missions = refillMissions(s);
  for (const a of ACH) if (!s.ach.includes(a.id) && a.ok(s)) { s.ach = [...s.ach, a.id]; fx.push({ k: "ach", txt: `${a.e} ${a.n}` }); }
  s.day++; s.phase = "summary"; s.best = Math.max(s.best || 0, Math.round(s.rep)); return { s, fx }; }
export function refillMissions(s: Save): Mission[] { const keep = s.missions.filter(m => !m.done); const doneIds = new Set([...(s.flags.mdone || []), ...s.missions.filter(m => m.done).map(m => m.id)]); s.flags.mdone = [...doneIds];
  for (const m of MISSIONS) { if (keep.length >= 3) break; if (!doneIds.has(m.id) && !keep.some(k => k.id === m.id)) keep.push({ id: m.id, n: m.n, reward: m.reward }); } return keep; }
const REV = { good: ["Smooth from car park to gate. Will fly from here again!", "Security took five minutes. Brilliant.", "Lovely café and we left on time."], queue: ["The security queue snaked round the hall.", "Missed duty free because of the queue."], late: ["Delayed again, nobody told us why.", "Sat on the plane waiting for a stand."], remote: ["Bus to the plane in the rain. Build some jet bridges!"], shops: ["Nothing to eat or buy airside.", "Not even a coffee shop."], lost: ["My suitcase went on holiday without me."], cxl: ["Our flight was cancelled. Not impressed."] };
function makeReviews(s: Save, d: DayLog, r: () => number) { const pick = (a: string[]) => a[Math.floor(r() * a.length)]; const out: { t: string; s: number }[] = [];
  if (d.mood >= 70 && d.ontime >= 85) out.push({ t: pick(REV.good), s: 5 }); if (d.ontime < 75 && d.flights) out.push({ t: pick(REV.late), s: 2 }); if (d.cxl) out.push({ t: pick(REV.cxl), s: 1 });
  if (!s.grid.includes("sh") && !s.grid.includes("fd")) out.push({ t: pick(REV.shops), s: 2 }); if (s.today.lost > 0) out.push({ t: pick(REV.lost), s: 1 });
  if (count(s.grid, "st") > count(s.grid, "gt") * 2 && s.level >= 2) out.push({ t: pick(REV.remote), s: 3 }); if (!out.length) out.push({ t: pick(REV.good), s: 4 }); return out.slice(0, 3).map(x => ({ ...x, t: `Day ${d.d}: ${x.t}` })); }

// ---------- actions ----------
export function build(s: Save, i: number, k: Tile): Save | string { const e = canBuild(s, i, k); if (e) return e; const g = s.grid.slice(); g[i] = k; return { ...s, grid: g, money: s.money - bdef(k)!.cost }; }
export function buildRunway(s: Save, y: number): Save | string { const e = canRunway(s, y); if (e) return e; const c = runwayCost(s, y); const g = s.grid.slice(); for (let x = 0; x < W; x++) g[y * W + x] = "rw"; return { ...s, grid: g, money: s.money - c }; }
export function bulldoze(s: Save, i: number): Save | string { const t = s.grid[i]; if (t === "g") return "Nothing to remove"; if (t === "rw") return "Runways can't be removed";
  if (isStand(t) && s.rots.some(x => x.stand === i && !["gone", "cxl", "sched"].includes(x.ph))) return "A plane is using this stand"; const g = s.grid.slice(); g[i] = "g"; const back = Math.round((bdef(t)?.cost || 0) * 0.3); return { ...s, grid: g, money: s.money + back, rots: s.rots.map(x => x.stand === i ? { ...x, stand: undefined } : x) }; }
export const hire = (s: Save, k: keyof Staff, d: 1 | -1): Save => ({ ...s, staff: { ...s.staff, [k]: Math.max(0, Math.min(40, s.staff[k] + d)) } });
export function sign(s: Save, id: string): Save | string { const c = s.offers.find(o => o.id === id); if (!c) return "Offer gone"; const m = meets(s, c); if (m.length) return "They want: " + m.join(", "); return { ...s, offers: s.offers.filter(o => o.id !== id), contracts: [...s.contracts, { ...c, left: c.days }] }; }
export const decline = (s: Save, id: string): Save => ({ ...s, offers: s.offers.filter(o => o.id !== id) });
export const dropContract = (s: Save, id: string): Save => ({ ...s, contracts: s.contracts.filter(c => c.id !== id), rep: Math.max(0, s.rep - 3) });
export function research(s: Save, id: string): Save | string { const x = RESEARCH.find(r => r.id === id); if (!x) return "Unknown"; if (s.research[id]) return "Already done"; if (s.rsch) return "Already researching something"; if (x.need && !s.research[x.need]) return "Finish " + RESEARCH.find(r => r.id === x.need)?.n + " first"; if (s.money < x.cost) return "Not enough money"; return { ...s, money: s.money - x.cost, rsch: { id, left: x.days } }; }
export function borrow(s: Save, amt: number): Save | string { if (s.loan + amt > loanMax(s)) return `Bank limit is £${loanMax(s).toLocaleString("en-GB")} at this level`; return { ...s, loan: s.loan + amt, money: s.money + amt }; }
export function repay(s: Save, amt: number): Save | string { const a = Math.min(amt, s.loan); if (a <= 0) return "No loan"; if (s.money < a) return "Not enough money"; const n = { ...s, loan: s.loan - a, money: s.money - a }; if (n.loan === 0) n.flags = { ...n.flags, repaid: 1 }; return n; }
/** First day setup: two starter contracts + offers + goals. */
export function openAirport(s: Save): Save { const r = rng(s.seed); const n: Save = { ...s, stage: "play", phase: "summary" }; const a = makeOffer(n, r); n.contracts = [{ ...a, perDay: 3, demand: {}, left: a.days }];
  const b = makeOffer(n, r); n.contracts.push({ ...b, perDay: 3, demand: {}, left: b.days }); n.offers = [makeOffer(n, r), makeOffer(n, r)]; n.missions = refillMissions(n); return n; }
/** Migrate a v1 save (simple gates game) into v2, keeping the setup choices. */
export function migrate(v1: any): Save { const s = freshSave(); for (const k of ["name", "code", "region", "op", "look", "gstyle", "term", "board", "step"] as const) if (v1?.[k] != null) (s as any)[k] = v1[k]; if (v1?.stage === "play") return openAirport(s); return s; }

/** Stand label: jet-bridge gates A1, A2… and remote stands R1, R2… in map order. */
export function standName(g: Tile[], i: number) { if (g[i] === "gt") return "A" + (g.slice(0, i).filter(t => t === "gt").length + 1); if (g[i] === "st") return "R" + (g.slice(0, i).filter(t => t === "st").length + 1); return "?"; }
export const qWait = (s: Save) => { const r = secRate(s) / 60; return r > 0 ? Math.round(s.q / r) : s.q > 0 ? 99 : 0; };
export const nextLevel = (s: Save) => LEVELS[s.level] || null;
export const PH_LABEL: Record<Ph, string> = { sched: "Scheduled", app: "Approaching", hold: "Holding: needs a stand", land: "Landing", taxiIn: "Taxiing in", park: "At stand", push: "Pushback", taxiOut: "Taxiing out", tkof: "Taking off", gone: "Departed", cxl: "Cancelled" };
