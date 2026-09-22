import { errorResponse, getCurrentUser, getRawDb, json } from "@/lib/server";
import { allowAction, getChat } from "@/lib/chat";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const { id } = await params;
  const chat = await getChat(id, user.id);
  if (!chat) return errorResponse("Чат недоступен.", 404);
  const url = new URL(request.url);
  const after = Math.max(0, Number(url.searchParams.get("after")) || 0);
  const before = Math.max(0, Number(url.searchParams.get("before")) || 0);
  const result = await getRawDb().prepare(`SELECT id, sender_id AS senderId, body, media_id AS mediaId, created_at AS createdAt FROM messages WHERE application_id = ? ${after ? "AND id > ?" : before ? "AND id < ?" : ""} ORDER BY id ${after ? "ASC" : "DESC"} LIMIT 51`).bind(...(after || before ? [id, after || before] : [id])).all();
  const rows = result.results.slice(0, 50);
  return json({ chat, messages: after ? rows : rows.reverse(), hasMore: result.results.length > 50 });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return errorResponse("Войдите в аккаунт.", 401);
    const { id } = await params;
    if (!await getChat(id, user.id)) return errorResponse("Чат недоступен.", 404);
    const data = await request.json() as { body?: string; mediaId?: string; clientId?: string };
    const body = typeof data.body === "string" ? data.body.trim() : "";
    if ((!body && !data.mediaId) || body.length > 4000 || typeof data.clientId !== "string" || !/^[a-f0-9-]{36}$/.test(data.clientId)) return errorResponse("Сообщение: до 4000 символов или фотография.");
    const db = getRawDb();
    const existing = await db.prepare("SELECT id FROM messages WHERE sender_id = ? AND client_id = ? AND application_id = ?").bind(user.id, data.clientId, id).first();
    if (existing) return json(existing);
    if (!await allowAction(`chat:${user.id}`, 40, 60000)) return errorResponse("Слишком много сообщений. Подождите минуту.", 429);
    if (data.mediaId && !await db.prepare("SELECT id FROM media WHERE id = ? AND owner_id = ? AND purpose = 'chat' AND application_id = ? AND NOT EXISTS (SELECT 1 FROM messages WHERE media_id = media.id)").bind(data.mediaId, user.id, id).first()) return errorResponse("Прикрепите новую фотографию из этого чата.");
    const row = await db.prepare("INSERT INTO messages (application_id, sender_id, client_id, body, media_id, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(sender_id, client_id) DO NOTHING RETURNING id").bind(id, user.id, data.clientId, body, data.mediaId || null, Date.now()).first();
    return json(row || { ok: true }, { status: 201 });
  } catch (error) { console.error("send message", error); return errorResponse("Сообщение не отправлено. Повторите отправку.", 500); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const { id } = await params;
  if (!await getChat(id, user.id)) return errorResponse("Чат недоступен.", 404);
  const { lastReadId } = await request.json() as { lastReadId: number };
  if (!Number.isSafeInteger(lastReadId) || lastReadId < 0) return errorResponse("Некорректное сообщение.");
  const db = getRawDb();
  await db.prepare("INSERT INTO chat_reads (application_id, user_id, last_read_id) VALUES (?, ?, MIN(?, COALESCE((SELECT MAX(id) FROM messages WHERE application_id = ?), 0))) ON CONFLICT(application_id, user_id) DO UPDATE SET last_read_id = MAX(chat_reads.last_read_id, excluded.last_read_id)").bind(id, user.id, lastReadId, id).run();
  return json({ ok: true });
}
