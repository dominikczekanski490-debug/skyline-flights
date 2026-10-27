// Builds web/public/man3d.geojson from an Overpass export of Manchester Airport (OSM, ODbL).
// Usage: node scripts/build-man3d.mjs /tmp/man.json   (query: aeroway ways in 53.335,-2.32,53.375,-2.24 + buildings near terminals, "out geom")
import fs from "fs";
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const H = t => { const h = t.height; if (h) { const n = parseFloat(h); return /ft/.test(h) ? n * 0.3048 : n; } if (t["building:levels"]) return +t["building:levels"] * 4; return null; };
const feats = [];
for (const e of j.elements) {
  if (!e.geometry) continue; const t = e.tags || {}; const c = e.geometry.map(p => [+p.lon.toFixed(6), +p.lat.toFixed(6)]);
  const closed = c.length > 3 && c[0][0] === c.at(-1)[0] && c[0][1] === c.at(-1)[1];
  let kind = null, h = H(t), est = h == null;
  if (t.aeroway === "runway") kind = "runway"; else if (t.aeroway === "taxiway") kind = "taxiway"; else if (t.aeroway === "stopway") kind = "runway";
  else if (t.aeroway === "apron") kind = "apron"; else if (t.aeroway === "terminal" && closed) { kind = "terminal"; h ??= 16; }
  else if (t.aeroway === "jet_bridge") kind = "bridge";
  else if (t.building && closed && !["house", "no", "stable", "apartments", "garage"].includes(t.building)) { kind = (t["man_made"] === "tower" || t["tower:type"] || t.aeroway === "control_tower" || (h && h > 40)) ? "tower" : "building"; h ??= 9; }
  if (!kind) continue;
  const poly = closed && kind !== "runway" && kind !== "taxiway";
  feats.push({ type: "Feature", properties: { kind, name: t.name || t.ref || "", h: h ? Math.round(h) : 0, est, w: kind === "runway" ? (+t.width || 45) : kind === "taxiway" ? (+t.width || 18) : 0 }, geometry: poly ? { type: "Polygon", coordinates: [c] } : { type: "LineString", coordinates: c } });
}
fs.writeFileSync("web/public/man3d.geojson", JSON.stringify({ type: "FeatureCollection", attribution: "© OpenStreetMap contributors (ODbL)", built: new Date().toISOString(), features: feats }));
const k = {}; feats.forEach(f => k[f.properties.kind] = (k[f.properties.kind] || 0) + 1); console.log(k, fs.statSync("web/public/man3d.geojson").size);
