import { errorResponse, getCurrentUser, getRawDb, json } from "../../../../../lib/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы откликнуться.", 401);
  const { id } = await params;
  const body = await request.json() as { message?: string };
  const message = body.message?.trim() ?? "";
  if (message.length < 4) return errorResponse("Напишите короткое сообщение заказчику.");
  const db = getRawDb();
  const task = await db.prepare("SELECT owner_id as ownerId FROM tasks WHERE id = ? LIMIT 1").bind(id).first<{ ownerId: string }>();
  if (!task) return errorResponse("Объявление не найдено.", 404);
  if (task.ownerId === user.id) return errorResponse("Нельзя откликнуться на своё объявление.");
  try {
    await db.prepare("INSERT INTO applications (id, task_id, applicant_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), id, user.id, message, "new", Date.now()).run();
    return json({ applied: true }, { status: 201 });
  } catch {
    return errorResponse("Вы уже откликались на это объявление.", 409);
  }
}
