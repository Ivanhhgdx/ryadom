import { errorResponse, getCurrentUser, getRawDb, json } from "@/lib/server";
import { getPushKeys, validPushEndpoint } from "@/lib/push";

export async function GET(request: Request) {
  if (!await getCurrentUser(request)) return errorResponse("Войдите в аккаунт.", 401);
  const keys = await getPushKeys();
  return json({ publicKey: keys.publicKey });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const data = await request.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  if (!data || typeof data.endpoint !== "string" || !validPushEndpoint(data.endpoint) || data.endpoint.length > 2048 ||
      !/^[A-Za-z0-9_-]{80,200}$/.test(data.keys?.p256dh || "") || !/^[A-Za-z0-9_-]{15,80}$/.test(data.keys?.auth || "")) return errorResponse("Не удалось подключить уведомления.");
  await getPushKeys();
  await getRawDb().prepare("INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at")
    .bind(data.endpoint, user.id, data.keys!.p256dh, data.keys!.auth, Date.now()).run();
  return json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const data = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (typeof data?.endpoint !== "string") return errorResponse("Некорректная подписка.");
  await getRawDb().prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").bind(data.endpoint, user.id).run();
  return json({ ok: true });
}
