/* Service worker do sync. — recebe os pushes de lembrete e mostra a
   notificação mesmo com a tela apagada / app fechado. */

// Ativa a nova versão do worker imediatamente.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Chega um push: mostra a notificação com som, vibração e o botão "Tomei".
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Hora do seu remédio 💊";
  const options = {
    body: data.body || "Está na hora de tomar sua medicação.",
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    lang: "pt-BR",
    tag: `dose-${data.medicationId ?? "x"}-${data.scheduledTime ?? ""}`,
    renotify: true,
    requireInteraction: true, // fica na tela até o idoso interagir
    vibrate: [300, 150, 300, 150, 300],
    data: {
      medicationId: data.medicationId,
      scheduledTime: data.scheduledTime,
      apiBase: data.apiBase,
      url: "/app/lembretes",
    },
    actions: [{ action: "taken", title: "✓ Tomei" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Toque na notificação: "Tomei" confirma a dose; o corpo abre o app.
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  if (event.action === "taken") {
    event.waitUntil(confirmTaken(data));
    return;
  }

  event.waitUntil(openApp(data.url));
});

async function confirmTaken(data) {
  const { apiBase, medicationId, scheduledTime } = data;
  if (!apiBase || !medicationId) {
    return openApp("/app/lembretes");
  }
  try {
    await fetch(`${apiBase}/doses`, {
      method: "POST",
      credentials: "include", // leva o cookie de sessão
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicationId, scheduledTime }),
    });
  } catch {
    // melhor esforço: se falhar (ex.: offline), abre o app para confirmar lá
    return openApp("/app/lembretes");
  }
}

async function openApp(path) {
  const url = new URL(path || "/app/lembretes", self.location.origin).href;
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of windows) {
    if ("focus" in client) {
      if ("navigate" in client) {
        try {
          await client.navigate(url);
        } catch {
          /* ignora navegação bloqueada */
        }
      }
      return client.focus();
    }
  }
  return self.clients.openWindow(url);
}
