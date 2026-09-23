import { allowAuthAttempt, createSession, errorResponse, getRawDb, hashPassword, json, sessionCookie } from "../../../../lib/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { login?: string; password?: string };
    const login = body.login?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!await allowAuthAttempt(request, login, "login")) return errorResponse("Слишком много попыток. Попробуйте через 10 минут.", 429);
    if (typeof password !== "string" || password.length > 128 || login.length > 32) return errorResponse("Проверьте логин и пароль.");
    const db = getRawDb();
    const user = await db.prepare("SELECT id, login, full_name as fullName, avatar_key as avatarKey, password_hash as passwordHash, salt FROM users WHERE login = ? LIMIT 1")
      .bind(login).first<{ id: string; login: string; fullName: string; avatarKey: string | null; passwordHash: string; salt: string }>();
    if (!user) return errorResponse("Неверный логин или пароль.", 401);
    const candidate = await hashPassword(password, user.salt, user.passwordHash.startsWith("v2:") ? 100000 : 120000);
    if (candidate.hash !== user.passwordHash) return errorResponse("Неверный логин или пароль.", 401);
    const token = await createSession(user.id);
    return json({ user: { id: user.id, login: user.login, fullName: user.fullName, avatarUrl: user.avatarKey ? `/api/avatars/${user.avatarKey}` : null } }, { headers: { "set-cookie": sessionCookie(token, request) } });
  } catch (error) {
    console.error("login", error);
    return errorResponse("Не получилось выполнить вход. Попробуйте ещё раз.", 500);
  }
}
