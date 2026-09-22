import { createSession, errorResponse, getRawDb, hashPassword, json, sessionCookie } from "../../../../lib/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { login?: string; password?: string };
    const login = body.login?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const db = getRawDb();
    const user = await db.prepare("SELECT id, login, full_name as fullName, password_hash as passwordHash, salt FROM users WHERE login = ? LIMIT 1")
      .bind(login).first<{ id: string; login: string; fullName: string; passwordHash: string; salt: string }>();
    if (!user) return errorResponse("Неверный логин или пароль.", 401);
    const candidate = await hashPassword(password, user.salt);
    if (candidate.hash !== user.passwordHash) return errorResponse("Неверный логин или пароль.", 401);
    const token = await createSession(user.id);
    return json({ user: { id: user.id, login: user.login, fullName: user.fullName } }, { headers: { "set-cookie": sessionCookie(token) } });
  } catch (error) {
    console.error("login", error);
    return errorResponse("Не получилось выполнить вход. Попробуйте ещё раз.", 500);
  }
}
