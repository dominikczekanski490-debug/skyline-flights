// Announcement maker studio: pick an airport and a flight, then play a recreated PA-style chime and voice.
import { useEffect, useMemo, useRef, useState } from "react";
import { LOGOS } from "./logoset";
import { AL_NAMES } from "./alnames";
import { load, type Flight } from "./lib";
import {
  AIRPORTS, ANN_TYPES, FEATURED, airportOf, buildScript, defaultFields, fmtFlight, makeCtl, playAnnouncement,
  profileOf, stopPlayback, type AnnType, type Fields, type PlayCtl,
} from "./announcer";
import "./announce.css";

const LS = "sk.games.announce";
const alList = () => [...LOGOS].map(k => [k, AL_NAMES[k] || k] as const).sort((a, b) => a[1].localeCompare(b[1]));

type Saved = { iata: string; type: AnnType } & Fields;

const loadSaved = (): Saved => {
  const d = { iata: "MAN", type: "boarding" as AnnType, ...defaultFields() };
  try { return { ...d, ...JSON.parse(localStorage.getItem(LS) || "null") }; } catch { return d; }
};

export function AnnounceStudio() {
  const init = useMemo(loadSaved, []);
  const [iata, setIata] = useState(init.iata);
  const [type, setType] = useState<AnnType>(init.type);
  const [f, setF0] = useState<Fields>(() => ({ ...defaultFields(), ...init }));
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  const [note, setNote] = useState("");
  const [mine, setMine] = useState<Flight[]>([]);
  const ctl = useRef<PlayCtl>(makeCtl());
  const ctxRef = useRef<AudioContext | null>(null);
  const AL = useMemo(alList, []);
  const groups = useMemo(() => {
    const g: { name: string; items: typeof AIRPORTS }[] = [{ name: "Featured", items: FEATURED.map(c => airportOf(c)) }];
    for (const a of AIRPORTS) {
      const last = g[g.length - 1];
      if (last.name !== a.group) g.push({ name: a.group, items: [a] });
      else last.items.push(a);
    }
    return g;
  }, []);
  const apt = airportOf(iata);
  const profile = profileOf(iata);
  const fields: Fields = { ...f, airport: apt.name };
  const lines = useMemo(() => buildScript(iata, type, fields), [iata, type, f.airline, f.flight, f.dest, f.gate, f.newGate, f.delay, f.passenger, f.belt, f.from, apt.name]);
  const setF = (p: Partial<Fields>) => setF0(s => ({ ...s, ...p }));
  const persist = (n: Partial<Saved> = {}) => { const cur = { iata, type, ...f, ...n }; try { localStorage.setItem(LS, JSON.stringify(cur)); } catch {} };
  useEffect(() => { persist(); }, [iata, type, f]);
  useEffect(() => { try { setMine(load()); } catch { setMine([]); } return () => { stopPlayback(ctl.current, typeof speechSynthesis !== "undefined" ? speechSynthesis : null); }; }, []);

  const useFlight = (fl: Flight) => {
    const origin = (fl.origin?.iata || "").toUpperCase();
    const next: Partial<Fields> = {
      flight: fmtFlight(fl.number || ""),
      airline: fl.airline?.name || AL_NAMES[fl.airline?.iata] || "",
      dest: fl.destination?.city || fl.destination?.name || fl.destination?.iata || f.dest,
      gate: fl.dep?.gate || f.gate,
      from: fl.origin?.city || fl.origin?.name || fl.origin?.iata || f.from,
    };
    setF(next);
    if (origin && AIRPORTS.some(a => a.iata === origin)) setIata(origin);
  };

  const stop = () => { stopPlayback(ctl.current, typeof speechSynthesis !== "undefined" ? speechSynthesis : null); setPlaying(false); setLine(-1); };

  const play = async () => {
    stop();
    const next = makeCtl(); ctl.current = next;
    setNote(""); setPlaying(true); setLine(-1);
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!ctxRef.current || ctxRef.current.state === "closed") ctxRef.current = new AC();
      const ctx = ctxRef.current;
      try { await ctx.resume(); } catch {}
      await playAnnouncement(lines, profile, {
        speech: speechSynthesis, ctx, ctl: next,
        onLine: setLine,
        onNote: m => setNote(m || ""),
        onDone: () => { setPlaying(false); setLine(-1); },
      });
    } catch {
      setNote("This phone couldn’t play the announcement.");
    } finally {
      if (!next.stopped) { setPlaying(false); }
    }
  };

  const needs = (k: keyof Fields) => type === "gatechange" ? k === "newGate" : type === "delay" ? k === "delay" : type === "passenger" ? k === "passenger" : type === "baggage" ? k === "belt" || k === "from" : type === "welcome" ? k === "from" : false;
  const showFlight = type !== "security";

  return <div className="gsx ann">
    <div className="ann-stage" aria-hidden="true">
      <div className="ann-panel">
        <div className="ann-grille">{Array.from({ length: 48 }, (_, i) => <i key={i} />)}</div>
        <div className="ann-apt">{apt.name.toUpperCase()}</div>
        <div className="ann-kind">{ANN_TYPES.find(t => t.id === type)?.name.toUpperCase()}</div>
        {showFlight && <div className="ann-fl">{fmtFlight(f.flight) || "FLIGHT"} <span>·</span> {(type === "welcome" || type === "baggage" ? f.from : f.dest) || "—"}</div>}
        {showFlight && type !== "welcome" && type !== "baggage" && type !== "delay" && type !== "cancel" && <div className="ann-gate">GATE {type === "gatechange" ? f.newGate || f.gate : f.gate}</div>}
        {type === "baggage" && <div className="ann-gate">BELT {f.belt}</div>}
      </div>
    </div>
    <div className="gp-ctl">
      <button className="gp-btn pri" onClick={playing ? stop : play} aria-pressed={playing}>{playing ? "Stop" : "Play announcement"}</button>
      {playing && <button className="gp-btn" onClick={stop}>Stop</button>}
    </div>
    {note && <p className="ann-miss">{note}</p>}
    <label className="gsx-f"><span>Airport</span>
      <select value={iata} onChange={e => setIata(e.target.value)} aria-label="Airport">
        {groups.map(g => <optgroup key={g.name} label={g.name}>{g.items.map(a => <option key={g.name + a.iata} value={a.iata}>{a.iata} · {a.name}</option>)}</optgroup>)}
      </select>
    </label>
    <div className="ann-langs">Spoken in {profile.langs.map(l => ({ en: "English", pl: "Polish", es: "Spanish", el: "Greek", de: "German", fr: "French", it: "Italian", pt: "Portuguese", nl: "Dutch", cs: "Czech", hu: "Hungarian", tr: "Turkish", sv: "Swedish", da: "Danish", no: "Norwegian", fi: "Finnish", is: "Icelandic" }[l])).join(", then ")}.</div>
    <div className="ann-types" role="tablist" aria-label="Announcement type">
      {ANN_TYPES.map(t => <button key={t.id} role="tab" aria-selected={type === t.id} className={type === t.id ? "on" : ""} onClick={() => setType(t.id)}>{t.name}</button>)}
    </div>
    {mine.length > 0 && <div className="ann-mine"><span>Your flights</span>{mine.slice(0, 8).map(fl => <button key={fl.id} onClick={() => useFlight(fl)}>{fl.number} {fl.origin?.iata}→{fl.destination?.iata}</button>)}</div>}
    {showFlight && <div className="gsx-grid">
      <label className="gsx-f"><span>Flight number</span><input value={f.flight} maxLength={12} autoCapitalize="characters" placeholder="FR 2134" onChange={e => setF({ flight: e.target.value.toUpperCase() })} /></label>
      <label className="gsx-f"><span>Airline</span>
        <select value={AL.find(a => a[1] === f.airline)?.[0] || ""} onChange={e => setF({ airline: AL_NAMES[e.target.value] || e.target.value })}>
          <option value="">No airline name</option>
          {AL.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </label>
      <label className="gsx-f"><span>{type === "welcome" || type === "baggage" ? "Arriving from" : "Destination"}</span>
        <input value={type === "welcome" || type === "baggage" ? f.from : f.dest} maxLength={40} placeholder="Fuerteventura" onChange={e => setF(type === "welcome" || type === "baggage" ? { from: e.target.value } : { dest: e.target.value })} />
      </label>
      {type !== "welcome" && type !== "baggage" && type !== "delay" && type !== "cancel" && <label className="gsx-f"><span>{type === "gatechange" ? "Previous gate" : "Gate"}</span><input value={f.gate} maxLength={8} autoCapitalize="characters" placeholder="32" onChange={e => setF({ gate: e.target.value.toUpperCase() })} /></label>}
      {needs("newGate") && <label className="gsx-f"><span>New gate</span><input value={f.newGate} maxLength={8} autoCapitalize="characters" placeholder="B12" onChange={e => setF({ newGate: e.target.value.toUpperCase() })} /></label>}
      {needs("delay") && <label className="gsx-f"><span>Delay (minutes)</span><input value={f.delay} inputMode="numeric" maxLength={4} placeholder="30" onChange={e => setF({ delay: e.target.value.replace(/\D/g, "") })} /></label>}
      {needs("passenger") && <label className="gsx-f"><span>Passenger name</span><input value={f.passenger} maxLength={40} placeholder="Alex Kowalski" onChange={e => setF({ passenger: e.target.value })} /></label>}
      {needs("belt") && <label className="gsx-f"><span>Belt</span><input value={f.belt} maxLength={6} placeholder="4" onChange={e => setF({ belt: e.target.value.toUpperCase() })} /></label>}
    </div>}
    <h3 className="gsx-h">Script</h3>
    <div className="ann-script">
      {lines.map((l, i) => <div key={l.lang} className={"ann-line" + (line === i ? " on" : "")}><div className="ann-lang">{l.label}</div><p>{l.text}</p></div>)}
    </div>
    <p className="faint xs mt8">Chimes and voices are recreations in this airport’s style, not official recordings. Voices come from your iPhone. No airport or operator logos are used.</p>
  </div>;
}
