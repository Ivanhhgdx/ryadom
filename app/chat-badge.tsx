"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

export function ChatBadge({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/chats");
        if (!response.ok) return;
        const data = await response.json() as { chats: { unread: number }[] };
        if (active) setUnread(data.chats.reduce((sum, chat) => sum + Number(chat.unread), 0));
      } catch { /* Keep the last known count while offline. */ }
    };
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [userId]);
  return <Link className="icon-button notification-button" aria-label={`Сообщения${unread ? `, ${unread} непрочитанных` : ""}`} href="/messages"><MessageCircle size={21} />{unread > 0 && <span className="notification-count">{unread > 99 ? "99+" : unread}</span>}</Link>;
}
