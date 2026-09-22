import { errorResponse, getCurrentUser, getRawDb, json } from "../../../lib/server";
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы прочитать уведомления.", 401);
  const db = getRawDb();
  const notifications = await db.prepare("SELECT n.id, n.task_id AS taskId, n.message, n.read_at AS readAt, n.created_at AS createdAt, t.title AS taskTitle FROM notifications n JOIN tasks t ON t.id = n.task_id WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 100").bind(user.id).all();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL").bind(user.id).first<{ count: number }>();
  return json({ notifications: notifications.results, unreadCount: count?.count ?? 0 });
}
export async function PATCH(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const { id } = await request.json() as { id?: string };
  if (!id) return errorResponse("Не выбрано уведомление.");
  await getRawDb().prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?").bind(Date.now(), id, user.id).run();
  return json({ ok: true });
}
