import { getRawDb } from "./server";
export type Chat = { id: string; taskId: string; taskTitle: string; ownerId: string; applicantId: string; ownerName: string; applicantName: string; status: string; price: number; message: string };
export async function getChat(id: string, userId: string) {
  return getRawDb().prepare(`SELECT a.id, a.task_id AS taskId, a.applicant_id AS applicantId, a.status, a.message, t.title AS taskTitle, t.owner_id AS ownerId, t.price, o.full_name AS ownerName, u.full_name AS applicantName FROM applications a JOIN tasks t ON t.id = a.task_id JOIN users o ON o.id = t.owner_id JOIN users u ON u.id = a.applicant_id WHERE a.id = ? AND (t.owner_id = ? OR a.applicant_id = ?)`).bind(id, userId, userId).first<Chat>();
}
export async function allowAction(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const row = await getRawDb().prepare("INSERT INTO auth_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING count").bind(key, now + windowMs, now, now).first<{ count: number }>();
  return !!row && row.count <= limit;
}
