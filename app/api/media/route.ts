import { env } from "cloudflare:workers";
import { errorResponse, getCurrentUser, getRawDb, json } from "@/lib/server";
import { allowAction, getChat } from "@/lib/chat";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return errorResponse("Войдите, чтобы загрузить фотографию.", 401);
    if (!await allowAction(`media:${user.id}`, 40, 3600000)) return errorResponse("Лимит загрузок за час исчерпан. Попробуйте позже.", 429);
    const form = await request.formData();
    const purpose = form.get("purpose");
    const applicationId = form.get("applicationId");
    if (purpose !== "task" && purpose !== "chat") return errorResponse("Укажите назначение фотографии.");
    if (purpose === "chat" && (typeof applicationId !== "string" || !await getChat(applicationId, user.id))) return errorResponse("Чат недоступен.", 403);
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0 || file.size > 3 * 1024 * 1024) return errorResponse("Выберите JPEG, PNG или WebP до 3 МБ.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg" : bytes.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i]) && bytes.length > 24 ? "image/png" : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP" ? "image/webp" : null;
    if (!mime) return errorResponse("Формат файла не поддерживается. Используйте JPEG, PNG или WebP.");
    const id = crypto.randomUUID();
    const bucket = (env as unknown as { BUCKET: R2Bucket }).BUCKET;
    await bucket.put(`media/${id}`, bytes, { httpMetadata: { contentType: mime } });
    try {
      await getRawDb().prepare("INSERT INTO media (id, owner_id, purpose, application_id, mime, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, user.id, purpose, purpose === "chat" ? applicationId : null, mime, Date.now()).run();
    } catch (error) { await bucket.delete(`media/${id}`); throw error; }
    return json({ id, url: `/api/media/${id}` }, { status: 201 });
  } catch (error) { console.error("media upload", error); return errorResponse("Не удалось загрузить фото. Попробуйте ещё раз.", 500); }
}
