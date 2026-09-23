import { createSession, errorResponse, getCurrentUser, getRawDb, hashPassword, json, sessionCookie } from "../../../../../lib/server";
import { emailCodeHash, emailEnabled, normalizeEmail } from "../../../../../lib/email-auth";

export async function POST(request: Request) {
  if (!emailEnabled()) return errorResponse("Вход по почте пока недоступен.", 503);
  const body = await request.json().catch(() => ({})) as { email?: string; code?: string; fullName?: string };
  const email = normalizeEmail(body.email);
  const code = body.code?.trim();
  if (!email || !code || !/^\d{6}$/.test(code)) return errorResponse("Проверьте почту и код.");
  const db = getRawDb();
  const row = await db.prepare("SELECT code_hash AS codeHash, purpose, user_id AS userId, attempts, expires_at AS expiresAt FROM email_codes WHERE email = ?").bind(email)
    .first<{ codeHash: string; purpose: string; userId: string | null; attempts: number; expiresAt: number }>();
  if (!row || row.expiresAt < Date.now() || row.attempts >= 5) return errorResponse("Код истёк. Запросите новый.", 400);
  await db.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
  if (await emailCodeHash(email, code) !== row.codeHash) return errorResponse("Неверный код.", 400);
  if (row.purpose === "link") {
    const current = await getCurrentUser(request);
    if (!current || current.id !== row.userId) return errorResponse("Войдите в исходный аккаунт повторно.", 401);
    try { await db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, current.id).run(); }
    catch { return errorResponse("Эта почта уже привязана к другому аккаунту.", 409); }
    await db.prepare("DELETE FROM email_codes WHERE email = ?").bind(email).run();
    return json({ linked: true, user: current });
  }
  let user = await db.prepare("SELECT id, login, full_name AS fullName, avatar_key AS avatarKey FROM users WHERE email = ?").bind(email)
    .first<{ id: string; login: string; fullName: string; avatarKey: string | null }>();
  if (!user) {
    const fullName = body.fullName?.trim() ?? "";
    if (fullName.length < 2 || fullName.length > 100) return errorResponse("Укажите ваше имя (2–100 символов).");
    const id = crypto.randomUUID();
    const login = `user_${id.slice(0, 12)}`;
    const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { hash, salt } = await hashPassword(randomPassword);
    try { await db.prepare("INSERT INTO users (id, login, email, full_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, login, email, fullName, hash, salt, Date.now()).run(); }
    catch { return errorResponse("Аккаунт уже создан. Введите код ещё раз.", 409); }
    user = { id, login, fullName, avatarKey: null };
  }
  await db.prepare("DELETE FROM email_codes WHERE email = ?").bind(email).run();
  const token = await createSession(user.id);
  return json({ user: { id: user.id, login: user.login, fullName: user.fullName, avatarUrl: user.avatarKey ? `/api/avatars/${user.avatarKey}` : null } }, { headers: { "set-cookie": sessionCookie(token, request) } });
}
