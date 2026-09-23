import { NextResponse, type NextRequest } from "next/server";
import { MAX_PHOTO_BYTES } from "./lib/photo";
export function middleware(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) return NextResponse.json({ error: "Запрос с другого сайта запрещён." }, { status: 403 });
    if (Number(request.headers.get("content-length") || 0) > MAX_PHOTO_BYTES) return NextResponse.json({ error: "Файл слишком большой." }, { status: 413 });
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/api/:path*"] };
