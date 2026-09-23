self.addEventListener("push", (event) => {
  if (!event.data) return;
  let message;
  try { message = event.data.json(); } catch { return; }
  const url = typeof message.url === "string" && message.url.startsWith("/messages?chat=") ? message.url : "/";
  event.waitUntil(self.registration.showNotification(String(message.title || "Рядом"), {
    body: String(message.body || "Новое сообщение"),
    icon: "/ryadom-logo.png",
    badge: "/ryadom-logo.png",
    tag: `chat-${String(message.chatId || "new")}`,
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});
