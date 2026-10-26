const C = "skyline-v15"; const IMG = "skyline-img-v15"; const IMG_MAX = 200;
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png"]))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Navigations are network-first (15 s budget for a sleeping free server) so the phone never stays on an old build;
// the cached shell is only a fallback when offline. Hashed assets are immutable, so cache-first is safe for them.
self.addEventListener("fetch", e => { const u = new URL(e.request.url);
  // Third-party aircraft photos (Planespotters / Wikimedia): stale-while-revalidate, capped at IMG_MAX entries, never pinned forever.
  if (e.request.method === "GET" && (u.pathname === "/api/photo" && u.origin === location.origin || /(^|\.)plnspttrs\.net$|(^|\.)wikimedia\.org$/.test(u.hostname))) { e.respondWith(caches.open(IMG).then(async c => { const hit = await c.match(e.request);
    const net = fetch(e.request).then(async r => { if (r.ok || r.type === "opaque") { await c.put(e.request, r.clone()); const k = await c.keys(); for (const x of k.slice(0, Math.max(0, k.length - IMG_MAX))) await c.delete(x); } return r; }).catch(() => hit);
    return hit || net; })); return; } if (e.request.method !== "GET" || u.pathname.startsWith("/api/") || u.pathname === "/version.json" || u.origin !== location.origin) return;
  const net = fetch(e.request, e.request.mode === "navigate" ? { cache: "no-store" } : undefined).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request.mode === "navigate" ? "/" : e.request, cp)); } return r; });
  if (e.request.mode === "navigate") { e.respondWith(Promise.race([net, new Promise((_, rej) => setTimeout(rej, 15000))]).catch(() => caches.match("/").then(c => c || net))); return; }
  e.respondWith(caches.match(e.request).then(c => c || net)); });
self.addEventListener("push", e => { let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  // iOS revokes push permission if a push arrives without showing a notification, so always show one.
  e.waitUntil(self.registration.showNotification(d.title || "Skyline", { body: d.body || "Flight update", tag: d.tag || undefined, renotify: !!d.tag, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: d.url || "/" } })); });
// Page asks the worker to show a local notification (iOS has no `new Notification()` in pages).
self.addEventListener("message", e => { if (e.data?.type === "notify") self.registration.showNotification(e.data.title, { body: e.data.body, tag: e.data.tag, icon: "/icon-192.png" }); });
self.addEventListener("notificationclick", e => { e.notification.close(); const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => { for (const c of l) if (c.url.startsWith(self.location.origin) && "focus" in c) { if (c.url !== url && "navigate" in c) c.navigate(url).catch(() => {}); return c.focus(); } return clients.openWindow(url); })); });
// Browser rotated the subscription → re-register with the server immediately.
self.addEventListener("pushsubscriptionchange", e => { e.waitUntil((async () => { const k = await (await fetch("/api/push/key")).json(); const b = atob((k.publicKey + "===".slice((k.publicKey.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(b, c => c.charCodeAt(0)) });
  await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON() }) }); })().catch(() => {})); });
