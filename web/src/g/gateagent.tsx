// Gate Agent Rush: you're the gate agent for a full A321-sized flight. Call the boarding groups, keep the line moving and sort out
// the funny problem passengers before the take-off slot is lost. Made-up passengers and rules for the game.
import { useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, End, sfx, pick } from "./kit";

type Case = { late?: boolean; face: string; who: string; say: string; opts: [string, number, string][] }; // option text, time cost (s; negative = good), outcome
const CASES: Case[] = [
  { face: "🧳", who: "Bag the size of a fridge", say: "“It's definitely cabin size. It squishes!”", opts: [["Gate-check it to the hold", 2, "Tagged and sent down. Smart."], ["Let them try the sizer", 8, "It did not squish. 8 seconds lost."], ["Wave them on", 10, "Overhead bins full. Crew not amused."]] },
  { face: "🦩", who: "Inflatable flamingo", say: "“Her name is Linda. She needs her own seat.”", opts: [["Deflate Linda, kindly", 2, "Linda rests in the overhead bin."], ["Sell Linda a seat", 6, "Paperwork took ages."], ["Refuse boarding", 9, "Tears. Supervisor called."]] },
  { face: "🏃", who: "Group 5, standing at the front", say: "“I was told it's my turn.” (They're group 5. You're calling group 2.)", opts: [["Politely ask them to wait", 1, "Back to the queue, with a smile."], ["Let them board", 5, "Now everyone in groups 3–5 is pushing forward."]] },
  { face: "📱", who: "On a loud video call", say: "“…and THEN the gate agent…” (Boarding pass not ready.)", opts: [["Ask for the pass, hold the line", 3, "Found it in the 14th screenshot."], ["Scan the phone while they talk", 1, "Beep! Clever."]] },
  { face: "🐶", who: "Dog in a carrier", say: "“He's a very small large dog.”", opts: [["Check the pet booking", 2, "All booked. Good boy boards."], ["Board without checking", 7, "No booking! Rebooked on the next flight."]] },
  { face: "🛂", who: "Wrong gate", say: "“Is this the flight to Oslo?” (Your flight goes to Malaga.)", opts: [["Send them to the right gate", 1, "They sprint off happily."], ["Scan their pass anyway", 8, "The system beeps red. Oops."]] },
  { face: "👑", who: "‘VIP’ (not on the list)", say: "“Do you know who I am?”", opts: [["Smile: ‘Welcome, group 4 is next!’", 1, "Defeated by kindness."], ["Upgrade them to stop the fuss", 6, "Now three more people want upgrades."]] },
  { face: "🍕", who: "Whole pizza, unboxed", say: "“It's my in-flight meal.”", opts: [["Offer a box from the café", 3, "Pizza secured. Cabin smells great."], ["It's fine, let them on", 2, "Cheese everywhere. But fine."]] },
  { face: "🧒", who: "Kid with a toy plane", say: "“Can I meet the pilot?”", opts: [["Ask the crew at the door", 2, "The captain waves. Best day ever."], ["Not now, sorry", 1, "Fair enough. Off they go."]] },
  { late: true, face: "😴", who: "Asleep across 4 seats", say: "Final call… one passenger snoozing by the window.", opts: [["Gently wake them", 2, "Startled, but boarded."], ["Announce their name loudly", 1, "Everyone looks. They board in record time."], ["Leave them", 12, "Bag offload needed later. Huge delay."]] },
  { face: "🎸", who: "Guitar case", say: "“It can't go in the hold, it's vintage!”", opts: [["Check if there's bin space", 3, "Fits in the last bin. Phew."], ["Gate-check it", 2, "Fragile sticker added. OK."]] },
  { late: true, face: "🏃‍♀️", who: "Late runner", say: "Running down the corridor, waving a pass.", opts: [["Hold the door 20 seconds", 4, "Made it. Everyone cheers."], ["Close the door", 7, "Too late, sorry! Now their bag must be offloaded…"]] },
];
const SEATS = 190, SLOT = 100; // passengers on this game flight; seconds until the slot
type St = { t: number; boarded: number; called: number; jam: number; card: Case | null; next: number; log: { t: string; k: string }[]; extra: number; done?: string; pts?: number };
export default function GateAgent() {
  const [best, report] = useBest("gateagent"); const S = useRef<St | null>(null); const [, setUi] = useState(0); const [nb, setNb] = useState(false); const [run, setRun] = useState(false); const tu = useRef(0);
  const start = () => { S.current = { t: 0, boarded: 0, called: 1, jam: 0, card: null, next: 4, log: [], extra: 0 }; setRun(true); setNb(false); sfx.chime(); };
  const end = (txt: string, pts: number) => { const s = S.current!; if (s.done) return; s.done = txt; s.pts = Math.max(0, Math.round(pts)); setRun(false); setNb(s.pts > 0 && report(s.pts)); (pts > 600 ? sfx.win : sfx.bad)(); };
  useLoop(dt => { const s = S.current; if (!s || s.done) return; s.t += dt;
    const avail = Math.min(SEATS, Math.round(s.called * SEATS / 5)); const rate = s.card ? 0 : 3.4 * (1 - Math.min(.6, s.jam)); s.jam = Math.max(0, s.jam - dt * .08);
    s.boarded = Math.min(avail, s.boarded + rate * dt); if (s.called < 5 && s.boarded >= avail - 2 && !s.card) s.jam += dt * .02; // waiting for you to call the next group
    if (!s.card && s.t >= s.next && s.boarded < SEATS - 4) { s.card = pick(CASES.filter(c => !c.late || s.boarded > SEATS * .7)); sfx.alert(); }
    if (s.boarded >= SEATS - .5) { const left = SLOT + s.extra - s.t; end(left >= 0 ? `Doors closed with ${Math.round(left)} s to spare. Slot made! ✈️` : "Everyone's on, but the slot was gone. Next slot in 40 minutes…", left >= 0 ? 600 + left * 12 : 300); }
    else if (s.t > SLOT + s.extra + 25) end(`Slot lost with ${SEATS - Math.floor(s.boarded)} passengers still at the gate.`, s.boarded * 1.5);
    if (s.t - tu.current > .15) { tu.current = s.t; setUi(u => u + 1); } }, run);
  const s = S.current; const left = s ? Math.max(0, Math.ceil(SLOT + s.extra - s.t)) : SLOT;
  const choose = (o: [string, number, string]) => { if (!s) return; s.t += o[1]; s.log = [{ t: o[2], k: o[1] <= 2 ? "ok" : "bad" }, ...s.log].slice(0, 3); s.card = null; s.next = s.t + 3 + Math.random() * 5; (o[1] <= 2 ? sfx.cash : sfx.bad)(); setUi(u => u + 1); };
  const call = () => { if (!s || s.called >= 5) return; const early = s.boarded < Math.round(s.called * SEATS / 5) - 20; s.called++; if (early) { s.jam += .35; s.log = [{ t: "Called too early: the queue jams up!", k: "bad" }, ...s.log].slice(0, 3); sfx.bad(); } else sfx.click(); setUi(u => u + 1); };
  return <div className="g4">
    {s && <><div className="g4-hud"><span>🕐 Slot in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span><span>🧍 {Math.floor(s.boarded)}/{SEATS}</span><span>Group {s.called}/5</span>{s.jam > .25 && <span className="warn">Queue jam!</span>}</div>
      <div className="g4-bar"><i style={{ width: `${s.boarded / SEATS * 100}%` }} /></div></>}
    {run && s ? <>{s.card ? <div className="g4-card"><div className="g4-pax"><span className="g4-face">{s.card.face}</span><div><b>{s.card.who}</b><p>{s.card.say}</p></div></div><div className="g4-opts">{s.card.opts.map(o => <button key={o[0]} onClick={() => choose(o)}>{o[0]}</button>)}</div></div>
        : <div className="g4-card"><div className="g4-bp"><span><small>FLIGHT</small>SKY 321</span><span><small>TO</small>Malaga</span><span><small>GATE</small>12</span><span><small>SEATS</small>{SEATS}</span></div><p className="g4-intro">Passengers are boarding… call the next group when the line gets short.</p><div className="g4-queue" aria-hidden="true">{Array.from({ length: Math.min(14, Math.max(0, Math.round(Math.min(SEATS, s.called * SEATS / 5) - s.boarded) / 3)) }, (_, k) => <i key={k} style={{ animationDelay: k * .12 + "s" }}>{["🧍", "🧍‍♀️", "🧑‍🦱", "👩‍🦰", "🧔", "👵"][k % 6]}</i>)}<span>✈︎</span></div></div>}
      <button className="gp-btn pri" disabled={s.called >= 5} onClick={call}>📣 Call group {Math.min(5, s.called + 1)}</button>
      <ul className="g4-log">{s.log.map((l, k) => <li key={k} className={l.k}>{l.t}</li>)}</ul></>
      : <End big={s?.pts} unit={s ? "points" : undefined} nb={nb} msg={s?.done || `You're the gate agent. ${SEATS} passengers, one take-off slot. Call the 5 boarding groups at the right time (too early jams the queue) and sort out the problem passengers fast. Each wrong choice costs seconds.`}>{best != null && <p className="sm muted">Best {best}</p>}<button className="gp-btn pri" onClick={start}>{s ? "Next flight" : "Open the gate"}</button></End>}</div>;
}
