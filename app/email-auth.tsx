"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";

type User = { id: string; login: string; fullName: string; avatarUrl: string | null };

export function EmailAuth({ purpose, onComplete }: { purpose: "login" | "link"; onComplete: (user?: User) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/auth/email").then(async (response): Promise<{ enabled: boolean }> => await response.json() as { enabled: boolean }).then((data) => setEnabled(data.enabled)).catch(() => undefined); }, []);
  if (!enabled) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(step === "email" ? "/api/auth/email" : "/api/auth/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(step === "email" ? { email, purpose } : { email, code: values.get("code"), fullName: values.get("fullName") }) });
      const data = await response.json() as { error?: string; user?: User };
      if (!response.ok) throw new Error(data.error || "Не удалось отправить запрос.");
      if (step === "email") setStep("code");
      else onComplete(data.user);
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось выполнить запрос."); }
    finally { setBusy(false); }
  }

  return <section className="email-auth"><h3><Mail size={18} /> {purpose === "link" ? "Привязать почту" : "Войти по почте"}</h3><p>{step === "email" ? "Отправим шестизначный код. Пароль не нужен." : `Введите код из письма на ${email}. Он действует 10 минут.`}</p><form className="modal-form" onSubmit={submit}>{step === "email" ? <label>Электронная почта<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label> : <><label>Код из письма<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" placeholder="000000" /></label>{purpose === "login" && <label>Ваше имя, если аккаунта ещё нет<input name="fullName" minLength={2} maxLength={100} placeholder="Иван Иванов" /></label>}</>}{error && <p className="field-error" role="alert">{error}</p>}<button className="secondary-button wide" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : null}{step === "email" ? "Отправить код" : purpose === "link" ? "Подтвердить почту" : "Войти"}</button>{step === "code" && <button className="reset-link" type="button" onClick={() => { setStep("email"); setError(""); }}>Изменить почту</button>}</form></section>;
}
