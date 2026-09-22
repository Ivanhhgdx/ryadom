"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, MessageCircle, Send, ShieldAlert, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { uploadPhoto } from "./task-create";
type Thread = { id: string; taskId: string; taskTitle: string; partnerName: string; status: string; preview: string; updatedAt: number; unread: number };
type Message = { id: number; senderId: string; body: string; mediaId: string | null; createdAt: number };
type Chat = { id: string; taskId: string; taskTitle: string; ownerId: string; applicantId: string; ownerName: string; applicantName: string; message: string; price: number; status: string };
type Page = { chat: Chat; messages: Message[]; hasMore: boolean };
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Не удалось загрузить сообщения.");
  return data;
}
export function ChatInbox({ userId, target, onTarget, onTask }: { userId: string; target: string | null; onTarget: (id: string | null) => void; onTask: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Thread[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const data = await request<{ chats: Thread[] }>("/api/chats"); setChats(data.chats); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Сообщения недоступны."); }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    const initial = setTimeout(() => void refresh(), 0);
    const onFocus = () => void refresh(); window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); clearTimeout(initial); window.removeEventListener("focus", onFocus); };
  }, [refresh, userId]);
  const unread = chats.reduce((sum, chat) => sum + Number(chat.unread), 0);
  return <><button className="icon-button notification-button" aria-label={`Сообщения${unread ? `, ${unread} непрочитанных` : ""}`} onClick={() => { setOpen(true); void refresh(); }}><MessageCircle size={21} />{unread > 0 && <span className="notification-count">{unread > 99 ? "99+" : unread}</span>}</button><Dialog open={open || !!target} onOpenChange={(value) => { if (!value) { setOpen(false); onTarget(null); void refresh(); } }}><DialogContent showCloseButton={false} className="market-dialog chat-dialog" aria-describedby={undefined}><DialogTitle className="sr-only">Сообщения по объявлениям</DialogTitle><button className="modal-close" aria-label="Закрыть сообщения" onClick={() => { setOpen(false); onTarget(null); void refresh(); }}><X size={20} /></button>
    {target ? <Conversation key={target} id={target} userId={userId} onRead={refresh} onBack={() => { onTarget(null); setOpen(true); void refresh(); }} onTask={(id) => { onTarget(null); setOpen(false); onTask(id); }} /> : <div className="modal-content"><h2>Сообщения</h2><p className="modal-lead">Договоритесь о деталях в чате по задаче.</p>{error && <p role="alert" className="field-error">{error}<button onClick={() => void refresh()}>Повторить</button></p>}<div className="chat-inbox">{chats.length ? chats.map((chat) => <button key={chat.id} className="chat-thread" onClick={() => onTarget(chat.id)}><span className="chat-avatar">{chat.partnerName.slice(0, 1)}</span><span><strong>{chat.partnerName}</strong><b>{chat.taskTitle}</b><small>{chat.preview}</small></span><span className="chat-thread-meta"><time>{new Date(chat.updatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</time>{chat.unread > 0 && <i>{chat.unread}</i>}</span></button>) : !error && <div className="empty-state"><MessageCircle /><h3>Пока нет переписок</h3><p>Чат появится, когда вы откликнетесь на задачу или получите отклик.</p></div>}</div></div>}
  </DialogContent></Dialog></>;
}
function Conversation({ id, userId, onBack, onTask, onRead }: { id: string; userId: string; onBack: () => void; onTask: (id: string) => void; onRead: () => Promise<void> }) {
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
      {messages.map((m) => <div className={`chat-message ${m.senderId === userId ? "own" : ""}`} key={m.id}>{m.mediaId && <a href={`/api/media/${m.mediaId}`} target="_blank" rel="noreferrer"><img src={`/api/media/${m.mediaId}`} alt="Фотография в переписке" onLoad={() => { if (shouldScroll.current && timeline.current) timeline.current.scrollTop = timeline.current.scrollHeight; }} /></a>}{m.body && <p>{m.body}</p>}<time>{new Date(m.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>)}
      {chat && !messages.length && <p className="chat-start">Уточните детали задачи. Переписку видите только вы и собеседник.</p>}
    </div>
    {error && <p className="field-error chat-error" role="alert">{error}</p>}
    <form className="chat-compose" onSubmit={send}>{photo && <div className="chat-attachment"><img src={photo.url} alt="Фото к отправке" /><button type="button" aria-label="Убрать фото" disabled={sending} onClick={() => { setPhoto(null); nonce.current = null; }}><X size={16} /></button></div>}<div className="chat-compose-row"><label className="chat-upload" aria-label="Прикрепить фотографию">{uploading ? <Loader2 className="spin" size={22} /> : <ImagePlus size={22} />}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || sending || !!photo || !chat} onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setUploading(true); setError(""); try { setPhoto(await uploadPhoto(file, "chat", id)); nonce.current = null; } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить фото"); } finally { setUploading(false); } }} /></label><textarea aria-label="Сообщение" placeholder="Напишите сообщение…" maxLength={4000} value={draft} disabled={sending} onChange={(e) => { setDraft(e.target.value); nonce.current = null; }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><button className="primary-button" aria-label="Отправить сообщение" disabled={!chat || sending || uploading || (!draft.trim() && !photo)}>{sending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}</button></div><small>Фото до 3 МБ · Enter — отправить, Shift+Enter — новая строка</small></form>
  </div>;
}
