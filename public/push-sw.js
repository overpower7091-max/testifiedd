/* Testified push messaging service worker.
   This worker only handles Web Push notifications — it does not cache
   the app shell and must not be used for offline behaviour. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "Testified", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Testified";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/logo.png",
    badge: "/logo.png",
    tag: payload.tag || "testified",
    renotify: true,
    requireInteraction: false,
    data: { url: payload.url || "/live" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/live";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if (client.url.includes(url)) {
          await client.focus();
          return;
        }
      }
      const existing = clientsList[0];
      if (existing) {
        await existing.focus();
        if (existing.navigate) await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
