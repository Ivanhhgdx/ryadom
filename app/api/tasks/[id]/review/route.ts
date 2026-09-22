import { errorResponse, getCurrentUser, getRawDb, json } from "../../../../../lib/server";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы оставить отзыв.", 401);
  const { id } = await params;
  const db = getRawDb();
  const work = await db.prepare(`SELECT t.owner_id AS ownerId, a.applicant_id AS applicantId FROM tasks t JOIN applications a ON a.task_id = t.id WHERE t.id = ? AND a.status = 'done'`).bind(id).first<{ ownerId: string; applicantId: string }>();
  if (!work || ![work.ownerId, work.applicantId].includes(user.id)) return errorResponse("Отзыв доступен участникам завершённой задачи.", 403);
  const body = await request.json() as { rating: number; message: string };
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || typeof body.message !== "string" || body.message.trim().length < 4 || body.message.length > 2000) return errorResponse("Поставьте оценку от 1 до 5 и напишите отзыв (4–2000 символов).");
  const existing = await db.prepare("SELECT id FROM reviews WHERE task_id = ? AND reviewer_id = ?").bind(id, user.id).first();
  if (existing) return errorResponse("Вы уже оставили отзыв по этой задаче.", 409);
  await db.prepare("INSERT INTO reviews (id, task_id, reviewer_id, reviewee_id, rating, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, user.id, user.id === work.ownerId ? work.applicantId : work.ownerId, body.rating, body.message.trim(), Date.now()).run();
  return json({ ok: true }, { status: 201 });
}
