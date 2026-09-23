import { env } from "cloudflare:workers";

export function emailEnabled() {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM && env.EMAIL_OTP_SECRET);
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function emailCodeHash(email: string, code: string) {
  const secret = env.EMAIL_OTP_SECRET;
  if (!secret) throw new Error("Email is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${email}:${code}`)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sendEmailCode(email: string, code: string) {
  if (!emailEnabled()) throw new Error("Email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM, to: [email], subject: "Код входа в Рядом", text: `Ваш код входа: ${code}. Он действует 10 минут. Если вы не запрашивали код, просто проигнорируйте письмо.` }),
  });
  if (!response.ok) throw new Error("Email delivery failed");
}
