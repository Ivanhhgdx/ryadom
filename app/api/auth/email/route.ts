import { allowAuthAttempt, errorResponse, getCurrentUser, getRawDb, json } from "../../../../lib/server";
import { emailCodeHash, emailEnabled, normalizeEmail, sendEmailCode } from "../../../../lib/email-auth";

export function GET() { return json({ enabled: emailEnabled() }); }

export async function POST(request: Request) {
  if (!emailEnabled()) return errorResponse("Вход по почте пока недоступен.", 503);
  const body = await request.json().catch(() => ({})) as { email?: string; purpose?: string };
  const email = normalizeEmail(body.email);
  if (!email) return errorResponse("Проверьте адрес почты.");
  if (!await allowAuthAttempt(request, email, "email")) return errorResponse("Слишком много запросов. Попробуйте через 10 минут.", 429);
  const current = await getCurrentUser(request);
  const purpose = body.purpose === "link" ? "link" : "login";
  if (purpose === "link" && !current) return errorResponse("Сначала войдите в аккаунт.", 401);
  const db = getRawDb();
  if (purpose === "link") {
    const owner = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
    if (owner && owner.id !== current?.id) return errorResponse("Эта почта уже привязана к другому аккаунту.", 409);
  }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const now = Date.now();
  await db.prepare("INSERT INTO email_codes (email, code_hash, purpose, user_id, attempts, expires_at) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, purpose = excluded.purpose, user_id = excluded.user_id, attempts = 0, expires_at = excluded.expires_at")
    .bind(email, await emailCodeHash(email, code), purpose, current?.id ?? null, now + 600000).run();
  try { await sendEmailCode(email, code); }
  catch (error) { console.error("email delivery", error); await db.prepare("DELETE FROM email_codes WHERE email = ?").bind(email).run(); return errorResponse("Письмо не отправлено. Попробуйте позже.", 502); }
  return json({ sent: true });
}
