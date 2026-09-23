"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { enablePushOnThisDevice, existingPushSubscription, iosBrowserNeedsInstall, pushSupported } from "./push-settings";

type Mode = "install" | "enable" | null;
const storageKey = (userId: string) => `ryadom:push-offer:v1:${userId}`;

export function PushOnboarding({ userId }: { userId: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try { if (localStorage.getItem(storageKey(userId)) === "dismissed") return; } catch { /* Storage may be unavailable. */ }
      if (iosBrowserNeedsInstall()) { if (active) setMode("install"); return; }
      if (!pushSupported() || Notification.permission === "denied") return;
      const enabled = await existingPushSubscription().catch(() => false);
      if (active && !enabled) setMode("enable");
    })();
    return () => { active = false; };
  }, [userId]);

  function dismiss() {
    try { localStorage.setItem(storageKey(userId), "dismissed"); } catch { /* The card still closes for this session. */ }
    setMode(null);
  }

  async function enable() {
    setBusy(true); setError("");
    try {
      await enablePushOnThisDevice(userId);
      setMode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось включить уведомления. Попробуйте снова.");
    } finally { setBusy(false); }
  }

  if (!mode) return null;
  return <section className="push-onboarding" aria-label="Уведомления о сообщениях"><div className="push-onboarding-icon"><BellRing size={21} /></div><div className="push-onboarding-copy"><h2>{mode === "install" ? "Сообщения прямо на iPhone" : "Не пропускайте новые сообщения"}</h2><p>{mode === "install" ? "Добавьте «Рядом» на экран «Домой» через «Поделиться», затем откройте приложение и включите уведомления." : "Разрешите уведомления на этом устройстве, чтобы видеть сообщения, даже когда приложение закрыто."}</p>{error && <p className="field-error" role="alert">{error}</p>}</div><div className="push-onboarding-actions">{mode === "enable" && <button className="primary-button" type="button" disabled={busy} onClick={() => void enable()}>{busy ? "Подключаем…" : "Включить"}</button>}<button className="push-onboarding-dismiss" type="button" aria-label="Закрыть предложение" onClick={dismiss}><X size={18} /></button></div></section>;
}
