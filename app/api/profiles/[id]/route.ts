import { errorResponse, getCurrentUser, getRawDb, json } from "../../../../lib/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getRawDb();
  const profile = await db.prepare(`SELECT id, login, full_name AS fullName, bio, avatar_key AS avatarKey, created_at AS createdAt FROM users WHERE id = ?`).bind(id).first();
  if (!profile) return errorResponse("Профиль не найден.", 404);
  const reviews = await db.prepare(`SELECT r.id, r.rating, r.message, r.created_at AS createdAt, u.id AS authorId, u.full_name AS authorName FROM reviews r JOIN users u ON r.reviewer_id = u.id WHERE r.reviewee_id = ? ORDER BY r.created_at DESC`).bind(id).all();
  const stats = await db.prepare(`SELECT COUNT(*) AS completed FROM applications a JOIN tasks t ON t.id = a.task_id WHERE a.status = 'done' AND (a.applicant_id = ? OR t.owner_id = ?)`).bind(id, id).first();
  const tasks = await db.prepare(`SELECT id, title, price FROM tasks WHERE owner_id = ? AND archived_at IS NULL AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20`).bind(id).all();
  return json({ profile: { ...profile, avatarUrl: profile.avatarKey ? `/api/avatars/${encodeURIComponent(String(profile.avatarKey))}` : null, rating: reviews.results.length ? reviews.results.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.results.length : null, reviewCount: reviews.results.length, completed: stats?.completed ?? 0, reviews: reviews.results, tasks: tasks.results } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  const { id } = await params;
  if (!user || user.id !== id) return errorResponse("Можно изменять только свой профиль.", 403);
  const body = await request.json() as { fullName?: string; bio?: string };
  if (typeof body.fullName !== "string" || body.fullName.trim().length < 2 || body.fullName.length > 100 || typeof body.bio !== "string" || body.bio.length > 1000) return errorResponse("Имя: 2–100 символов, описание: до 1000 символов.");
  await getRawDb().prepare("UPDATE users SET full_name = ?, bio = ? WHERE id = ?").bind(body.fullName.trim(), body.bio.trim(), id).run();
  return json({ ok: true });
}
