import { env } from "cloudflare:workers";

export type Db = D1Database;

export function getRawDb(): Db {
  if (!env.DB) {
    throw new Error("Database binding DB is unavailable");
  }
  return env.DB;
}

export type PublicUser = { id: string; login: string; fullName: string; avatarUrl: string | null };

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

export async function digestHex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function allowAuthAttempt(request: Request, login: string, mode: "login" | "register") {
  const db = getRawDb();
  const now = Date.now();
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const limit = mode === "register" ? 20 : 60;
  const keys = [{ key: `${mode}:ip:${await digestHex(ip)}`, limit }, ...(mode === "login" ? [{ key: `login:user:${await digestHex(login)}`, limit: 10 }] : [])];
  for (const item of keys) {
    const row = await db.prepare("INSERT INTO auth_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at < ? THEN 1 ELSE count + 1 END, expires_at = CASE WHEN expires_at < ? THEN excluded.expires_at ELSE expires_at END RETURNING count").bind(item.key, now + 600000, now, now).first<{ count: number }>();
    if (!row || row.count > item.limit) return false;
  }
  await db.prepare("DELETE FROM auth_limits WHERE expires_at < ?").bind(now - 86400000).run();
  return true;
}

export async function hashPassword(password: string, saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16))), iterations = 100000) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return { hash: `${iterations === 100000 ? "v2:" : ""}${bytesToHex(new Uint8Array(bits))}`, salt: saltHex };
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("cookie") ?? "").split(";").flatMap((part) => {
      const [key, ...value] = part.trim().split("=");
      return key ? [[key, decodeURIComponent(value.join("="))]] : [];
    }),
  );
}

export async function getCurrentUser(request: Request): Promise<PublicUser | null> {
  const token = parseCookies(request).ryadom_session;
  if (!token) return null;
  const db = getRawDb();
  const row = await db
    .prepare(`SELECT u.id, u.login, u.full_name as fullName, u.avatar_key as avatarKey FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`)
    .bind(await digestHex(token), Date.now())
    .first<Omit<PublicUser, "avatarUrl"> & { avatarKey: string | null }>();
  return row ? { id: row.id, login: row.login, fullName: row.fullName, avatarUrl: row.avatarKey ? `/api/avatars/${row.avatarKey}` : null } : null;
}

export async function createSession(userId: string) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const db = getRawDb();
  await db.prepare("INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), await digestHex(token), userId, Date.now() + 1000 * 60 * 60 * 24 * 30, Date.now())
    .run();
  return token;
}

export function sessionCookie(token: string, request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) ? "" : " Secure;";
  return `ryadom_session=${encodeURIComponent(token)}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=2592000`;
}

export function clearSessionCookie() {
  return "ryadom_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export async function revokeSession(request: Request) {
  const token = parseCookies(request).ryadom_session;
  if (token) await getRawDb().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digestHex(token)).run();
}

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { "content-type": "application/json; charset=utf-8", ...(init.headers ?? {}) } });
}

export function errorResponse(message: string, status = 400) {
  return json({ error: message }, { status });
}
