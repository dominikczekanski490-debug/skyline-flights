// Airport Builder 3D: a sandbox with infinite money. Build runways, terminals and everything outside, then walk inside a terminal and fit it out
// on two floors. three.js loads only when the builder opens, and everything (including the WebGL context) is released on exit.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CATALOG, cat, place, edit, remove, duplicate, encode, decode, starter, blank, counts, fromManager, dims, termOf, listOf, snap, snapOf, LIVS, COLS, TERM_STYLES, FLOORS, CAP, type Save, type Ctx, type It } from "./sbcore";
import { sfx } from "./kit";
import { myLivery } from "./myair";
import type { Engine, Mode } from "./sb3d";

const SLOT = (n: number) => "sk.games.sb.slot" + n, CUR = "sk.games.sb.cur";
const readSlot = (n: number) => decode(localStorage.getItem(SLOT(n)));
const writeSlot = (n: number, s: Save) => { try { localStorage.setItem(SLOT(n), encode(s)); localStorage.setItem(CUR, String(n)); return true; } catch { return false; } };
function managerSave(): Save | null { try { const n = Number(localStorage.getItem("sk.games.mgr.v2.cur") || 1) || 1; const j = JSON.parse(localStorage.getItem("sk.games.mgr.v2.slot" + n) || "null"); return j?.grid ? fromManager(j.grid, j.name || "My airport") : null; } catch { return null; } }

export default function AirportBuilder() {
  const [, re] = useState(0); const [open, setOpen] = useState<{ n: number; s: Save } | null>(null); const [name, setName] = useState("");
  const cur = Number(localStorage.getItem(CUR) || 1) || 1;
  const start = (n: number, s: Save) => { if (name.trim()) s = { ...s, name: name.trim().slice(0, 40) }; writeSlot(n, s); setOpen({ n, s }); sfx.whoosh(); };
  if (open) return <><p className="g4-intro">Building <b>{open.s.name}</b>…</p><Builder slot={open.n} init={open.s} close={() => { setOpen(null); re(v => v + 1); }} /></>;
  const mgr = managerSave();
  return <div className="g4 sb-home"><p className="g4-intro">Build your own airport in 3D with <b>infinite money</b>. Runways, terminals, jet bridges, planes and more outside, then go <b>inside</b> a terminal and add check-in, security, gates, shops and your own departure boards, on two floors. Walk around in first person, and switch on <b>Simulate</b> to watch it come to life.</p>
    <label className="sb-name">Airport name<input value={name} maxLength={40} placeholder="e.g. Dominik International" onChange={e => setName(e.target.value)} /></label>
    <div className="sb-slots">{[1, 2, 3].map(n => { const s = readSlot(n); const c = s && counts(s); return <div key={n} className={"sb-slot" + (n === cur && s ? " on" : "")}><div><b>Slot {n}{s ? `: ${s.name}` : ""}</b><small>{s ? `${c!.out} things outside · ${c!.in} inside` : "Empty"}</small></div>
      <div className="sb-slot-b">{s ? <><button className="gp-btn pri" onClick={() => start(n, name.trim() ? s : s)}>Open</button><button className="gp-btn" aria-label={`Delete slot ${n}`} onClick={() => { if (confirm("Delete this airport?")) { localStorage.removeItem(SLOT(n)); re(v => v + 1); } }}>🗑</button></>
        : <><button className="gp-btn pri" onClick={() => start(n, starter())}>Starter airport</button><button className="gp-btn" onClick={() => start(n, blank())}>Empty</button>{mgr && <button className="gp-btn" onClick={() => start(n, mgr)}>From Manager</button>}</>}</div></div>; })}</div>
    <p className="faint xs">Tip: pinch to zoom, two fingers to pan, drag to spin. Up to {CAP.out} things outside and {CAP.in} per terminal, to keep your iPhone happy. Original fan-made art, no real logos. Saved on this device.</p></div>;
}

