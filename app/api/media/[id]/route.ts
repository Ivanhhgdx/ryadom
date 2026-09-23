import { env } from "cloudflare:workers";
import { errorResponse, getCurrentUser, getRawDb } from "@/lib/server";
import { getChat } from "@/lib/chat";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getRawDb().prepare("SELECT owner_id AS ownerId, purpose, task_id AS taskId, application_id AS applicationId, mime FROM media WHERE id = ?").bind(id).first<{ ownerId: string; purpose: string; taskId: string | null; applicationId: string | null; mime: string }>();
  if (!row) return errorResponse("Фотография не найдена.", 404);
  const isPublic = row.purpose === "task" && !!row.taskId;
  if (!isPublic) {
    const user = await getCurrentUser(request);
    if (!user) return errorResponse("Войдите в аккаунт.", 401);
    if (user.id !== row.ownerId) {
      if (!row.applicationId || !await getChat(row.applicationId, user.id) || !await getRawDb().prepare("SELECT id FROM messages WHERE media_id = ?").bind(id).first()) return errorResponse("Фотография недоступна.", 403);
    }
  }
  const bucket = (env as unknown as { BUCKET: R2Bucket }).BUCKET;
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const thumbnail = preview ? await bucket.get(`media/previews/${id}`) : null;
  const object = thumbnail || await bucket.get(`media/${id}`);
  if (!object) return errorResponse("Фотография не найдена.", 404);
  return new Response(object.body, { headers: { "Content-Type": thumbnail ? "image/jpeg" : row.mime, "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}
