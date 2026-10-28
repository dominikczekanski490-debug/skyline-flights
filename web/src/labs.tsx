// Labs is loaded on demand (own chunk) so its ~200 KB of tools don't weigh on first load.
import { Fragment, useState } from "react";
import { LABS, Ic, Kind, BOARDY, DaySeg } from "./v25";
import { LABS2, LabsHome, Ic2 } from "./v28";
import { LABS3 } from "./v29";
import { LABS4 } from "./v32";
import { LABS5 } from "./v39";
export const LAB_COUNT = LABS.length + LABS2.length + LABS3.length + LABS4.length + LABS5.length;
export default function Labs({ id, apt, f, open }: { id?: string; apt?: string; f?: any; open?: (f: any) => void }) { const [sel, ss] = useState<string | null>(id || null); const [rk, srk] = useState(0); const ALL: any[] = [...LABS, ...LABS2, ...LABS3, ...LABS4, ...LABS5]; const t = ALL.find(x => x.id === sel);
  if (t) return <div className="lab-tool"><button className="lab-back" onClick={() => ss(null)}>{Ic.back} Labs</button><div className="lab-th"><span className={"lab-ic k-" + t.k.split("-")[0].toLowerCase()}>{Ic[t.ic] || Ic2[t.ic]}</span><div><h2>{t.n}</h2><Kind k={t.k} /></div></div>{BOARDY.has(t.id) && <DaySeg on={() => srk(x => x + 1)} />}<Fragment key={rk}>{t.el({ apt, f, open })}</Fragment></div>;
  return <LabsHome all={ALL} pick={ss} />; }
