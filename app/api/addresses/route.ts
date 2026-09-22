import { errorResponse, getCurrentUser, getRawDb, json } from "@/lib/server";
import { allowAction } from "@/lib/chat";
import { districts } from "@/lib/districts";
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 3) return json({ suggestions: [] });
  if (q.length > 250) return errorResponse("Слишком длинный адрес.");
  const db = getRawDb();
  const key = `suggest:${q.toLocaleLowerCase("ru")}`;
  const cached = await db.prepare("SELECT result FROM geocode_cache WHERE query = ? AND created_at > ?").bind(key, Date.now() - 86400000).first<{ result: string }>();
  if (cached) return json(JSON.parse(cached.result));
  if (!await allowAction(`suggest:${user.id}`, 40, 60000) || !await allowAction("suggest:global", 100, 60000)) return errorResponse("Поиск занят. Повторите через минуту.", 429);
  try {
    const params = new URLSearchParams({ q: `Красноярск ${q.replace(/Красноярск[, ]*/ig, "")}`, bbox: "92.5,55.8,93.3,56.3", lat: "56.0153", lon: "92.8932", limit: "8" });
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Address provider unavailable");
    const data = await response.json() as { features: Array<{ properties: Record<string, string>; geometry: { coordinates: number[] } }> };
    const suggestions = data.features.filter((f) => f.properties.city === "Красноярск" && (f.properties.street || f.properties.type === "street")).map((f) => {
      const p = f.properties;
      const district = districts.find((d) => (p.district || "").includes(d)) || null;
      return { address: [p.street || p.name, p.housenumber].filter(Boolean).join(", "), district, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], house: !!p.housenumber };
    }).filter((p, i, list) => list.findIndex((item) => item.address === p.address) === i).slice(0, 6);
    const result = { suggestions };
    await db.prepare("INSERT INTO geocode_cache (query, result, created_at) VALUES (?, ?, ?) ON CONFLICT(query) DO UPDATE SET result = excluded.result, created_at = excluded.created_at").bind(key, JSON.stringify(result), Date.now()).run();
    return json(result);
  } catch { return errorResponse("Подсказки временно недоступны. Можно проверить полный адрес кнопкой ниже.", 503); }
}
