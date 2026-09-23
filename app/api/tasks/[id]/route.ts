import { errorResponse, getCurrentUser, getRawDb, json } from "../../../../lib/server";
import { districts } from "../../../../lib/districts";
import { validCategory } from "../../../../lib/categories";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  const task = await getRawDb().prepare(`SELECT (SELECT status FROM applications a WHERE a.task_id = t.id AND a.status IN ('accepted', 'done') LIMIT 1) AS workStatus, t.id, t.title, t.description, t.category, t.price, t.address, t.district, t.lat, t.lng, t.urgent, t.archived_at AS archivedAt, t.commission_rate AS commissionRate, t.created_at AS createdAt, t.owner_id AS ownerId, u.full_name AS ownerName, EXISTS(SELECT 1 FROM favorites WHERE user_id = ? AND task_id = t.id) AS isFavorite FROM tasks t JOIN users u ON u.id = t.owner_id WHERE t.id = ? AND t.deleted_at IS NULL AND (t.archived_at IS NULL OR t.owner_id = ?)`).bind(user?.id || "", id, user?.id || "").first();
  if (!task) return errorResponse("Объявление не найдено.", 404);
  const extra = await getRawDb().prepare("SELECT work_mode AS workMode FROM tasks WHERE id = ?").bind(id).first();
  const images = await getRawDb().prepare("SELECT id FROM media WHERE task_id = ? ORDER BY created_at, id").bind(id).all();
  return json({ task: { ...task, ...extra, imageIds: images.results.map((image) => image.id) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const { id } = await params;
  const db = getRawDb();
  const existing = await db.prepare("SELECT id FROM tasks WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(id, user.id).first();
  if (!existing) return errorResponse("Объявление не найдено.", 404);
  const body = await request.json().catch(() => null) as { action?: string; title?: string; description?: string; category?: string; price?: number; address?: string; district?: string; lat?: number; lng?: number; urgent?: boolean; workMode?: string; imageIds?: string[] } | null;
  if (!body) return errorResponse("Проверьте данные объявления.");
  if (body.action === "archive" || body.action === "restore") {
    await db.prepare("UPDATE tasks SET archived_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(body.action === "archive" ? Date.now() : null, id, user.id).run();
    return json({ ok: true });
  }
  const workMode = body.workMode === "remote" ? "remote" : "onsite";
  const title = body.title?.trim() || "";
  const description = body.description?.trim() || "";
  const category = body.category?.trim() || "";
  const price = Number(body.price);
  const address = workMode === "remote" ? "Удалённо · Красноярск" : body.address?.trim() || "";
  const district = workMode === "remote" ? null : body.district || null;
  const lat = workMode === "remote" ? 56.0153 : Number(body.lat);
  const lng = workMode === "remote" ? 92.8932 : Number(body.lng);
  if (title.length < 4 || title.length > 120 || description.length < 10 || description.length > 5000 || !validCategory(category)) return errorResponse("Проверьте название, описание и категорию.");
  if (!Number.isFinite(price) || price < 0 || price > 10000000 || address.length < 3 || address.length > 250 || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 55.8 || lat > 56.3 || lng < 92.5 || lng > 93.3 || (workMode === "onsite" && (!district || !districts.some((item) => item === district)))) return errorResponse("Проверьте бюджет и адрес в Красноярске.");
  const imageIds = body.imageIds ?? [];
  if (!Array.isArray(imageIds) || imageIds.length > 5 || imageIds.some((imageId) => typeof imageId !== "string") || new Set(imageIds).size !== imageIds.length) return errorResponse("Можно добавить до 5 фотографий.");
  for (const imageId of imageIds) {
    if (!await db.prepare("SELECT id FROM media WHERE id = ? AND owner_id = ? AND purpose = 'task' AND (task_id IS NULL OR task_id = ?)").bind(imageId, user.id, id).first()) return errorResponse("Одна из фотографий недоступна.");
  }
  await db.batch([
    db.prepare("UPDATE tasks SET title = ?, description = ?, category = ?, price = ?, address = ?, district = ?, work_mode = ?, lat = ?, lng = ?, urgent = ?, commission_rate = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(title, description, category, Math.round(price), address, district, workMode, lat, lng, body.urgent ? 1 : 0, body.urgent ? 12 : 7, id, user.id),
    db.prepare("UPDATE media SET task_id = NULL WHERE task_id = ? AND owner_id = ?").bind(id, user.id),
    ...imageIds.map((imageId) => db.prepare("UPDATE media SET task_id = ? WHERE id = ? AND owner_id = ? AND purpose = 'task' AND task_id IS NULL").bind(id, imageId, user.id)),
  ]);
  return json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const { id } = await params;
  const result = await getRawDb().prepare("UPDATE tasks SET deleted_at = ?, archived_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(Date.now(), Date.now(), id, user.id).run();
  if (!result.meta.changes) return errorResponse("Объявление не найдено.", 404);
  return json({ ok: true });
}
