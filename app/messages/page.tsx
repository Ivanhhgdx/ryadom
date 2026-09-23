"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Conversation } from "../chat-panel";
import { PushSettings } from "../push-settings";

type Thread = { id: string; taskId: string; taskTitle: string; partnerName: string; preview: string; updatedAt: number; unread: number };
type User = { id: string; fullName: string };

export default function MessagesPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [chats, setChats] = useState<Thread[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("chat");
    if (id && /^[a-f0-9-]{36}$/.test(id)) queueMicrotask(() => setSelected(id));
    void fetch("/api/auth/me").then((response) => response.json() as Promise<{ user: User | null }>).then((data) => setUser(data.user)).catch(() => setUser(null));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/chats");
      if (!response.ok) throw new Error();
      const data = await response.json() as { chats: Thread[] };
      setChats(data.chats); setError("");
    } catch { setError("Не удалось загрузить переписки. Попробуйте ещё раз."); }
  }, []);
  useEffect(() => {
    if (!user) return;
    const start = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(start); clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [user, refresh]);
  const choose = (id: string | null) => {
    setSelected(id);
    window.history.replaceState(null, "", id ? `/messages?chat=${encodeURIComponent(id)}` : "/messages");
  };

  return <div className="messages-page"><header className="messages-header"><Link href="/" className="messages-back" aria-label="К объявлениям"><ArrowLeft size={19} />К объявлениям</Link><Link href="/" className="brand"><img src="/ryadom-logo.png" alt="" width="38" height="38" /><b>рядом</b></Link></header><main className="messages-layout"><aside className={`messages-sidebar ${selected ? "with-selection" : ""}`}><div className="messages-heading"><h1>Сообщения</h1><p>Переписки по объявлениям</p></div>{user && <PushSettings userId={user.id} />}{error && <p className="field-error" role="alert">{error} <button onClick={() => void refresh()}>Повторить</button></p>}{user === undefined ? <p className="messages-state">Загружаем…</p> : !user ? <div className="messages-state"><p>Войдите в аккаунт, чтобы открыть переписки.</p><Link href="/" className="primary-button">На главную</Link></div> : chats.length ? <div className="messages-threads">{chats.map((chat) => <button key={chat.id} className={`chat-thread ${selected === chat.id ? "selected" : ""}`} onClick={() => choose(chat.id)}><span className="chat-avatar">{chat.partnerName.slice(0, 1)}</span><span><strong>{chat.partnerName}</strong><b>{chat.taskTitle}</b><small>{chat.preview}</small></span><span className="chat-thread-meta"><time>{new Date(chat.updatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</time>{chat.unread > 0 && <i>{chat.unread}</i>}</span></button>)}</div> : !error && <div className="messages-state"><MessageCircle size={26} /><h2>Пока нет переписок</h2><p>Чат появится, когда вы откликнетесь на задачу или получите отклик.</p></div>}</aside><section className={`messages-conversation ${selected ? "with-selection" : ""}`}>{user && selected ? <Conversation key={selected} id={selected} userId={user.id} onRead={refresh} onBack={() => { choose(null); void refresh(); }} onTask={(id) => { window.location.href = `/?task=${encodeURIComponent(id)}`; }} /> : <div className="messages-placeholder"><MessageCircle size={31} /><h2>Выберите переписку</h2><p>Ваши сообщения появятся здесь.</p></div>}</section></main></div>;
}