type Hist = { u: string[]; r: string[] };
function Builder({ slot, init, close }: { slot: number; init: Save; close: () => void }) {
  const host = useRef<HTMLDivElement>(null); const E = useRef<Engine | null>(null); const [ready, setReady] = useState(false); const [err, setErr] = useState("");
  const [s, setS] = useState(init); const sRef = useRef(s); sRef.current = s; const [ctx, setCtx] = useState<Ctx>({ lay: "out" }); const H = useRef<Hist>({ u: [], r: [] });
  const [grp, setGrp] = useState(""); const [arm, setArm] = useState<{ k: string; v?: number } | null>(null); const [sel, setSel] = useState<number | null>(null); const [moving, setMoving] = useState(false); const [rot, setRot] = useState(0);
  const [mode, setModeS] = useState<Mode>("edit"); const [night, setNight] = useState(false); const [sim, setSim] = useState(false); const [shadows, setShadows] = useState(true); const [toast, setToast] = useState(""); const [vert, setVert] = useState<"up" | "down" | null>(null); const [menu, setMenu] = useState(false);
  const say = (t: string) => { setToast(t); clearTimeout((say as any).t); (say as any).t = setTimeout(() => setToast(""), 2600); };
  // engine lifecycle (three.js is lazy-loaded here)
  useEffect(() => { let dead = false; let eng: Engine | null = null; import("./sb3d").then(m => { if (dead || !host.current) return; try { eng = new m.Engine(host.current); E.current = eng; (globalThis as any).__sb = eng; eng.onFloor = f => setCtx(c => ({ ...c, floor: f })); eng.sync(sRef.current, { lay: "out" }); eng.frame(); setReady(true); } catch { setErr("3D isn't available on this device right now."); } }).catch(() => setErr("Couldn't load the 3D builder. Check your connection and try again."));
    const onR = () => E.current?.resize(); addEventListener("resize", onR); document.body.classList.add("sb-lock");
    return () => { dead = true; removeEventListener("resize", onR); document.body.classList.remove("sb-lock"); writeSlot(slot, sRef.current); eng?.dispose(); E.current = null; (globalThis as any).__sb = null; }; }, [slot]);
  useEffect(() => { const e = E.current; if (!e) return; e.sync(s, ctx); e.select(sel); }, [s, ctx, ready, sel]);
  useEffect(() => { const t = setTimeout(() => { if (!writeSlot(slot, s)) say("Couldn't save: storage is full"); }, 700); return () => clearTimeout(t); }, [s, slot]);
  useEffect(() => { const e = E.current; if (!e) return; e.setNight(night); }, [night, ready]);
  useEffect(() => { E.current?.setSim(sim); }, [sim, ready]); useEffect(() => { E.current?.setShadows(shadows); }, [shadows, ready]);
  useEffect(() => { if (mode !== "walk") { setVert(null); return; } const i = setInterval(() => setVert(E.current?.vertical() ?? null), 300); return () => clearInterval(i); }, [mode, ctx]);
  const commit = (ns: Save, msg?: string) => { H.current.u.push(encode(sRef.current)); if (H.current.u.length > 40) H.current.u.shift(); H.current.r = []; setS(ns); if (msg) say(msg); };
  const undo = () => { const u = H.current.u.pop(); if (!u) return; H.current.r.push(encode(sRef.current)); const d = decode(u)!; fixCtx(d); setS(d); sfx.click(); };
  const redo = () => { const r = H.current.r.pop(); if (!r) return; H.current.u.push(encode(sRef.current)); const d = decode(r)!; fixCtx(d); setS(d); sfx.click(); };
  const fixCtx = (d: Save) => { if (ctx.lay === "in" && !termOf(d, ctx.term)) { setCtx({ lay: "out" }); setMode("edit"); } setSel(null); };
  const list = listOf(s, ctx); const selIt = sel != null ? list.find(o => o.i === sel) : undefined;
  const setMode = (m: Mode) => { setModeS(m); E.current?.setMode(m); if (m !== "edit") { setArm(null); setSel(null); setMenu(false); } sfx.whoosh(); };
  const goIn = (t: It) => { setSim(false); setSel(null); setArm(null); setGrp(""); const c: Ctx = { lay: "in", term: t.i, floor: 0 }; setCtx(c); sfx.whoosh(); say(`Inside ${TERM_STYLES[(t.v ?? 0) % 4].toLowerCase()} terminal · floor 0`); };
  const goOut = () => { setSim(false); setSel(null); setArm(null); setGrp(""); if (mode !== "edit") { setModeS("edit"); E.current && (E.current.mode = "edit", E.current.ctl.enabled = true, E.current.cam.fov = 55, E.current.cam.updateProjectionMatrix()); } setCtx({ lay: "out" }); sfx.whoosh(); };
  const setFloor = (f: number) => { setCtx(c => ({ ...c, floor: f })); setSel(null); setTimeout(() => E.current?.frame(), 0); };
  // taps on the 3D view
  const down = useRef<{ x: number; y: number; t: number; lx: number; ly: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { down.current = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY }; };
  const onMove = (e: React.PointerEvent) => { const d = down.current; if (!d || mode === "edit") return; E.current?.look(e.clientX - d.lx, e.clientY - d.ly); d.lx = e.clientX; d.ly = e.clientY; };
  const onUp = (e: React.PointerEvent) => { const d = down.current; down.current = null; if (!d || mode !== "edit" || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return; tap(e.clientX, e.clientY); };
  const tap = (cx: number, cy: number) => { const eng = E.current; if (!eng) return; const p = eng.pick(cx, cy); const fl = ctx.lay === "in" ? (ctx.floor ?? 0) : undefined;
    if (moving && selIt && p.x != null) { const r = edit(s, ctx, selIt.i, { x: p.x, z: p.z }); if (r.err) { say(r.err); sfx.bad(); } else { commit(r.s); sfx.build(); } setMoving(false); return; }
    if (arm && p.x != null) { let x = p.x, z = p.z!, r = rot; const C = cat(arm.k);
      if (arm.k === "plane") { const st = s.out.find(o => (o.k === "stand" || o.k === "apron") && Math.abs(o.x - x) < 22 && Math.abs(o.z - z) < 22); if (st) { x = st.x; z = st.z; r = (st.r + 90) % 360; } }
      x = snap(x, snapOf(C)); z = snap(z!, snapOf(C)); const res = place(s, ctx, arm.k, x, z, r, { v: arm.v, f: fl }); if (res.err) { say(res.err); sfx.bad(); return; } commit(res.s); setSel(res.it!.i); sfx.build(); return; }
    if (p.id != null) { setSel(p.id === sel ? null : p.id); sfx.click(); } else setSel(null); };
  const ed = (ch: Partial<It>) => { if (!selIt) return; const r = edit(s, ctx, selIt.i, ch); if (r.err) { say(r.err); sfx.bad(); } else { commit(r.s); sfx.click(); } };
  const C = selIt && cat(selIt.k);
  const nVars = (k: string) => k === "plane" ? LIVS.length + (myLivery() ? 1 : 0) : k === "fids" ? Math.max(1, boardsN()) : k === "sign" ? Math.max(1, signsN()) : cat(k).vars?.length ?? 0;
  const varName = (k: string, v: number) => k === "plane" ? (v >= LIVS.length ? myLivery()?.name || "My airline" : LIVS[v]) : k === "fids" ? (boardsN() ? `Board ${v + 1}` : "Default board") : k === "sign" ? (signsN() ? `Sign ${v + 1}` : "Default sign") : cat(k).vars?.[v] ?? "";
  const groups = [...new Set(CATALOG.filter(c => c.lay === ctx.lay).map(c => c.g))]; const g = groups.includes(grp) ? grp : groups[0];
  const photo = async () => { const b = await E.current?.photo(); if (!b) return say("Couldn't take the photo"); sfx.chime(); const f = new File([b], (s.name || "airport").replace(/[^\w-]+/g, "-").toLowerCase() + ".jpg", { type: "image/jpeg" });
    if ((navigator as any).canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: s.name }); return; } catch (e: any) { if (e?.name === "AbortError") return; } } const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); say("Photo saved"); };
  const term = ctx.lay === "in" ? termOf(s, ctx.term) : undefined; const fl = term ? s.fl[String(term.i)] || [0, 3] : null;
  const title = ctx.lay === "out" ? s.name : `${TERM_STYLES[(term?.v ?? 0) % 4]} terminal · Floor ${ctx.floor ?? 0}`;
  const c = counts(s);
  return createPortal(<div className="sb-wrap" role="dialog" aria-label="Airport Builder 3D">
    <div ref={host} className="sb-c" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => (down.current = null)} />
    {!ready && <p className="sb-load">{err || "Loading 3D builder…"}</p>}
    <div className="sb-top"><button className="sb-x" aria-label="Exit builder" onClick={close}>✕</button><div className="sb-title"><b>{title}</b><small>{ctx.lay === "out" ? `${c.out}/${CAP.out} outside · ∞ money` : `${list.length}/${CAP.in} in this terminal`}</small></div>
      <button className="sb-ib" aria-label="Undo" disabled={!H.current.u.length} onClick={undo}>↶</button><button className="sb-ib" aria-label="Redo" disabled={!H.current.r.length} onClick={redo}>↷</button><button className="sb-ib" aria-label="More" onClick={() => setMenu(m => !m)}>⋯</button></div>
    <div className="sb-modes">{ctx.lay === "in" && <button onClick={goOut}>⬅ Outside</button>}{(["edit", "walk", "fly"] as Mode[]).map(m => <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m === "edit" ? "✏️ Build" : m === "walk" ? "🚶 Walk" : "🕊️ Fly"}</button>)}
      <button className={sim ? "on" : ""} onClick={() => { setSim(v => !v); sfx.click(); }}>{sim ? "⏸ Sim" : "▶️ Sim"}</button><button className={night ? "on" : ""} aria-label="Day or night" onClick={() => setNight(n => !n)}>{night ? "🌙" : "☀️"}</button><button aria-label="Photo" onClick={photo}>📷</button></div>
    {menu && <div className="sb-menu"><button onClick={() => setShadows(v => !v)}>{shadows ? "✅" : "⬜"} Shadows (turn off if it feels slow)</button>
      {fl && [0, 1].map(f => <button key={f} onClick={() => { const nf = { ...s.fl, [String(term!.i)]: (f ? [fl[0], (fl[1] + 1) % FLOORS.length] : [(fl[0] + 1) % FLOORS.length, fl[1]]) as [number, number] }; commit({ ...s, fl: nf }); }}>🎨 Floor {f}: {FLOORS[fl[f] % FLOORS.length]}</button>)}
      <button onClick={() => { const n = prompt("Airport name", s.name); if (n?.trim()) commit({ ...s, name: n.trim().slice(0, 40) }); setMenu(false); }}>✏️ Rename airport</button>
      <button onClick={() => { if (confirm(ctx.lay === "out" ? "Clear everything outside? (Undo can bring it back)" : "Clear this terminal?")) { commit(ctx.lay === "out" ? { ...s, out: [], ins: {}, fl: {} } : { ...s, ins: { ...s.ins, [String(ctx.term)]: [] } }); setSel(null); } setMenu(false); }}>🧹 Clear {ctx.lay === "out" ? "everything" : "this terminal"}</button>
      <p className="sb-mnote">Saved automatically in slot {slot}. Boards and signs use the designs from your Board builder and Sign studio.</p></div>}
    {toast && <div className="sb-toast" role="status">{toast}</div>}
    {ctx.lay === "in" && mode === "edit" && <div className="sb-floors">{[1, 0].map(f => <button key={f} className={(ctx.floor ?? 0) === f ? "on" : ""} onClick={() => setFloor(f)}>{f}</button>)}</div>}
    {mode === "edit" ? <div className="sb-bottom">
      {selIt && C ? <div className="sb-tools"><b>{C.e} {C.n}{selIt.k === "plane" || C.vars || selIt.k === "fids" || selIt.k === "sign" ? ` · ${varName(selIt.k, selIt.v ?? 0)}` : ""}{C.lin ? ` · ${dims(selIt)[0]} m` : ""}</b><div className="sb-tb">
        <button onClick={() => ed({ r: (selIt.r + (C.lin || selIt.k === "plane" || selIt.k === "term" ? 15 : 90)) % 360 })}>⟳ Rotate</button><button className={moving ? "on" : ""} onClick={() => { setMoving(m => !m); say("Tap where it should go"); }}>✥ Move</button>
        {C.lin && <><button onClick={() => ed({ s: dims(selIt)[0] - C.lin![2] })}>−</button><button onClick={() => ed({ s: dims(selIt)[0] + C.lin![2] })}>+</button></>}
        {selIt.k === "term" && <button onClick={() => ed({ s: ((selIt.s ?? 1) + 1) % 3 })}>⇲ Size</button>}
        {nVars(selIt.k) > 1 && <button onClick={() => ed({ v: ((selIt.v ?? 0) + 1) % nVars(selIt.k) })}>🎨 {selIt.k === "plane" ? "Livery" : "Style"}</button>}
        <button onClick={() => { const r = duplicate(s, ctx, selIt.i); if (r.err) say(r.err); else { commit(r.s); setSel(r.it!.i); sfx.build(); } }}>⧉ Copy</button>
        <button className="bad" onClick={() => { commit(remove(s, ctx, selIt.i), selIt.k === "term" ? "Terminal and its inside removed (Undo to bring back)" : undefined); setSel(null); sfx.pop(); }}>🗑</button>
        {selIt.k === "term" && <button className="pri" onClick={() => goIn(selIt)}>🚪 Go inside</button>}</div></div>
      : <><div className="sb-groups">{groups.map(x => <button key={x} className={x === g ? "on" : ""} onClick={() => setGrp(x)}>{x}</button>)}{arm && <button className="sb-rot" onClick={() => setRot(r => (r + 90) % 360)}>⟳ {rot}°</button>}</div>
        <div className="sb-pal">{CATALOG.filter(c => c.lay === ctx.lay && c.g === g).map(c => <button key={c.k} className={arm?.k === c.k ? "on" : ""} onClick={() => { setArm(a => a?.k === c.k ? null : { k: c.k, v: c.k === "plane" && myLivery() ? LIVS.length : 0 }); setSel(null); sfx.click(); }}><span>{c.e}</span><small>{c.n}</small></button>)}</div>
        <p className="sb-hint">{arm ? `Tap the ${ctx.lay === "out" ? "ground" : "floor"} to place ${cat(arm.k).n.toLowerCase()}s. Tap it again in the list to stop.` : ctx.lay === "out" ? "Pick something, then tap the ground. Tap a terminal and press Go inside to fit it out." : "Fit out the terminal. Floor buttons on the right switch floors."}</p></>}
    </div> : <><Stick eng={E} fly={mode === "fly"} />{vert && <button className="sb-vert" onClick={() => { E.current?.changeFloor(); sfx.chime(); }}>{vert === "up" ? "⬆️ Go up" : "⬇️ Go down"}</button>}<p className="sb-hint2">{mode === "walk" ? "Left stick to walk, drag to look around" : "Stick to fly, ▲▼ to rise and sink, drag to look"}</p></>}
  </div>, document.body);
}
const boardsN = () => { try { return (JSON.parse(localStorage.getItem("sk.games.boards") || "[]") as unknown[]).length; } catch { return 0; } };
const signsN = () => { try { return (JSON.parse(localStorage.getItem("sk.games.signs") || "[]") as unknown[]).length; } catch { return 0; } };

