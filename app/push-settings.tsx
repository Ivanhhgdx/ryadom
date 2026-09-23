"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

type SubscriptionData = { endpoint: string; keys: { p256dh: string; auth: string } };

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function iosBrowserNeedsInstall() {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  return ios && !standalone;
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON() as SubscriptionData) });
  if (!response.ok) throw new Error("Не удалось подключить уведомления. Попробуйте снова.");
}

export async function disableCurrentPush(userId?: string) {
  if (userId) {
    try {
      const key = `ryadom:push-offer:v1:${userId}`;
      if (localStorage.getItem(key) === "enabled") localStorage.removeItem(key);
    } catch { /* Storage may be unavailable. */ }
  }
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
  await subscription.unsubscribe();
}

export async function existingPushSubscription() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return false;
  await saveSubscription(subscription);
  return true;
}

export async function enablePushOnThisDevice(userId?: string) {
  if (iosBrowserNeedsInstall()) throw new Error("На iPhone сначала добавьте сайт на экран «Домой» через меню «Поделиться», затем откройте его оттуда.");
  if (!pushSupported()) throw new Error("Этот браузер не поддерживает push-уведомления.");
  // On iOS the permission request must be reached from the button tap, before any await.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Разрешите уведомления для «Рядом» в настройках устройства.");
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const response = await fetch("/api/push");
  if (!response.ok) throw new Error("Не удалось подключить уведомления.");
  const { publicKey } = await response.json() as { publicKey: string };
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
  await saveSubscription(subscription);
  if (userId) {
    try { localStorage.setItem(`ryadom:push-offer:v1:${userId}`, "enabled"); } catch { /* Subscription is already saved. */ }
  }
}

export function PushSettings({ userId }: { userId: string }) {
  const [state, setState] = useState<"unsupported" | "ready" | "enabled">("ready");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!pushSupported()) { queueMicrotask(() => setState("unsupported")); return; }
    let active = true;
    void existingPushSubscription().then((enabled) => { if (enabled && active) setState("enabled"); }).catch(() => undefined);
    return () => { active = false; };
  }, [userId]);

  async function enable() {
    setBusy(true); setMessage("");
    try {
      await enablePushOnThisDevice(userId);
      setState("enabled"); setMessage("Уведомления о сообщениях включены на этом устройстве.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось подключить уведомления."); }
    finally { setBusy(false); }
  }

  if (state === "unsupported") return null;
  return <div className="push-settings"><button type="button" className="secondary-button" disabled={busy || state === "enabled"} onClick={() => void enable()}><BellRing size={17} />{state === "enabled" ? "Уведомления включены" : busy ? "Подключаем…" : "Включить уведомления о сообщениях"}</button>{message && <p role="status">{message}</p>}</div>;
}
