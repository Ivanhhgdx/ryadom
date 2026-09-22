import { createSession, errorResponse, getRawDb, hashPassword, json, sessionCookie } from "../../../../lib/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { fullName?: string; login?: string; password?: string };
    const fullName = body.fullName?.trim() ?? "";
    const login = body.login?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (fullName.length < 2) return errorResponse("Укажите имя и фамилию.");
    if (!/^[\p{L}\p{N}._-]{3,32}$/u.test(login)) return errorResponse("Логин: от 3 до 32 символов, без пробелов.");
    if (password.length < 8) return errorResponse("Пароль должен быть не короче 8 символов.");
    const db = getRawDb();
    const existing = await db.prepare("SELECT id FROM users WHERE login = ? LIMIT 1").bind(login).first();
    if (existing) return errorResponse("Такой логин уже занят.", 409);
    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO users (id, login, full_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, login, fullName, hash, salt, Date.now()).run();
    const token = await createSession(id);
    return json({ user: { id, login, fullName } }, { status: 201, headers: { "set-cookie": sessionCookie(token) } });
  } catch (error) {
    console.error("register", error);
    return errorResponse("Не получилось создать аккаунт. Попробуйте ещё раз.", 500);
  }
}
