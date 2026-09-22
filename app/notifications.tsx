"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
type Notice = { id: string; taskId: string; taskTitle: string; message: string; createdAt: number; readAt: number | null };

export function Notifications({ userId, onTask, inline = false }: { userId: string; onTask: (id: string) => void; inline?: boolean }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Не удалось загрузить уведомления");
      const data = await response.json() as { notifications: Notice[]; unreadCount: number };
      setNotices(data.notifications); setUnread(data.unreadCount); setError("");
    } catch { setError("Не удалось загрузить уведомления. Повторим автоматически."); }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    const focus = () => void refresh(); window.addEventListener("focus", focus);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [refresh, userId]);

  async function read(notice: Notice) {
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notice.id }) });
      if (!response.ok) throw new Error();
      setOpen(false); await refresh(); onTask(notice.taskId);
    } catch { setError("Не удалось открыть уведомление. Попробуйте ещё раз."); }
  }
  const content = <div className="notice-list">{error && <p role="status">{error}</p>}{notices.length ? notices.map((notice) => <button className={`notice-item ${notice.readAt ? "" : "unread"}`} key={notice.id} onClick={() => void read(notice)}><span className="notice-symbol"><Bell size={18} /></span><span><strong>{notice.message}</strong><span>{notice.taskTitle}</span><small>{new Date(notice.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></span>{!notice.readAt && <i aria-label="Непрочитанное" />}</button>) : <p className="notice-empty">Здесь появятся отклики на ваши объявления, выбор исполнителя и завершение задач.</p>}</div>;
  if (inline) return <section className="profile-section"><h3>Уведомления {unread > 0 && <span>{unread} новых</span>}</h3>{content}</section>;
  return <><button className="icon-button notification-button" aria-label={`Уведомления${unread ? `, ${unread} новых` : ""}`} onClick={() => { setOpen(true); void refresh(); }}><Bell size={21} />{unread > 0 && <span className="notification-count">{unread > 99 ? "99+" : unread}</span>}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent showCloseButton={false} className="market-dialog notification-dialog" aria-describedby={undefined}><button className="modal-close" aria-label="Закрыть уведомления" onClick={() => setOpen(false)}><X size={20} /></button><div className="modal-content"><DialogTitle>Уведомления</DialogTitle><p className="modal-lead">Обновляются, пока сайт открыт.</p>{content}</div></DialogContent></Dialog></>;
}
