const C = "skyline-v3";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png"]))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// App shell: serve cached copy instantly (so a sleeping server never shows a blank page), refresh in background.
self.addEventListener("fetch", e => { const u = new URL(e.request.url); if (e.request.method !== "GET" || u.pathname.startsWith("/api/") || u.origin !== location.origin) return;
  const net = fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request.mode === "navigate" ? "/" : e.request, cp)); } return r; });
  if (e.request.mode === "navigate") { e.respondWith(Promise.race([net, new Promise((_, rej) => setTimeout(rej, 4000))]).catch(() => caches.match("/").then(c => c || net))); return; }
  e.respondWith(caches.match(e.request).then(c => c || net)); });
self.addEventListener("push", e => { let d = {}; try { d = e.data.json(); } catch { d = { title: "Skyline", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Skyline", { body: d.body, tag: d.tag, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: d.url || "/" } })); });
self.addEventListener("notificationclick", e => { e.notification.close(); e.waitUntil(clients.matchAll({ type: "window" }).then(l => { for (const c of l) if ("focus" in c) return c.focus(); return clients.openWindow(e.notification.data?.url || "/"); })); });
