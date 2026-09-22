import { errorResponse, getCurrentUser, getRawDb, json } from "../../../lib/server";
import { districts } from "../../../lib/districts";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const urgent = url.searchParams.get("urgent") === "1";
    const query = url.searchParams.get("query")?.trim();
    const view = url.searchParams.get("view");
    const selectedDistricts = url.searchParams.getAll("district");
    const clauses = ["1 = 1"];
    const bindings: (string | number)[] = [currentUser?.id ?? ""];
    if ((view === "mine" || view === "saved") && !currentUser) return errorResponse("Войдите, чтобы открыть этот раздел.", 401);
    if (view === "mine" && currentUser) clauses.push("t.owner_id = ?");
    if (view === "mine" && currentUser) bindings.push(currentUser.id);
    if (view === "saved") clauses.push("f.task_id IS NOT NULL");
    if (category && category !== "all") { clauses.push("t.category = ?"); bindings.push(category); }
    if (urgent) clauses.push("t.urgent = 1");
    if (selectedDistricts.length) { clauses.push(`t.district IN (${selectedDistricts.map(() => "?").join(",")})`); bindings.push(...selectedDistricts); }
    const db = getRawDb();
    const result = await db.prepare(`SELECT (SELECT status FROM applications a WHERE a.task_id = t.id AND a.status IN ('accepted', 'done') LIMIT 1) AS workStatus, t.id, t.title, t.description, t.category, t.price, t.address, t.district, t.lat, t.lng, t.urgent, t.commission_rate as commissionRate, t.created_at as createdAt, u.id as ownerId, u.full_name as ownerName, CASE WHEN f.task_id IS NULL THEN 0 ELSE 1 END as isFavorite FROM tasks t JOIN users u ON u.id = t.owner_id LEFT JOIN favorites f ON f.task_id = t.id AND f.user_id = ? WHERE ${clauses.join(" AND ")} ORDER BY t.urgent DESC, t.created_at DESC`).bind(...bindings).all();
    const matching = query ? result.results.filter((row) => [row.title, row.description, row.address].some((value) => String(value).toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")))) : result.results;
    return json({ tasks: matching });
  } catch (error) { console.error("tasks get", error); return errorResponse("Не удалось загрузить объявления.", 500); }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return errorResponse("Войдите, чтобы разместить объявление.", 401);
    const body = await request.json() as { title?: string; description?: string; category?: string; price?: number; address?: string; district?: string; lat?: number; lng?: number; urgent?: boolean };
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
    const district = body.district;
    if (!district || !districts.some((item) => item === district)) return errorResponse("Выберите район Красноярска.");
    if (title.length > 120 || description.length > 5000 || address.length > 250 || price > 10000000 || lat < 55.8 || lat > 56.3 || lng < 92.5 || lng > 93.3) return errorResponse("Проверьте данные. Адрес должен находиться в Красноярске.");
    if (!["delivery", "digital", "repair", "home", "study"].includes(category)) return errorResponse("Выберите категорию.");
    const id = crypto.randomUUID();
    const now = Date.now();
    await getRawDb().prepare("INSERT INTO tasks (id, owner_id, title, description, category, price, address, lat, lng, urgent, commission_rate, created_at, district) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, user.id, title, description, category, Math.round(price), address, lat, lng, urgent ? 1 : 0, urgent ? 12 : 7, now, district).run();
    return json({ id }, { status: 201 });
  } catch (error) { console.error("tasks post", error); return errorResponse("Не удалось разместить объявление.", 500); }
}
