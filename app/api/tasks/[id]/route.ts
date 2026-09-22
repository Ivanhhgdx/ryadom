import { errorResponse, getCurrentUser, getRawDb, json } from "../../../../lib/server";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  const task = await getRawDb().prepare(`SELECT (SELECT status FROM applications a WHERE a.task_id = t.id AND a.status IN ('accepted', 'done') LIMIT 1) AS workStatus, t.id, t.title, t.description, t.category, t.price, t.address, t.district, t.lat, t.lng, t.urgent, t.commission_rate AS commissionRate, t.created_at AS createdAt, t.owner_id AS ownerId, u.full_name AS ownerName, EXISTS(SELECT 1 FROM favorites WHERE user_id = ? AND task_id = t.id) AS isFavorite FROM tasks t JOIN users u ON u.id = t.owner_id WHERE t.id = ?`).bind(user?.id || "", id).first();
  if (!task) return errorResponse("Объявление не найдено.", 404);
  const extra = await getRawDb().prepare("SELECT work_mode AS workMode FROM tasks WHERE id = ?").bind(id).first();
  const images = await getRawDb().prepare("SELECT id FROM media WHERE task_id = ? ORDER BY created_at, id").bind(id).all();
  return json({ task: { ...task, ...extra, imageIds: images.results.map((image) => image.id) } });
}
