import { errorResponse, getCurrentUser, getRawDb, json } from "../../../lib/server";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const urgent = url.searchParams.get("urgent") === "1";
    const query = url.searchParams.get("query")?.trim();
    const view = url.searchParams.get("view");
    const clauses = ["1 = 1"];
    const bindings: (string | number)[] = [currentUser?.id ?? ""];
    if ((view === "mine" || view === "saved") && !currentUser) return errorResponse("Войдите, чтобы открыть этот раздел.", 401);
    if (view === "mine" && currentUser) clauses.push("t.owner_id = ?");
    if (view === "mine" && currentUser) bindings.push(currentUser.id);
    if (view === "saved") clauses.push("f.task_id IS NOT NULL");
    if (category && category !== "all") { clauses.push("t.category = ?"); bindings.push(category); }
    if (urgent) clauses.push("t.urgent = 1");
    if (query) { clauses.push("(lower(t.title) LIKE ? OR lower(t.description) LIKE ? OR lower(t.address) LIKE ?)"); const needle = `%${query.toLowerCase()}%`; bindings.push(needle, needle, needle); }
    const db = getRawDb();
    const result = await db.prepare(`SELECT t.id, t.title, t.description, t.category, t.price, t.address, t.lat, t.lng, t.urgent, t.commission_rate as commissionRate, t.created_at as createdAt, u.id as ownerId, u.full_name as ownerName, CASE WHEN f.task_id IS NULL THEN 0 ELSE 1 END as isFavorite FROM tasks t JOIN users u ON u.id = t.owner_id LEFT JOIN favorites f ON f.task_id = t.id AND f.user_id = ? WHERE ${clauses.join(" AND ")} ORDER BY t.urgent DESC, t.created_at DESC`).bind(...bindings).all();
    return json({ tasks: result.results });
  } catch (error) { console.error("tasks get", error); return errorResponse("Не удалось загрузить объявления.", 500); }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return errorResponse("Войдите, чтобы разместить объявление.", 401);
    const body = await request.json() as { title?: string; description?: string; category?: string; price?: number; address?: string; lat?: number; lng?: number; urgent?: boolean };
    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const address = body.address?.trim() ?? "";
    const category = body.category?.trim() ?? "other";
    const price = Number(body.price);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (title.length < 4 || description.length < 10 || address.length < 3) return errorResponse("Заполните заголовок, описание и адрес.");
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(lat) || !Number.isFinite(lng)) return errorResponse("Проверьте цену и адрес.");
    const urgent = Boolean(body.urgent);
    const id = crypto.randomUUID();
    const now = Date.now();
    await getRawDb().prepare("INSERT INTO tasks (id, owner_id, title, description, category, price, address, lat, lng, urgent, commission_rate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, user.id, title, description, category, Math.round(price), address, lat, lng, urgent ? 1 : 0, urgent ? 12 : 7, now).run();
    return json({ id }, { status: 201 });
  } catch (error) { console.error("tasks post", error); return errorResponse("Не удалось разместить объявление.", 500); }
}
