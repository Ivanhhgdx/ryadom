import { errorResponse, getCurrentUser, getRawDb, json } from "@/lib/server";
import { allowAction } from "@/lib/chat";
import { districts } from "@/lib/districts";
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const address = new URL(request.url).searchParams.get("address")?.trim() || "";
  if (address.length < 3 || address.length > 250) return errorResponse("Введите улицу и номер дома.");
  const query = address.toLocaleLowerCase("ru");
  const db = getRawDb();
  const cached = await db.prepare("SELECT result FROM geocode_cache WHERE query = ? AND created_at > ?").bind(query, Date.now() - 7 * 86400000).first<{ result: string }>();
  if (cached) return json(JSON.parse(cached.result));
  if (!await allowAction("geocode:global", 1, 1200)) return errorResponse("Подождите пару секунд и повторите поиск адреса.", 429);
  try {
    const params = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "1", countrycodes: "ru", bounded: "1", viewbox: "92.5,56.3,93.3,55.8", q: `Красноярск, ${address}` });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": "Ryadom/1.0 (https://ryadom.ivanfomin2003.chatgpt.site)", "Accept-Language": "ru" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return errorResponse("Поиск адресов временно недоступен. Попробуйте позже.", 503);
    const rows = await response.json() as Array<{ lat: string; lon: string; display_name: string; address?: Record<string, string> }>;
    if (!rows.length) return errorResponse("Адрес не найден в Красноярске. Уточните улицу и дом.", 404);
    const row = rows[0];
    const districtText = [row.address?.city_district, row.address?.borough, row.address?.suburb, row.display_name].filter(Boolean).join(" ");
    const district = districts.find((name) => districtText.toLocaleLowerCase("ru").includes(name.toLocaleLowerCase("ru"))) || null;
    const result = { lat: Number(row.lat), lng: Number(row.lon), district, label: row.display_name };
    if (!Number.isFinite(result.lat) || !Number.isFinite(result.lng)) return errorResponse("Не удалось определить координаты.", 503);
    await db.prepare("INSERT INTO geocode_cache (query, result, created_at) VALUES (?, ?, ?) ON CONFLICT(query) DO UPDATE SET result = excluded.result, created_at = excluded.created_at").bind(query, JSON.stringify(result), Date.now()).run();
    return json(result);
  } catch { return errorResponse("Не удалось проверить адрес. Попробуйте ещё раз.", 503); }
}
