// Minimal service worker for Web Push. Registered by usePushSubscription.ts.
// Not built/bundled — served as a static file from client/public/, so it
// stays plain ES2017-compatible JavaScript (no TypeScript, no imports).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.svg",
      data: { link: payload.link ?? null },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data && event.notification.data.link;
  if (link) {
    event.waitUntil(clients.openWindow(link));
  }
});
