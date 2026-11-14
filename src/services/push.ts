import { api } from "./api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

export type PushState =
  | "unsupported" // navegador sem suporte (ou sem service worker)
  | "unconfigured" // falta a chave VAPID no front
  | "default" // ainda não pediu permissão
  | "denied" // usuário bloqueou as notificações
  | "enabled"; // ativo e inscrito neste aparelho

/** O navegador suporta notificações push? */
export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Converte a chave pública VAPID (base64url) para o formato do navegador. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Estado atual das notificações neste aparelho. */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "denied";

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && Notification.permission === "granted") return "enabled";
  return "default";
}

/**
 * Ativa os lembretes neste aparelho: pede permissão, cria a inscrição de push
 * e a registra no backend. Lança Error com mensagem amigável em caso de falha.
 */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Este aparelho ou navegador não suporta notificações.");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "As notificações não estão configuradas (chave VAPID ausente).",
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Permissão de notificação negada. Autorize nas configurações do navegador.",
    );
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await api.post("/push/subscriptions", subscription.toJSON());
}

/** Desativa os lembretes neste aparelho (remove a inscrição local e no backend). */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  try {
    await api.delete("/push/subscriptions", {
      data: { endpoint: subscription.endpoint },
    });
  } catch {
    // mesmo que o backend falhe, cancelamos a inscrição local
  }
  await subscription.unsubscribe();
}
