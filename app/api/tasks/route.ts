import { errorResponse, getCurrentUser, getRawDb, json } from "../../../lib/server";
import { districts } from "../../../lib/districts";
import { validCategory } from "../../../lib/categories";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const urgent = url.searchParams.get("urgent") === "1";
    const query = url.searchParams.get("query")?.trim();
    const view = url.searchParams.get("view");
    const selectedDistricts = url.searchParams.getAll("district");
    const workMode = url.searchParams.get("workMode");
    const clauses = ["1 = 1"];
    clauses.push("t.deleted_at IS NULL");
    if (view !== "mine") clauses.push("t.archived_at IS NULL");
    const bindings: (string | number)[] = [currentUser?.id ?? ""];
    if ((view === "mine" || view === "saved") && !currentUser) return errorResponse("Войдите, чтобы открыть этот раздел.", 401);
    if (view === "mine" && currentUser) clauses.push("t.owner_id = ?");
    if (view === "mine" && currentUser) bindings.push(currentUser.id);
    if (view === "saved") clauses.push("f.task_id IS NOT NULL");
    if (category && category !== "all") {
      if (!validCategory(category)) return errorResponse("Неизвестная категория.");
      if (category.includes(":")) { clauses.push("t.category = ?"); bindings.push(category); }
      else { clauses.push("(t.category = ? OR t.category LIKE ?)"); bindings.push(category, `${category}:%`); }
    }
    if (urgent) clauses.push("t.urgent = 1");
    if (workMode === "remote" || workMode === "onsite") { clauses.push("t.work_mode = ?"); bindings.push(workMode); }
    if (selectedDistricts.length) { clauses.push(`t.district IN (${selectedDistricts.map(() => "?").join(",")})`); bindings.push(...selectedDistricts); }
    const db = getRawDb();
    const result = await db.prepare(`SELECT t.work_mode AS workMode, t.archived_at AS archivedAt, (SELECT id FROM media WHERE task_id = t.id ORDER BY created_at, id LIMIT 1) AS coverId, (SELECT status FROM applications a WHERE a.task_id = t.id AND a.status IN ('accepted', 'done') LIMIT 1) AS workStatus, t.id, t.title, t.description, t.category, t.price, t.address, t.district, t.lat, t.lng, t.urgent, t.commission_rate as commissionRate, t.created_at as createdAt, u.id as ownerId, u.full_name as ownerName, CASE WHEN f.task_id IS NULL THEN 0 ELSE 1 END as isFavorite FROM tasks t JOIN users u ON u.id = t.owner_id LEFT JOIN favorites f ON f.task_id = t.id AND f.user_id = ? WHERE ${clauses.join(" AND ")} ORDER BY (t.archived_at IS NOT NULL), t.urgent DESC, t.created_at DESC`).bind(...bindings).all();
    const matching = query ? result.results.filter((row) => [row.title, row.description, row.address].some((value) => String(value).toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")))) : result.results;
    return json({ tasks: matching });
  } catch (error) { console.error("tasks get", error); return errorResponse("Не удалось загрузить объявления.", 500); }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return errorResponse("Войдите, чтобы разместить объявление.", 401);
    const body = await request.json() as { title?: string; description?: string; category?: string; price?: number; address?: string; district?: string; lat?: number; lng?: number; urgent?: boolean; workMode?: string; imageIds?: string[] };
    const workMode = body.workMode === "remote" ? "remote" : "onsite";
    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const address = workMode === "remote" ? "Удалённо · Красноярск" : body.address?.trim() ?? "";
    const category = body.category?.trim() ?? "other";
    const price = Number(body.price);
    const lat = workMode === "remote" ? 56.0153 : Number(body.lat);
    const lng = workMode === "remote" ? 92.8932 : Number(body.lng);
    if (title.length < 4 || description.length < 10 || address.length < 3) return errorResponse("Заполните заголовок, описание и адрес.");
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(lat) || !Number.isFinite(lng)) return errorResponse("Проверьте цену и адрес.");
    const urgent = Boolean(body.urgent);
    const district = workMode === "remote" ? null : body.district;
    if (workMode === "onsite" && (!district || !districts.some((item) => item === district))) return errorResponse("Проверьте район Красноярска.");
    if (title.length > 120 || description.length > 5000 || address.length > 250 || price > 10000000 || lat < 55.8 || lat > 56.3 || lng < 92.5 || lng > 93.3) return errorResponse("Проверьте данные. Адрес должен находиться в Красноярске.");
    if (!validCategory(category)) return errorResponse("Выберите категорию.");
    const id = crypto.randomUUID();
    const now = Date.now();
    const imageIds = body.imageIds ?? [];
    if (!Array.isArray(imageIds) || imageIds.length > 5 || imageIds.some((imageId) => typeof imageId !== "string") || new Set(imageIds).size !== imageIds.length) return errorResponse("Можно добавить до 5 фотографий.");
    const db = getRawDb();
    for (const imageId of imageIds) {
      if (!await db.prepare("SELECT id FROM media WHERE id = ? AND owner_id = ? AND purpose = 'task' AND task_id IS NULL").bind(imageId, user.id).first()) return errorResponse("Фотография недоступна. Загрузите её заново.");
    }
    const insert = db.prepare(`INSERT INTO tasks (id, owner_id, title, description, category, price, address, lat, lng, urgent, commission_rate, created_at, district, work_mode) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${imageIds.length ? `(SELECT COUNT(*) FROM media WHERE id IN (${imageIds.map(() => "?").join(",")}) AND owner_id = ? AND purpose = 'task' AND task_id IS NULL) = ?` : "1 = 1"}`).bind(id, user.id, title, description, category, Math.round(price), address, lat, lng, urgent ? 1 : 0, urgent ? 7 : 5, now, district || null, workMode, ...(imageIds.length ? [...imageIds, user.id, imageIds.length] : []));
    const results = await db.batch([insert, ...imageIds.map((imageId) => db.prepare("UPDATE media SET task_id = ? WHERE id = ? AND owner_id = ? AND task_id IS NULL AND EXISTS (SELECT 1 FROM tasks WHERE id = ?)").bind(id, imageId, user.id, id))]);
    if (!results[0].meta.changes) return errorResponse("Фотографии уже используются. Обновите форму.", 409);
    return json({ id }, { status: 201 });
  } catch (error) { console.error("tasks post", error); return errorResponse("Не удалось разместить объявление.", 500); }
}
