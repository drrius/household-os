/* Push-only service worker. No offline caching. */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === "string" && payload.title.length > 0
      ? payload.title
      : "Household OS";
  const body =
    typeof payload.body === "string" && payload.body.length > 0
      ? payload.body
      : "You have a new household update.";
  const notificationId =
    typeof payload.notificationId === "string"
      ? payload.notificationId
      : undefined;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: notificationId,
      renotify: false,
      data: {
        notificationId,
        url: typeof payload.url === "string" ? payload.url : "/",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            void client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
