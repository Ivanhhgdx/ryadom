"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, Send, ShieldAlert, X } from "lucide-react";
import { uploadPhoto } from "@/lib/photo-client";
type Message = { id: number; senderId: string; body: string; mediaId: string | null; createdAt: number };
type Chat = { id: string; taskId: string; taskTitle: string; ownerId: string; applicantId: string; ownerName: string; applicantName: string; message: string; price: number; status: string };
type Page = { chat: Chat; messages: Message[]; hasMore: boolean };
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Не удалось загрузить сообщения.");
  return data;
}
export function Conversation({ id, userId, onBack, onTask, onRead }: { id: string; userId: string; onBack: () => void; onTask: (id: string) => void; onRead: () => Promise<void> }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [older, setOlder] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef(0);
  const loaded = useRef(false);
  const fetching = useRef(false);
  const nonce = useRef<string | null>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(true);
  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const data = await request<Page>(`/api/chats/${id}${loaded.current ? `?after=${cursor.current || 0}` : ""}`);
      setChat(data.chat);
      if (!loaded.current) setHasMore(data.hasMore);
      loaded.current = true;
      if (data.messages.length) {
        cursor.current = Math.max(cursor.current, ...data.messages.map((m) => m.id));
        setMessages((current) => [...new Map([...current, ...data.messages].map((m) => [m.id, m])).values()].sort((a, b) => a.id - b.id));
      }
      if (!document.hidden && shouldScroll.current) {
        await request(`/api/chats/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lastReadId: cursor.current }) });
        void onRead();
      }
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Нет связи. Пробуем подключиться снова."); }
    finally { fetching.current = false; }
  }, [id, onRead]);
  useEffect(() => {
    const start = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 3000);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { if (shouldScroll.current && timeline.current) timeline.current.scrollTop = timeline.current.scrollHeight; }, [messages, chat]);
  async function loadOlder() {
    if (!messages.length) return;
    setOlder(true); const height = timeline.current?.scrollHeight || 0;
    try {
      const data = await request<Page>(`/api/chats/${id}?before=${messages[0].id}`);
      shouldScroll.current = false; setHasMore(data.hasMore);
      setMessages((current) => [...new Map([...data.messages, ...current].map((m) => [m.id, m])).values()].sort((a, b) => a.id - b.id));
      requestAnimationFrame(() => { if (timeline.current) timeline.current.scrollTop += timeline.current.scrollHeight - height; });
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить историю."); }
    finally { setOlder(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if ((!draft.trim() && !photo) || sending || uploading) return;
    setSending(true); setError(""); nonce.current ||= crypto.randomUUID();
    try {
      await request(`/api/chats/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft, mediaId: photo?.id, clientId: nonce.current }) });
      setDraft(""); setPhoto(null); nonce.current = null; shouldScroll.current = true; await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Не отправлено. Попробуйте ещё раз."); }
    finally { setSending(false); }
  }
  return <div className="conversation"><header className="conversation-head"><button className="icon-button" aria-label="Все переписки" onClick={onBack}><ArrowLeft size={20} /></button><div><strong>{chat ? chat.ownerId === userId ? chat.applicantName : chat.ownerName : "Загружаем чат…"}</strong>{chat && <button onClick={() => onTask(chat.taskId)}>{chat.taskTitle}</button>}</div></header>
    <div className="chat-payment-note"><ShieldAlert size={18} /><span><strong>Оплата через сервис не подключена</strong>Деньги не резервируются и не списываются. Выбор исполнителя не означает оплату. Не отправляйте данные карты в чат.</span></div>
    <div className="chat-timeline" ref={timeline} onScroll={() => { const el = timeline.current; if (el) shouldScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70; }} aria-label="История переписки">
      {hasMore && <button className="older-messages" disabled={older} onClick={() => void loadOlder()}>{older ? "Загрузка…" : "Предыдущие сообщения"}</button>}
      {chat && !hasMore && <div className="chat-initial"><small>Отклик на объявление</small><p>{chat.message}</p></div>}
      {messages.map((m) => <div className={`chat-message ${m.senderId === userId ? "own" : ""} ${m.mediaId ? "has-photo" : ""}`} key={m.id}>{m.mediaId && <a href={`/api/media/${m.mediaId}`} target="_blank" rel="noreferrer"><img src={`/api/media/${m.mediaId}?preview=1`} alt="Фотография в переписке" onLoad={() => { if (shouldScroll.current && timeline.current) timeline.current.scrollTop = timeline.current.scrollHeight; }} /></a>}{m.body && <p>{m.body}</p>}<time>{new Date(m.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>)}
      {chat && !messages.length && <p className="chat-start">Уточните детали задачи. Переписку видите только вы и собеседник.</p>}
    </div>
    {error && <p className="field-error chat-error" role="alert">{error}</p>}
    <form className="chat-compose" onSubmit={send}>{photo && <div className="chat-attachment"><img src={photo.url} alt="Фото к отправке" /><button type="button" aria-label="Убрать фото" disabled={sending} onClick={() => { setPhoto(null); nonce.current = null; }}><X size={16} /></button></div>}<div className="chat-compose-row"><label className="chat-upload" aria-label="Прикрепить фотографию">{uploading ? <Loader2 className="spin" size={22} /> : <ImagePlus size={22} />}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || sending || !!photo || !chat} onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setUploading(true); setError(""); try { setPhoto(await uploadPhoto(file, "chat", id)); nonce.current = null; } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить фото"); } finally { setUploading(false); } }} /></label><textarea aria-label="Сообщение" placeholder="Напишите сообщение…" maxLength={4000} value={draft} disabled={sending} onChange={(e) => { setDraft(e.target.value); nonce.current = null; }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><button className="primary-button" aria-label="Отправить сообщение" disabled={!chat || sending || uploading || (!draft.trim() && !photo)}>{sending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}</button></div><small>Фото до 100 МБ · Enter — отправить, Shift+Enter — новая строка</small></form>
  </div>;
}
