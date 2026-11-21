import { useEffect, useRef } from "react";
import { dayRange, DOT_LEGEND } from "./days";
import { today } from "./lib";
import "./daychips.css";
// 7 day chips (today −3 … +3). Scrolls the selected chip into view; light and dependency-free.
export function DayChips({ v, set, dark }: { v: string; set: (ymd: string) => void; dark?: boolean }) { const R = useRef<HTMLDivElement>(null); const base = today();
  useEffect(() => { const el = R.current?.querySelector(".on") as HTMLElement | null; if (el && R.current) R.current.scrollLeft = el.offsetLeft - R.current.clientWidth / 2 + el.clientWidth / 2; }, [v]);
  return <div ref={R} className={"dchips" + (dark ? " dark" : "")} role="tablist" aria-label="Day">{dayRange(base).map(c => <button key={c.ymd} role="tab" aria-selected={c.ymd === v} className={(c.ymd === v ? "on " : "") + (c.off < 0 ? "past" : c.off > 0 ? "fut" : "now")} onClick={() => set(c.ymd)}><b>{c.label}</b>{c.sub && <small>{c.sub}</small>}</button>)}</div>; }
export function DayEmpty({ d, date }: { d: any; date: string }) { const fut = date > today();
  return <div className="dempty"><b>{d?.dayNote || (fut ? "No schedule data for this day yet" : "No saved data for this day")}</b><span>{d?.dayWhy || (fut ? "The airport hasn't published flights for this day." : "The airport's feed no longer lists this day.")}</span><small>Skyline only shows real flights from the airport's own feed; nothing is filled in.</small></div>; }
export function DotLegend({ dir }: { dir: string }) { return <div className="dlegend">{DOT_LEGEND.filter(([k]) => dir === "dep" || !["ci", "bd", "fc", "dp"].includes(k)).map(([k, n]) => <span key={k}><i className={"kdot sd-" + k} />{n}</span>)}</div>; }
