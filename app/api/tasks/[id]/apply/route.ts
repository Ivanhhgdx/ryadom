import { errorResponse, getCurrentUser, getRawDb, json } from "../../../../../lib/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы прочитать отклики.", 401);
  const { id } = await params;
  const db = getRawDb();
  const task = await db.prepare("SELECT owner_id AS ownerId FROM tasks WHERE id = ?").bind(id).first<{ ownerId: string }>();
  if (!task) return errorResponse("Объявление не найдено.", 404);
  const result = await db.prepare(`SELECT a.id, a.message, a.status, a.created_at AS createdAt, u.id AS applicantId, u.full_name AS fullName, u.login FROM applications a JOIN users u ON u.id = a.applicant_id WHERE a.task_id = ? ${task.ownerId === user.id ? "" : "AND a.applicant_id = ?"} ORDER BY a.created_at DESC`).bind(...(task.ownerId === user.id ? [id] : [id, user.id])).all();
  return json({ applications: result.results });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы откликнуться.", 401);
  const { id } = await params;
  const body = await request.json() as { message?: string };
  const message = body.message?.trim() ?? "";
  if (message.length < 4 || message.length > 3000) return errorResponse("Сообщение должно содержать от 4 до 3000 символов.");
  const db = getRawDb();
  const task = await db.prepare("SELECT owner_id as ownerId FROM tasks WHERE id = ? LIMIT 1").bind(id).first<{ ownerId: string }>();
  if (!task) return errorResponse("Объявление не найдено.", 404);
  if (task.ownerId === user.id) return errorResponse("Нельзя откликнуться на своё объявление.");
  const taken = await db.prepare("SELECT id FROM applications WHERE task_id = ? AND status IN ('accepted', 'done') LIMIT 1").bind(id).first();
  if (taken) return errorResponse("Исполнитель уже выбран или задача завершена.", 409);
  try {
    await db.prepare("INSERT INTO applications (id, task_id, applicant_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), id, user.id, message, "new", Date.now()).run();
    return json({ applied: true }, { status: 201 });
  } catch {
    return errorResponse("Вы уже откликались на это объявление.", 409);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const { id } = await params;
  const body = await request.json() as { applicationId: string; status: string };
  if (!["accepted", "done"].includes(body.status)) return errorResponse("Недопустимый статус.");
  const db = getRawDb();
  const task = await db.prepare("SELECT owner_id AS ownerId FROM tasks WHERE id = ?").bind(id).first<{ ownerId: string }>();
  if (!task || task.ownerId !== user.id) return errorResponse("Только заказчик может управлять задачей.", 403);
  const update = body.status === "accepted"
    ? await db.prepare("UPDATE applications SET status = 'accepted' WHERE id = ? AND task_id = ? AND status = 'new' AND NOT EXISTS (SELECT 1 FROM applications WHERE task_id = ? AND status IN ('accepted', 'done'))").bind(body.applicationId, id, id).run()
    : await db.prepare("UPDATE applications SET status = 'done' WHERE id = ? AND task_id = ? AND status = 'accepted'").bind(body.applicationId, id).run();
  if (!update.meta.changes) return errorResponse("Статус уже изменился. Откройте объявление повторно.", 409);
  return json({ ok: true });
}
