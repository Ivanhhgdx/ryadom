import { env } from "cloudflare:workers";
import { errorResponse, getCurrentUser, getRawDb, json } from "@/lib/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите в аккаунт.", 401);
  const { id } = await params;
  const row = await getRawDb().prepare("SELECT id FROM media WHERE id = ? AND owner_id = ?").bind(id, user.id).first();
  if (!row) return errorResponse("Фотография не найдена.", 404);
  const size = Number(request.headers.get("Content-Length"));
  if (request.headers.get("Content-Type") !== "image/jpeg" || !Number.isSafeInteger(size) || size < 4 || size > 2_000_000) return errorResponse("Некорректное превью.");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length !== size || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return errorResponse("Некорректное превью.");
  await (env as unknown as { BUCKET: R2Bucket }).BUCKET.put(`media/previews/${id}`, bytes, { httpMetadata: { contentType: "image/jpeg" } });
  return json({ ok: true });
}
