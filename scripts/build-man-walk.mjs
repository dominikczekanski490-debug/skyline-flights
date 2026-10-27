// Gates, security points and station for the MAN walkthrough, from an Overpass export (OSM, ODbL). Usage: node scripts/build-man-walk.mjs /tmp/mani.json
import fs from "fs";
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const P = e => [+(e.lon ?? e.center.lon).toFixed(6), +(e.lat ?? e.center.lat).toFixed(6)];
const feats = j.elements.filter(e => e.tags.aeroway === "gate" || e.tags.amenity === "security_control" || e.tags.railway === "station" || e.tags.indoor === "area").map(e => ({ type: "Feature", properties: { kind: e.tags.aeroway === "gate" ? "gate" : e.tags.railway ? "station" : e.tags.amenity ? "security" : "area", ref: e.tags.ref || "", name: e.tags.name || "" }, geometry: { type: "Point", coordinates: P(e) } }));
fs.writeFileSync("web/public/man-walk.geojson", JSON.stringify({ type: "FeatureCollection", attribution: "© OpenStreetMap contributors (ODbL)", built: new Date().toISOString(), features: feats }));
console.log(feats.length);