function Stick({ eng, fly }: { eng: React.RefObject<Engine | null>; fly: boolean }) {
  const [k, setK] = useState({ x: 0, y: 0 }); const base = useRef<HTMLDivElement>(null); const id = useRef<number | null>(null);
  const mv = (e: React.PointerEvent) => { if (id.current !== e.pointerId) return; const r = base.current!.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } setK({ x, y }); const E = eng.current; if (E) { E.mv.x = x; E.mv.z = y; } };
  const end = () => { id.current = null; setK({ x: 0, y: 0 }); const E = eng.current; if (E) { E.mv.x = 0; E.mv.z = 0; } };
  useEffect(() => () => { const E = eng.current; if (E) E.mv = { x: 0, z: 0, up: 0 }; }, [eng]);
  const up = (v: number) => () => { const E = eng.current; if (E) E.mv.up = v; };
  return <><div ref={base} className="sb-stick" onPointerDown={e => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); mv(e); }} onPointerMove={mv} onPointerUp={end} onPointerCancel={end}><i style={{ transform: `translate(${k.x * 38}px,${k.y * 38}px)` }} /></div>
    {fly && <div className="sb-updn"><button onPointerDown={up(1)} onPointerUp={up(0)} onPointerLeave={up(0)}>▲</button><button onPointerDown={up(-1)} onPointerUp={up(0)} onPointerLeave={up(0)}>▼</button></div>}</>;
}
export { COLS };
