import { MAX_PHOTO_BYTES } from "./photo";

export type UploadedPhoto = { id: string; url: string };

async function createPreview(file: File): Promise<Blob | null> {
  let image: ImageBitmap | HTMLImageElement | undefined;
  let objectUrl: string | null = null;
  try {
    if ("createImageBitmap" in window) image = await createImageBitmap(file);
    else {
      objectUrl = URL.createObjectURL(file);
      const element = new Image();
      element.src = objectUrl;
      await element.decode();
      image = element;
    }
    const bitmap = typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap;
    const width = bitmap ? image.width : (image as HTMLImageElement).naturalWidth;
    const height = bitmap ? image.height : (image as HTMLImageElement).naturalHeight;
    const scale = Math.min(1, 720 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.76));
  } finally {
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadPhoto(file: File, purpose: "task" | "chat", applicationId?: string): Promise<UploadedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Фото должно быть не больше 100 МБ.");
  const params = new URLSearchParams({ purpose });
  if (applicationId) params.set("applicationId", applicationId);
  const preview = createPreview(file).catch(() => null);
  const response = await fetch(`/api/media?${params}`, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  const result = await response.json() as UploadedPhoto & { error?: string };
  if (!response.ok) throw new Error(result.error || "Не удалось загрузить фото.");
  const thumbnail = await preview;
  if (thumbnail) await fetch(`/api/media/${result.id}/preview`, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: thumbnail }).catch(() => undefined);
  return { id: result.id, url: `/api/media/${result.id}?preview=1` };
}
