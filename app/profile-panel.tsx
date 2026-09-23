"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Camera, Check, Loader2, Star, UserRound } from "lucide-react";
import { Notifications } from "./notifications";
import { AvatarEditor } from "./avatar-editor";
import { MAX_PHOTO_BYTES } from "@/lib/photo";

type Profile = { id: string; login: string; fullName: string; bio: string; avatarUrl: string | null; rating: number | null; reviewCount: number; completed: number; createdAt: number; reviews: Array<{ id: string; rating: number; message: string; authorName: string }>; tasks: Array<{ id: string; title: string; price: number }> };
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос");
  return data;
}

export function ProfilePanel({ id, own, onSaved, onTask, onLogout }: { id: string; own: boolean; onSaved: (name: string) => void; onTask: (id: string) => void; onLogout?: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  useEffect(() => {
    let active = true;
    void request<{ profile: Profile }>(`/api/profiles/${id}`).then((data) => { if (active) setProfile(data.profile); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false);
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName")); const bio = String(form.get("bio"));
    try {
      await request(`/api/profiles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, bio }) });
      setProfile((current) => current && { ...current, fullName, bio });
      onSaved(fullName); setEditing(false); setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось сохранить"); }
    finally { setBusy(false); }
  }

  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("photo", file);
      const data = await request<{ avatarUrl: string }>("/api/profile/avatar", { method: "POST", body: form });
      setProfile((current) => current && { ...current, avatarUrl: data.avatarUrl }); setSaved(true); setAvatarFile(null);
    } catch (err) { throw err instanceof Error ? err : new Error("Не удалось загрузить фотографию"); }
    finally { setBusy(false); }
  }

  function selectAvatar(file: File | undefined) {
    if (!file) return;
    setSaved(false); setError("");
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) { setError("Выберите фотографию до 100 МБ."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Поддерживаются JPEG, PNG и WebP."); return; }
    setAvatarFile(file);
  }

  if (!profile) return <div className="modal-content">{error ? <p role="alert">{error}</p> : <Loader2 className="spin" aria-label="Загрузка профиля" />}</div>;
  return <div className="modal-content profile-content">
    <div className="profile-cover" />
    <div className="profile-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt={`Фото ${profile.fullName}`} /> : <UserRound size={42} strokeWidth={1.4} />}</div>
    {own && <label className="photo-upload"><Camera size={16} />Изменить фото<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { selectAvatar(event.target.files?.[0]); event.target.value = ""; }} /><small>JPEG, PNG или WebP, до 100 МБ. Фото будет публичным.</small></label>}
    {avatarFile && <AvatarEditor file={avatarFile} busy={busy} onCancel={() => setAvatarFile(null)} onSave={upload} />}
    <h2>{profile.fullName}</h2><p className="profile-login">@{profile.login} · Красноярск</p>
    <div className="profile-stats"><div><b><Star size={18} fill={profile.rating ? "#ffbd16" : "none"} color={profile.rating ? "#d99e00" : "#9ba3ad"} />{profile.rating ? profile.rating.toFixed(1) : "—"}</b><span>{profile.reviewCount ? `${profile.reviewCount} отзывов` : "Нет оценок"}</span></div><div><b>{profile.completed}</b><span>Завершено задач</span></div><div><b>{new Date(profile.createdAt).getFullYear()}</b><span>На Рядом с</span></div></div>
    {error && <p className="inline-error" role="alert">{error}</p>}{saved && <p className="save-success" role="status"><Check size={16} /> Изменения сохранены</p>}
    {editing ? <form className="modal-form" onSubmit={save}><label>Имя и фамилия<input name="fullName" defaultValue={profile.fullName} minLength={2} maxLength={100} required /></label><label>О себе<textarea name="bio" defaultValue={profile.bio} maxLength={1000} placeholder="Чем занимаетесь и с какими задачами можете помочь" /></label><button className="primary-button" disabled={busy}>Сохранить</button><button className="reset-link" type="button" onClick={() => setEditing(false)}>Отмена</button></form> : <><div className="profile-bio"><h3>О себе</h3><p>{profile.bio || (own ? "Расскажите о своих навыках и опыте." : "Пользователь пока не добавил описание.")}</p></div>{own && <button className="secondary-button" onClick={() => { setEditing(true); setSaved(false); }}>Редактировать профиль</button>}</>}
    {own && <Notifications userId={id} onTask={onTask} inline />}
    <section className="profile-section"><h3>Отзывы <span>{profile.reviewCount}</span></h3>{profile.reviews.length ? profile.reviews.map((review) => <article className="review-card" key={review.id}><strong>{review.authorName}</strong><div className="rating-stars" aria-label={`${review.rating} из 5`}>{[1,2,3,4,5].map((value) => <Star key={value} size={16} fill={value <= review.rating ? "currentColor" : "none"} />)}</div><p>{review.message}</p><small>По завершённой задаче</small></article>) : <p>Отзывов пока нет. Оценки появляются после завершения совместной задачи.</p>}</section>
    <section className="profile-section"><h3>Объявления</h3>{profile.tasks.length ? profile.tasks.map((task) => <button className="profile-task" key={task.id} onClick={() => onTask(task.id)}><span>{task.title}</span><b>{task.price ? `${task.price.toLocaleString("ru-RU")} ₽` : "Договорная"}</b></button>) : <p>Пока нет объявлений.</p>}</section>
    {own && onLogout && <button className="secondary-button profile-logout" onClick={onLogout}>Выйти из аккаунта</button>}
  </div>;
}

export function ReviewForm({ taskId }: { taskId: string }) {
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { await request(`/api/tasks/${taskId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, message: form.get("message") }) }); setDone(true); setResult("Спасибо! Отзыв опубликован в профиле."); }
    catch (err) { setResult(err instanceof Error ? err.message : "Не удалось отправить отзыв"); }
    finally { setBusy(false); }
  }
  return <section className="review-form"><h3>Как прошла работа?</h3>{done ? <p role="status">{result}</p> : <form className="modal-form" onSubmit={submit}><div className="rating-picker" role="group" aria-label="Оценка">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`${value} из 5`} aria-pressed={rating === value} onClick={() => setRating(value)}><Star size={27} fill={value <= rating ? "currentColor" : "none"} /></button>)}</div><label>Отзыв<textarea name="message" minLength={4} maxLength={2000} required placeholder="Расскажите о совместной работе" /></label><button className="primary-button" disabled={busy}>Опубликовать отзыв</button>{result && <p role="status">{result}</p>}</form>}</section>;
}
