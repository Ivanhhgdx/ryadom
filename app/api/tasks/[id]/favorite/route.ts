import { errorResponse, getCurrentUser, getRawDb, json } from "../../../../../lib/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы сохранять объявления.", 401);
  const { id } = await params;
  await getRawDb().prepare("INSERT OR IGNORE INTO favorites (user_id, task_id, created_at) VALUES (?, ?, ?)").bind(user.id, id, Date.now()).run();
  return json({ saved: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы изменять избранное.", 401);
  const { id } = await params;
  await getRawDb().prepare("DELETE FROM favorites WHERE user_id = ? AND task_id = ?").bind(user.id, id).run();
  return json({ saved: false });
}
