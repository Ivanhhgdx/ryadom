import webPush from "web-push";
import { getRawDb } from "./server";

type Keys = { publicKey: string; privateKey: string };
type Subscription = { endpoint: string; p256dh: string; auth: string };

export function validPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port && (
      host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" || host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com")
    );
  } catch { return false; }
}

export async function getPushKeys(): Promise<Keys> {
  const db = getRawDb();
  let keys = await db.prepare("SELECT public_key AS publicKey, private_key AS privateKey FROM push_config WHERE id = 1").first<Keys>();
  if (!keys) {
    const generated = webPush.generateVAPIDKeys();
    await db.prepare("INSERT OR IGNORE INTO push_config (id, public_key, private_key) VALUES (1, ?, ?)").bind(generated.publicKey, generated.privateKey).run();
    keys = await db.prepare("SELECT public_key AS publicKey, private_key AS privateKey FROM push_config WHERE id = 1").first<Keys>();
  }
  if (!keys) throw new Error("Push keys unavailable");
  return keys;
}

export async function sendChatPush(userId: string, chatId: string, sender: string, body: string) {
  const db = getRawDb();
  const result = await db.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").bind(userId).all<Subscription>();
  if (!result.results.length) return;
  const keys = await getPushKeys();
  const payload = JSON.stringify({ title: sender, body: body.slice(0, 160) || "Отправил(а) фотографию", url: `/messages?chat=${encodeURIComponent(chatId)}`, chatId });
  await Promise.allSettled(result.results.map(async (subscription) => {
    try {
      if (!validPushEndpoint(subscription.endpoint)) throw new Error("Invalid push endpoint");
      const details = webPush.generateRequestDetails({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, {
        vapidDetails: { subject: "https://ryadom.ivanfomin2003.chatgpt.site", publicKey: keys.publicKey, privateKey: keys.privateKey },
        contentEncoding: "aes128gcm", TTL: 86400, urgency: "high",
      });
      const bodyBytes = details.body ? Uint8Array.from(details.body) : null;
      const response = await fetch(details.endpoint, { method: "POST", headers: details.headers, body: bodyBytes?.buffer as ArrayBuffer | undefined, signal: AbortSignal.timeout(7000) });
      if (response.status === 404 || response.status === 410) await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(subscription.endpoint).run();
      else if (!response.ok) console.error("push delivery", response.status);
    } catch (error) { console.error("push delivery", error); }
  }));
}
