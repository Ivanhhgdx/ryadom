import { errorResponse, getCurrentUser, getRawDb, json } from "@/lib/server";
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Войдите, чтобы открыть сообщения.", 401);
  const result = await getRawDb().prepare(`SELECT a.id, a.task_id AS taskId, a.status, t.title AS taskTitle, CASE WHEN t.owner_id = ? THEN u.full_name ELSE o.full_name END AS partnerName, COALESCE((SELECT NULLIF(m.body, '') FROM messages m WHERE m.application_id = a.id ORDER BY m.id DESC LIMIT 1), 'Фотография или отклик') AS preview, COALESCE((SELECT m.created_at FROM messages m WHERE m.application_id = a.id ORDER BY m.id DESC LIMIT 1), a.created_at) AS updatedAt, (SELECT COUNT(*) FROM messages m WHERE m.application_id = a.id AND m.sender_id != ? AND m.id > COALESCE(r.last_read_id, 0)) AS unread FROM applications a JOIN tasks t ON t.id = a.task_id JOIN users u ON u.id = a.applicant_id JOIN users o ON o.id = t.owner_id LEFT JOIN chat_reads r ON r.application_id = a.id AND r.user_id = ? WHERE t.owner_id = ? OR a.applicant_id = ? ORDER BY updatedAt DESC`).bind(user.id, user.id, user.id, user.id, user.id).all();
  return json({ chats: result.results });
}
