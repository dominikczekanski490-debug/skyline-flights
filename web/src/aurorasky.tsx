// t138u: procedural Northern Lights sky (no photo used). Curtains = CSS gradients swaying via transform only.
import "./aurorasky.css";
import { useEffect, useState } from "react";
const C = [[-6, 78, 16, 0], [6, 92, 12, 2.1], [17, 70, 18, 4.3], [30, 96, 14, 1.2], [42, 84, 20, 3.4], [55, 100, 13, .6], [66, 76, 17, 5.1], [78, 90, 15, 2.7], [90, 72, 18, 4.8]];
export function AuroraSky() {
  const [kp, sk] = useState<number | null>(null);
  useEffect(() => { if (document.documentElement.dataset.skin !== "aurora") return; fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json").then(r => r.json()).then((a: any[]) => { const v = +a.at(-1)?.Kp; if (isFinite(v)) sk(v); }).catch(() => {}); }, []);
  // Ambient intensity follows real planetary Kp (0-9, NOAA SWPC): Kp 0 -> dim, Kp 7+ -> full.
  return <div className="nl-sky" aria-hidden style={kp == null ? undefined : { ["--kpi" as any]: Math.min(1, kp / 7).toFixed(2) }}>
    {kp != null && <span className="nl-kp">Glow follows live Kp {kp.toFixed(1)} · NOAA SWPC</span>}
    <i className="nl-stars a" /><i className="nl-stars b" />
    <div className="nl-cur">{C.map(([l, h, w, d], i) => <i key={i} style={{ left: l + "%", height: h + "%", width: w + "%", animationDelay: `-${d}s, -${d * 1.7}s` }} />)}</div>
    <svg className="nl-mtn" viewBox="0 0 390 120" preserveAspectRatio="none"><path d="M0 120V70l30-22 22 14 38-40 30 30 20-12 36 34 28-26 40 38 26-18 34 20 30-36 26 26 30-12v94z" fill="#030914" /><path d="M90 22l10 10-6-2-4 6-3-7zM290 46l9 9-5-1-4 5-2-6z" fill="#c8dcee" opacity=".55" /><rect y="104" width="390" height="16" fill="url(#nlw)" /><defs><linearGradient id="nlw" x2="0" y2="1"><stop offset="0" stopColor="#0b3b3a" stopOpacity=".5" /><stop offset="1" stopColor="#020610" /></linearGradient></defs></svg>
    <i className="nl-scrim" />
  </div>;
}
