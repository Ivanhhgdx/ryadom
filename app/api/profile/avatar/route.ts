import { env } from "cloudflare:workers";
import { errorResponse, getCurrentUser, getRawDb, json } from "../../../../lib/server";

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы загрузить фотографию.", 401);
  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size > 3 * 1024 * 1024 || file.size === 0) return errorResponse("Выберите фотографию до 3 МБ.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg" : bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ? "image/png" : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP" ? "image/webp" : null;
  if (!mime) return errorResponse("Поддерживаются фотографии JPEG, PNG и WebP.");
  const bucket = (env as unknown as { BUCKET: R2Bucket }).BUCKET;
  const key = `${user.id}-${crypto.randomUUID()}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: mime } });
  await getRawDb().prepare("UPDATE users SET avatar_key = ? WHERE id = ?").bind(key, user.id).run();
  return json({ avatarUrl: `/api/avatars/${key}` });
}
