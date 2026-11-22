// Disaster Day: a pure, seeded turn-based sim of one terrible day at a Manchester-style airport (fan-made; all numbers are game numbers).
export type Wx = "clear" | "rain" | "storm" | "snow" | "blizzard" | "fog";
export type EvK = "strike" | "thunder" | "crosswind" | "snowfall" | "power" | "fuel" | "deice" | "crowd" | "bird" | "medical";
export type Turn = { wx: Wx; xw: number; xw05: number; snow: number; evs: EvK[] };
export type Lv = { k: string; n: string; sub: string; e: string; turns: Turn[]; money: number };
const T = (wx: Wx, xw: number, xw05: number, snow: number, ...evs: EvK[]): Turn => ({ wx, xw, xw05, snow, evs });
export const LEVELS: Lv[] = [
  { k: "amber", n: "Amber warning", e: "🟠", sub: "A windy, stormy day and a security strike.", money: 120000, turns: [T("rain", 12, 10, 0, "crowd"), T("rain", 22, 14, 0, "strike"), T("storm", 34, 16, 0, "crosswind"), T("storm", 30, 12, 0, "thunder"), T("rain", 26, 10, 0, "bird"), T("rain", 18, 9, 0, "fuel"), T("clear", 12, 8, 0, "medical"), T("clear", 8, 6, 0)] },
  { k: "red", n: "Red warning", e: "🔴", sub: "Snow all day, a strike and a power cut.", money: 200000, turns: [T("snow", 10, 8, 3, "snowfall"), T("blizzard", 18, 12, 6, "strike"), T("snow", 14, 10, 4, "deice"), T("snow", 12, 8, 3, "power"), T("blizzard", 22, 14, 6, "snowfall", "crowd"), T("snow", 12, 10, 2, "fuel"), T("fog", 6, 4, 0, "medical"), T("snow", 8, 6, 2, "bird")] },
  { k: "perfect", n: "Perfect storm", e: "🌪️", sub: "Everything goes wrong. Can you keep Manchester-style moving?", money: 220000, turns: [T("storm", 28, 12, 0, "thunder", "crowd"), T("storm", 36, 14, 0, "crosswind", "strike"), T("snow", 20, 10, 4, "snowfall", "power"), T("blizzard", 24, 16, 6, "deice", "fuel"), T("snow", 16, 10, 3, "crowd", "bird"), T("storm", 32, 12, 0, "thunder", "medical"), T("rain", 26, 14, 0, "crosswind"), T("fog", 8, 6, 0, "strike")] },
];
export type Choice = { k: string; t: string; cost: number; risky?: boolean };
export const EVS: Record<EvK, { n: string; e: string; txt: string; ch: Choice[] }> = {
  strike: { n: "Security strike", e: "✊", txt: "Security officers walk out over pay. Without them, queues explode.", ch: [{ k: "pay", t: "Pay a bonus: everyone comes back", cost: 35000 }, { k: "vol", t: "Managers and trained volunteers cover some lanes", cost: 8000 }, { k: "no", t: "Refuse: half the lanes close", cost: 0 }] },
  thunder: { n: "Lightning nearby", e: "⚡", txt: "Lightning within 5 miles. Ground crews outside could be in danger.", ch: [{ k: "pause", t: "Stop outside work until it passes (safe, slower)", cost: 0 }, { k: "go", t: "Keep the ramp working", cost: 0, risky: true }] },
  crosswind: { n: "Strong crosswind", e: "🌬️", txt: "Gusts are blowing hard across runway 23. Planes are struggling to land.", ch: [{ k: "switch", t: "Switch to runway 05 (20 min to change over)", cost: 0 }, { k: "hold", t: "Hold arrivals until the gusts ease", cost: 0 }, { k: "keep", t: "Keep going on 23: expect go-arounds", cost: 0, risky: true }] },
  snowfall: { n: "Heavy snow", e: "❄️", txt: "Snow is settling fast on the runway. Braking is getting poor.", ch: [{ k: "plough", t: "Close the runway and plough now (30 min)", cost: 6000 }, { k: "later", t: "Keep flying and plough later", cost: 0, risky: true }] },
  power: { n: "Power cut", e: "🔌", txt: "The terminal loses power: check-in desks and bag belts stop.", ch: [{ k: "gen", t: "Hire emergency generators", cost: 15000 }, { k: "manual", t: "Manual check-in with pens and paper (slow)", cost: 0 }] },
  fuel: { n: "Fuel trucks stuck", e: "⛽", txt: "The fuel trucks are stuck in traffic. Planes can't refuel.", ch: [{ k: "borrow", t: "Borrow trucks from a neighbour airport", cost: 20000 }, { k: "tanker", t: "Ask airlines to bring extra fuel in (fewer delays later)", cost: 0 }, { k: "wait", t: "Wait for the trucks", cost: 0 }] },
  deice: { n: "De-icing fluid low", e: "🧴", txt: "The de-icing fluid tanks are nearly empty.", ch: [{ k: "buy", t: "Buy emergency fluid", cost: 22000 }, { k: "ration", t: "Ration it: de-ice fewer planes (slower)", cost: 0 }, { k: "skip", t: "Skip de-icing on light frost", cost: 0, risky: true }] },
  crowd: { n: "Terminal packed", e: "🧳", txt: "Thousands of delayed passengers are filling the terminal.", ch: [{ k: "zone", t: "Open a free snack & water zone", cost: 10000 }, { k: "info", t: "Send staff with phones to rebook people", cost: 4000 }, { k: "none", t: "Do nothing", cost: 0 }] },
  bird: { n: "Birds on the runway", e: "🐦", txt: "A big flock of gulls is sitting on the runway.", ch: [{ k: "team", t: "Send the bird-control team (runway closed 10 min)", cost: 1500 }, { k: "ignore", t: "Ignore them", cost: 0, risky: true }] },
  medical: { n: "Medical emergency", e: "🚑", txt: "An arriving flight has a very poorly passenger and asks for priority.", ch: [{ k: "prio", t: "Give it priority and send paramedics", cost: 2000 }, { k: "queue", t: "Make it wait its turn", cost: 0, risky: true }] },
};
export type Orders = { plough: boolean; deicers: boolean; overtime: boolean; snacks: boolean; cancel: boolean };
export type Res = { turn: number; landed: number; departed: number; div: number; cxl: number; incident?: string; cap: number; moodD: number; notes: string[] };
export type S = { lv: number; turn: number; money: number; mood: number; snow: number; rw: "23" | "05"; lanes: number; backDep: number; holdArr: number; moved: number; cxl: number; div: number; incidents: number; seed: number; ans: Record<string, string>; orders: Orders; hist: Res[]; tanker: number; done?: boolean };
export const TURNS = 8, DEM = 22, LANES = 8, BASECAP = 46;
const rnd = (s: S) => { let a = (s.seed += 0x6d2b79f5) | 0; a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; };
export const ORD: Record<keyof Orders, { n: string; e: string; cost: number; txt: string }> = {
  plough: { n: "Plough the runway", e: "🚜", cost: 5000, txt: "Clears snow; runway shut for 30 min" }, deicers: { n: "Extra de-icing rigs", e: "🧴", cost: 12000, txt: "+2 de-icing rigs this slot" },
  overtime: { n: "Overtime for staff", e: "👷", cost: 9000, txt: "+2 security lanes this slot" }, snacks: { n: "Free snacks & water", e: "🥪", cost: 6000, txt: "Happier passengers" }, cancel: { n: "Cancel short flights early", e: "✂️", cost: 0, txt: "Fewer movements, but no long queues" },
};
const NO: Orders = { plough: false, deicers: false, overtime: false, snacks: false, cancel: false };
export function newDay(lv: number, seed = (Math.random() * 1e9) | 0): S { return { lv, turn: 0, money: LEVELS[lv].money, mood: 70, snow: 0, rw: "23", lanes: LANES, backDep: 0, holdArr: 0, moved: 0, cxl: 0, div: 0, incidents: 0, seed, ans: {}, orders: { ...NO }, hist: [EMPTY] .slice(1), tanker: 0 }; }
const EMPTY: Res = { turn: -1, landed: 0, departed: 0, div: 0, cxl: 0, cap: 0, moodD: 0, notes: [] };
export const cur = (s: S) => LEVELS[s.lv].turns[Math.min(s.turn, TURNS - 1)];
export const xwNow = (s: S) => (s.rw === "23" ? cur(s).xw : cur(s).xw05);
export const pendingEvs = (s: S) => (s.done ? [] : cur(s).evs.filter(e => !s.ans[s.turn + e]));
export const ordersCost = (o: Orders) => (Object.keys(o) as (keyof Orders)[]).reduce((t, k) => t + (o[k] ? ORD[k].cost : 0), 0);
export function answer(s: S, ev: EvK, k: string): string | null { const c = EVS[ev].ch.find(x => x.k === k); if (!c) return "?"; if (s.money < c.cost) return "Not enough budget"; s.money -= c.cost; s.ans[s.turn + ev] = k; if (ev === "crosswind" && k === "switch") s.rw = s.rw === "23" ? "05" : "23"; if (ev === "fuel" && k === "tanker") s.tanker = 2; return null; }
/** Play the 2-hour slot. */
export function play(s: S): Res | string {
  if (s.done) return "Day over"; if (pendingEvs(s).length) return "Decide on every problem first"; const oc = ordersCost(s.orders); if (s.money < oc) return "Not enough budget for those orders"; s.money -= oc;
  const t = cur(s); const a = (e: EvK) => s.ans[s.turn + e]; const o = s.orders; const notes: string[] = []; let cap = BASECAP; let depMul = 1, arrMul = 1; let mood = 0; let incident: string | undefined;
  s.snow += t.snow; if (o.plough || a("snowfall") === "plough") { cap *= .75; notes.push("🚜 Runway ploughed: snow cleared"); s.snow = Math.max(0, s.snow - 99); }
  if (s.snow > 2) { const f = Math.max(.35, 1 - s.snow / 24); cap *= f; notes.push(`❄️ ${s.snow} cm of snow on the runway: slower, careful flying`); if (s.snow >= 6 && rnd(s) < s.snow / 30) incident = "A plane slid off the runway onto the snowy grass while braking. Nobody was hurt, but the runway closed while it was towed out."; }
  const snowy = t.wx === "snow" || t.wx === "blizzard"; if (snowy) { let rigs = 4 + (o.deicers ? 2 : 0); if (a("deice") === "ration") rigs -= 1; if (a("deice") === "buy" || !t.evs.includes("deice")) rigs += 0; const lim = rigs * 7; if (a("deice") === "skip") { if (rnd(s) < .35) incident = incident || "A plane took off with ice on its wings and had to come straight back. Everyone was fine, but it was a scary moment."; } else if (DEM + s.backDep > lim) { depMul = Math.min(depMul, lim / (DEM + s.backDep)); notes.push(`🧴 De-icing can only handle ${lim} departures`); } }
  if (t.wx === "fog") { cap *= .7; notes.push("🌫️ Fog: low-visibility procedures"); } if (t.wx === "storm") { cap *= .85; }
  const xw = xwNow(s); if (a("crosswind") === "switch") { cap *= .85; notes.push("🔄 Changed to runway 05: crosswind now " + t.xw05 + " kt"); }
  if (a("crosswind") === "hold") { arrMul *= .45; notes.push("⏸ Arrivals held in the stacks"); }
  if (xw >= 30) { const g = Math.min(.7, (xw - 26) / 16); arrMul *= 1 - g; notes.push(`🌬️ ${xw} kt crosswind: go-arounds and diversions`); if (a("crosswind") === "keep" && xw >= 33 && rnd(s) < .3) incident = incident || "A plane landed very hard in the gusts. Safe, but it needs an engineering check."; }
  if (a("thunder") === "pause") { cap *= .65; notes.push("⚡ Ramp paused for lightning: safe!"); } else if (a("thunder") === "go") { if (rnd(s) < .4) incident = incident || "Lightning struck close to ramp workers. Nobody was hurt, but it was far too close."; }
  let lanes = LANES; const st = a("strike") || (s.turn > 0 && s.ans["strike-cont"]); if (st === "vol") lanes = 5; if (st === "no") lanes = 4; if (o.overtime) lanes += 2; lanes = Math.min(LANES, lanes); s.lanes = lanes; if (lanes < 6) { depMul *= lanes / 6; mood -= (6 - lanes) * 3; notes.push(`🛂 Only ${lanes} security lanes: people miss flights`); }
  if (a("strike")) s.ans["strike-cont"] = a("strike") === "pay" ? "" : a("strike");
  if (a("power") === "manual") { depMul *= .6; mood -= 8; notes.push("🔌 Manual check-in: very slow"); } else if (a("power") === "gen") notes.push("🔌 Generators running");
  if (a("fuel") === "wait") { depMul *= .65; notes.push("⛽ Planes waiting for fuel"); } if (a("fuel") === "tanker") depMul *= .9; if (s.tanker > 0) s.tanker--;
  if (a("bird") === "team") cap *= .93; else if (a("bird") === "ignore" && rnd(s) < .45) incident = incident || "A plane hit gulls on take-off and had to return. Safe landing, but the engine needs checking.";
  if (a("medical") === "queue") { mood -= 15; incident = incident || "The poorly passenger waited 40 minutes in the air. They're OK, but the airline is furious."; } if (a("medical") === "prio") { mood += 3; notes.push("🚑 Priority landing: the passenger is safe in hospital"); }
  if (a("crowd") === "zone") mood += 10; if (a("crowd") === "info") mood += 6; if (a("crowd") === "none") mood -= 10; if (o.snacks) mood += 6;
  if (incident) { cap *= .6; s.incidents++; mood -= 8; }
  // demand vs capacity
  let dDem = DEM + s.backDep, aDem = DEM + s.holdArr; if (o.cancel) { const c = Math.round(DEM * .3); dDem -= c; aDem -= c; s.cxl += c * 2; mood -= 4; notes.push(`✂️ ${c * 2} short flights cancelled in advance`); }
  const aCap = cap * .5 * arrMul, dCap = cap * .5 * depMul; const landed = Math.round(Math.min(aDem, aCap + Math.max(0, dCap - dDem) * arrMul)); const departed = Math.round(Math.min(dDem, dCap + Math.max(0, aCap - aDem) * depMul));
  s.holdArr = aDem - landed; let div = 0, cxl = 0; if (s.holdArr > 10) { div = s.holdArr - 10; s.holdArr = 10; } s.backDep = dDem - departed; if (s.backDep > 24) { cxl = s.backDep - 24; s.backDep = 24; }
  s.div += div; s.cxl += cxl; s.moved += landed + departed; const ratio = (landed + departed) / (DEM * 2); mood += (ratio - .8) * 25 - cxl * .6 - div * .4 - s.backDep * .12; s.mood = Math.max(0, Math.min(100, s.mood + mood));
  if (div) notes.push(`↪️ ${div} arrivals diverted to other airports`); if (cxl) notes.push(`❌ ${cxl} departures cancelled`);
  const r: Res = { turn: s.turn, landed, departed, div, cxl, incident, cap: Math.round(cap), moodD: Math.round(mood), notes }; s.hist.push(r); s.orders = { ...NO }; s.turn++; if (s.turn >= TURNS) s.done = true; return r; }
export const score = (s: S) => Math.max(0, Math.round(s.moved * 10 - s.cxl * 12 - s.div * 18 - s.incidents * 300 + s.mood * 8 + s.money / 1000));
export const grade = (s: S) => { const m = [1, .85, .75][s.lv] ?? 1; const sc = score(s) / m; return sc >= 3600 ? "A*" : sc >= 3100 ? "A" : sc >= 2600 ? "B" : sc >= 2000 ? "C" : sc >= 1400 ? "D" : "E"; };
export const slotName = (t: number) => `${String(6 + t * 2).padStart(2, "0")}:00–${String(8 + t * 2).padStart(2, "0")}:00`;
