// The player's own fan-made airline (from the "Your Own Airline" game), shared with Airport Manager so it can fly there too.
export type Livery = { name: string; code: string; body: string; belly: string; tail: string; stripe: string; motif: "swoosh" | "stripes" | "star" | "dot" | "chevron" | "wave"; engine: string };
export const MY_AL = "@MY"; export const AIR_KEY = "sk.games.airline.v1";
export function myLivery(): Livery | null { try { const s = JSON.parse(localStorage.getItem(AIR_KEY) || "null"); return s?.liv?.name ? s.liv : null; } catch { return null; } }
let cache: Livery | null = null, at = 0;
/** Same as myLivery() but re-read at most every 3 s (map/3D call it for every plane, every frame). */
export function myLiveryCached() { const n = Date.now(); if (n - at > 3000) { cache = myLivery(); at = n; } return cache; }
