"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TaskCreate } from "./task-create";
import { ChatInbox } from "./chat-panel";
import { YandexMap } from "./yandex-map";
import { Notifications } from "./notifications";
import { ProfilePanel, ReviewForm } from "./profile-panel";
import { districts } from "@/lib/districts";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle, BookOpen, Check, Grid2X2, Heart, Home as HomeIcon, Loader2, LogOut,
  Map as MapIcon, MapPin, MessageCircle, Package, Plus, Search, Send,
  UserRound, Video, Wrench, X, Zap,
} from "lucide-react";

type User = { id: string; login: string; fullName: string };
type Task = {
  id: string; title: string; description: string; category: string; price: number; address: string;
  workMode: "remote" | "onsite"; coverId?: string; imageIds?: string[];
  lat: number; lng: number; urgent: number | boolean; commissionRate: number; createdAt: number;
  workStatus: "accepted" | "done" | null; district: string | null; ownerId: string; ownerName: string; isFavorite: number | boolean;
};
type AuthMode = "login" | "register";
type Modal = "auth" | "create" | "detail" | "apply" | "profile" | null;
type ViewMode = "all" | "mine" | "saved";

const categories = [
  { id: "all", label: "Все категории", icon: Grid2X2 },
  { id: "delivery", label: "Доставка", icon: Package },
  { id: "digital", label: "Диджитал", icon: Video },
  { id: "repair", label: "Ремонт", icon: Wrench },
  { id: "home", label: "Дом и быт", icon: HomeIcon },
  { id: "study", label: "Учёба", icon: BookOpen },
  { id: "urgent", label: "Срочные", icon: Zap },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error ?? "Что-то пошло не так");
  return data as T;
}

function formatPrice(price: number) { return price ? `${new Intl.NumberFormat("ru-RU").format(price)} ₽` : "Договорная"; }
function formatDate(timestamp: number) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(timestamp)); }
function categoryName(id: string) { return categories.find((category) => category.id === id)?.label ?? "Другое"; }

export default function Marketplace() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [workMode, setWorkMode] = useState("all");
  const [chatTarget, setChatTarget] = useState<string | null>(null);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<ViewMode>("all");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [sort, setSort] = useState("recommended");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const requestSequence = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [applications, setApplications] = useState<Array<{ id: string; message: string; fullName: string; login: string; applicantId: string; status: string }>>([]);
  const [applicationError, setApplicationError] = useState("");
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3400);
  }, []);

  const loadTasks = useCallback(async (nextCategory = category, nextQuery = query, nextView = view, quiet = false) => {
    const sequence = ++requestSequence.current;
    if (!quiet) { setLoading(true); setLoadError(""); }
    const params = new URLSearchParams();
    if (nextCategory !== "all" && nextCategory !== "urgent") params.set("category", nextCategory);
    if (nextCategory === "urgent") params.set("urgent", "1");
    if (nextQuery) params.set("query", nextQuery);
    selectedDistricts.forEach((district) => params.append("district", district));
    if (onlyUrgent) params.set("urgent", "1");
    if (workMode !== "all") params.set("workMode", workMode);
    if (nextView !== "all") params.set("view", nextView);
    try {
      const data = await api<{ tasks: Task[] }>(`/api/tasks?${params}`);
      if (sequence === requestSequence.current) setTasks((current) => JSON.stringify(current) === JSON.stringify(data.tasks) ? current : data.tasks);
    } catch (error) { if (sequence === requestSequence.current) setLoadError(error instanceof Error ? error.message : "Не удалось загрузить объявления"); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [category, query, view, selectedDistricts, onlyUrgent, workMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTasks(), 0);
    const refresh = window.setInterval(() => { if (!document.hidden && !modal) void loadTasks(category, query, view, true); }, 30000);
    return () => { clearTimeout(timer); clearInterval(refresh); };
  }, [loadTasks, modal, category, query, view]);
  useEffect(() => { void api<{ user: User | null }>("/api/auth/me").then((data) => setUser(data.user)).catch(() => undefined); }, []);

  const filteredTasks = useMemo(() => {
    const result = tasks.filter((task) => (minPrice === "" || task.price >= minPrice) && (maxPrice === "" || task.price <= maxPrice));
    return [...result].sort((a, b) => sort === "priceAsc" ? a.price - b.price : sort === "priceDesc" ? b.price - a.price : sort === "newest" ? b.createdAt - a.createdAt : Number(b.urgent) - Number(a.urgent) || b.createdAt - a.createdAt);
  }, [tasks, minPrice, maxPrice, sort]);

  useEffect(() => {
    if (modal !== "detail" || !selectedTask || !user) return;
    let active = true;
    queueMicrotask(() => { if (active) { setApplications([]); setApplicationError(""); setApplicationsLoading(true); } });
    void api<{ applications: typeof applications }>(`/api/tasks/${selectedTask.id}/apply`).then((data) => { if (active) setApplications(data.applications); }).catch(() => { if (active) setApplicationError("Не удалось загрузить отклики. Откройте объявление повторно."); }).finally(() => { if (active) setApplicationsLoading(false); });
    return () => { active = false; };
  }, [modal, selectedTask, user]);

  async function updateApplication(applicationId: string, status: string) {
    if (!selectedTask) return;
    setBusy(true);
    try {
      await api(`/api/tasks/${selectedTask.id}/apply`, { method: "PATCH", body: JSON.stringify({ applicationId, status }) });
      const data = await api<{ applications: typeof applications }>(`/api/tasks/${selectedTask.id}/apply`);
      setApplications(data.applications); notify(status === "done" ? "Задача завершена. Можно оставить отзыв." : "Исполнитель выбран");
    } catch (error) { notify(error instanceof Error ? error.message : "Не удалось обновить статус"); }
    finally { setBusy(false); }
  }

  async function openTask(id: string) {
    try { const data = await api<{ task: Task }>(`/api/tasks/${id}`); setSelectedTask(data.task); setModal("detail"); }
    catch (error) { notify(error instanceof Error ? error.message : "Не удалось открыть объявление"); }
  }

  function openAuth(mode: AuthMode = "login") { setAuthMode(mode); setModal("auth"); }
  function requireAuth(action: () => void) { if (!user) { openAuth(); notify("Сначала войдите или зарегистрируйтесь"); return; } action(); }

  async function toggleFavorite(task: Task) {
    requireAuth(async () => {
      try {
        const saved = Boolean(task.isFavorite);
        await api(`/api/tasks/${task.id}/favorite`, { method: saved ? "DELETE" : "POST" });
        setTasks((current) => view === "saved" && saved ? current.filter((item) => item.id !== task.id) : current.map((item) => item.id === task.id ? { ...item, isFavorite: !saved } : item));
        if (selectedTask?.id === task.id) setSelectedTask({ ...task, isFavorite: !saved });
        notify(saved ? "Убрано из избранного" : "Сохранено в избранное");
      } catch (error) { notify(error instanceof Error ? error.message : "Не удалось изменить избранное"); }
    });
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = await api<{ user: User }>(`/api/auth/${authMode === "register" ? "register" : "login"}`, { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) });
      setUser(data.user); setModal(null); notify(authMode === "register" ? "Аккаунт создан. Добро пожаловать!" : "Вы вошли в Рядом"); await loadTasks();
    } catch (error) { notify(error instanceof Error ? error.message : "Не удалось выполнить вход"); }
    finally { setBusy(false); }
  }

  async function logout() { try { await api("/api/auth/logout", { method: "POST" }); setUser(null); setChatTarget(null); setView("all"); await loadTasks(category, query, "all"); notify("Вы вышли из аккаунта"); } catch { notify("Не удалось выйти. Попробуйте снова."); } }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedTask) return; setBusy(true);
    const form = new FormData(event.currentTarget);
    try { await api(`/api/tasks/${selectedTask.id}/apply`, { method: "POST", body: JSON.stringify({ message: form.get("message") }) }); setApplications([]); setModal("detail"); notify("Отклик отправлен заказчику"); }
    catch (error) { notify(error instanceof Error ? error.message : "Не удалось отправить отклик"); }
    finally { setBusy(false); }
  }

  function chooseCategory(id: string) { setCategory(id); }
  function submitSearch(event: FormEvent) { event.preventDefault(); setQuery(searchInput.trim()); }
  function chooseView(nextView: ViewMode) { if (!user && nextView !== "all") { openAuth(); notify("Войдите, чтобы открыть этот раздел"); return; } setView(nextView); }
  function resetFilters() { setWorkMode("all"); setSelectedDistricts([]); setOnlyUrgent(false); setCategory("all"); setMinPrice(""); setMaxPrice(""); setSort("recommended"); setView("all"); setQuery(""); setSearchInput(""); void loadTasks("all", "", "all"); }

  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="topbar-links"><MapPin size={16} /><span>Поручения и подработка в Красноярске</span></div>
        <div className="topbar-actions"><button className={view === "saved" ? "icon-button active-icon" : "icon-button"} aria-label="Избранное" onClick={() => chooseView("saved")}><Heart size={21} fill={view === "saved" ? "currentColor" : "none"} /></button>{user ? <><ChatInbox key={user.id} userId={user.id} target={chatTarget} onTarget={setChatTarget} onTask={(id) => void openTask(id)} /><Notifications userId={user.id} onTask={(id) => void openTask(id)} /><button className="profile-chip" onClick={() => { setProfileId(user.id); setModal("profile"); }}><span className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>{user.fullName}</button><button className="icon-button" aria-label="Выйти" onClick={logout}><LogOut size={19} /></button></> : <button className="login-link" onClick={() => openAuth()}>Войти и зарегистрироваться</button>}<button className="post-button" onClick={() => requireAuth(() => setModal("create"))}><Plus size={20} /> Разместить объявление</button></div>
      </header>

      <div className="brand-row"><Link className="brand" href="/"><img className="brand-logo" src="/ryadom-logo.png" alt="" width="52" height="52" /><b>рядом</b></Link><form className="global-search" onSubmit={submitSearch}><Search size={21} /><input aria-label="Поиск по объявлениям" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Поиск по объявлениям" /><button type="submit">Найти</button></form><button className="location-label" onClick={() => setShowMap(true)}>{"⌖"} Красноярск</button></div>

      <main className="main-content">
        <div className="breadcrumbs">Главная <span>•</span> Объявления <span>•</span> Красноярск</div>
        <div className="heading-row"><div><h1>Задачи рядом</h1><p>Найди исполнителя или подработку в своём городе.</p></div><div className="view-switch"><button className={view === "all" ? "active" : ""} onClick={() => { setView("all"); void loadTasks(category, query, "all"); }}><ListIcon /> Все объявления</button><button className={view === "mine" ? "active" : ""} onClick={() => chooseView("mine")}>Мои объявления</button></div></div>
        <div className="map-toggle-row"><button className={showMap ? "map-toggle active" : "map-toggle"} onClick={() => { setShowMap((current) => !current);  }}><MapIcon size={17} />{showMap ? "Скрыть карту" : "Открыть карту"}</button></div>
        <div className="category-row">{categories.map(({ id, label, icon: Icon }) => <button key={id} className={category === id ? "category active" : "category"} onClick={() => chooseCategory(id)}><Icon size={19} />{label}</button>)}</div>
        <div className="results-toolbar"><span>{filteredTasks.length ? `${filteredTasks.length} ${plural(filteredTasks.length)} в Красноярске` : "Пока нет объявлений"}</span><span className="toolbar-note">{view === "mine" ? "Ваши объявления" : view === "saved" ? "Сохранённые объявления" : "По дате публикации"}</span></div>
        <div className={showMap ? "workspace-grid" : "workspace-grid no-map"}>
          <aside className={filtersOpen ? "filter-sidebar expanded" : "filter-sidebar"}><div className="filter-head"><h2>Фильтры</h2><button className="mobile-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}>{filtersOpen ? "Свернуть" : "Настроить"}</button><button onClick={resetFilters}>Сбросить</button></div><div className="filter-section"><h3>Категория</h3><div className="filter-category-list">{categories.filter((item) => item.id !== "urgent").map(({ id, label, icon: Icon }) => <button key={id} className={category === id ? "filter-category active" : "filter-category"} onClick={() => chooseCategory(id)}><Icon size={17} /><span>{label}</span>{category === id ? <Check size={16} /> : null}</button>)}</div></div><div className="filter-section"><h3>Формат работы</h3><select aria-label="Формат работы" className="sort-select" value={workMode} onChange={(e) => { setWorkMode(e.target.value); if (e.target.value === "remote") setSelectedDistricts([]); }}><option value="all">Любой формат</option><option value="onsite">На месте</option><option value="remote">Удалённо</option></select></div><div className="filter-section"><h3>Район Красноярска</h3>{workMode === "remote" && <p className="field-hint">Для удалённых задач район не нужен.</p>}<div className="district-list">{districts.map((district) => <label key={district}><input type="checkbox" disabled={workMode === "remote"} checked={selectedDistricts.includes(district)} onChange={(event) => setSelectedDistricts((current) => event.target.checked ? [...current, district] : current.filter((item) => item !== district))} /><span>{district}</span></label>)}</div><label className="urgency-filter"><input type="checkbox" checked={onlyUrgent} onChange={(event) => setOnlyUrgent(event.target.checked)} /><Zap size={16} /> Только срочные</label></div><div className="filter-section"><h3>Цена, ₽</h3><div className="price-fields"><input aria-label="Минимальная цена" type="number" min="0" placeholder="От" value={minPrice} onChange={(event) => setMinPrice(event.target.value ? Number(event.target.value) : "")} /><input aria-label="Максимальная цена" type="number" min="0" placeholder="До" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value ? Number(event.target.value) : "")} /></div></div><div className="filter-section"><h3>Сортировка</h3><select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Рекомендуемые</option><option value="newest">Сначала новые</option><option value="priceAsc">Сначала дешевле</option><option value="priceDesc">Сначала дороже</option></select></div></aside>
          <section className="task-panel"><div className="panel-head"><div><h2>Объявления в Красноярске</h2><span>{filteredTasks.length ? "Обновляются сразу после публикации" : "Разместите первое поручение"}</span></div></div><div className="task-list" aria-busy={loading}>{loading ? <div className="empty-state"><Loader2 className="spin" /><p>Загружаем объявления…</p></div> : loadError ? <div className="empty-state"><AlertCircle /><h3>Не удалось загрузить объявления</h3><p>{loadError}</p><button className="primary-button" onClick={() => void loadTasks()}>Попробовать снова</button></div> : filteredTasks.length ? filteredTasks.map((task) => <article tabIndex={0} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); void openTask(task.id); } }} className={task.urgent ? "task-card urgent" : "task-card"} key={task.id} onClick={() => { void openTask(task.id); }}><div className={task.coverId ? "task-cover" : "task-symbol"}>{task.coverId ? <img src={`/api/media/${task.coverId}`} alt="" loading="lazy" /> : <TaskIcon category={task.category} />}</div><div className="task-card-body"><div className="task-card-top"><div><div className="task-kicker">{categoryName(task.category)} {task.workMode === "remote" && <b className="category-pill">Удалённо</b>} {task.workStatus ? <b className="category-pill">{task.workStatus === "done" ? "Завершено" : "Исполнитель выбран"}</b> : null} {task.urgent ? <b className="urgent-badge">Срочно</b> : null}</div><h3>{task.title}</h3></div><button className={task.isFavorite ? "heart-button saved" : "heart-button"} onClick={(event) => { event.stopPropagation(); void toggleFavorite(task); }} aria-label="Сохранить"><Heart size={21} fill={task.isFavorite ? "currentColor" : "none"} /></button></div><p>{task.description}</p><div className="task-meta"><span><MapPin size={15} />{task.district ? `${task.district} · ` : ""}{task.address}</span><span>{formatDate(task.createdAt)}</span></div><div className="task-footer"><b>{formatPrice(task.price)}</b><button className="card-author" onClick={(event) => { event.stopPropagation(); setProfileId(task.ownerId); setModal("profile"); }}>{task.ownerName}</button></div></div></article>) : <div className="empty-state"><div className="empty-icon"><MapIcon size={27} /></div><h3>{view === "saved" ? "Избранное пока пусто" : query || category !== "all" || minPrice !== "" || maxPrice !== "" ? "Ничего не найдено" : "Пока нет объявлений"}</h3><p>{view === "saved" ? "Нажмите на сердечко у объявления, чтобы сохранить его здесь." : "Попробуйте изменить фильтры или разместите своё поручение."}</p><button className="reset-link" onClick={resetFilters}>Сбросить фильтры</button><button className="primary-button" onClick={() => requireAuth(() => setModal("create"))}><Plus size={18} /> Разместить объявление</button></div>}</div></section>
          {showMap ? <div className="map-panel yandex-panel"><YandexMap tasks={filteredTasks} onTask={(id) => void openTask(id)} /></div> : null}
        </div>
      </main>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
      <Dialog open={modal !== null} onOpenChange={(open) => { if (!open && !busy) setModal(null); }}><DialogContent showCloseButton={false} className={modal === "detail" ? "market-dialog detail-modal" : "market-dialog"} aria-describedby={undefined}><DialogTitle className="sr-only">{modal === "auth" ? "Вход и регистрация" : modal === "create" ? "Новое объявление" : modal === "profile" ? "Профиль пользователя" : selectedTask?.title || "Объявление"}</DialogTitle>
        <button className="modal-close" onClick={() => !busy && setModal(null)} aria-label="Закрыть"><X size={20} /></button>
        {modal === "auth" ? <div className="modal-content"><div className="modal-eyebrow">РЯДОМ</div><h2>{authMode === "login" ? "С возвращением" : "Создать аккаунт"}</h2><p className="modal-lead">{authMode === "login" ? "Войдите, чтобы откликаться и сохранять объявления." : "Заполните данные — и можно искать подработку рядом."}</p><div className="auth-tabs"><button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Войти</button><button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Регистрация</button></div><form className="modal-form" onSubmit={submitAuth}>{authMode === "register" ? <label>Имя и фамилия<input name="fullName" maxLength={100} required placeholder="Иван Иванов" /></label> : null}<label>Логин<input name="login" required minLength={3} autoComplete="username" placeholder="ivan2003" /></label><label>Пароль<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="Не менее 8 символов" /></label><button className="primary-button wide" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : null}{authMode === "login" ? "Войти" : "Зарегистрироваться"}</button></form><p className="form-footnote">Пароль хранится в защищённом виде и не показывается другим пользователям.</p></div> : null}
        {modal === "create" ? <TaskCreate onBusy={setBusy} onCreated={() => { setModal(null); notify("Объявление опубликовано"); void loadTasks(); }} /> : null}
        {modal === "detail" && selectedTask ? <div className="modal-content detail-content"><div className="detail-topline"><span className={selectedTask.urgent ? "urgent-badge large" : "category-pill"}>{selectedTask.urgent ? "Срочно" : categoryName(selectedTask.category)}</span><button className={selectedTask.isFavorite ? "heart-button saved" : "heart-button"} onClick={() => void toggleFavorite(selectedTask)}><Heart size={22} fill={selectedTask.isFavorite ? "currentColor" : "none"} /></button></div><h2>{selectedTask.title}</h2><div className="detail-price">{formatPrice(selectedTask.price)}</div>{selectedTask.imageIds?.length ? <div className="task-gallery">{selectedTask.imageIds.map((id, index) => <a key={id} href={`/api/media/${id}`} target="_blank" rel="noreferrer"><img src={`/api/media/${id}`} alt={`Фото объявления ${index + 1}`} /></a>)}</div> : null}<p className="detail-description">{selectedTask.description}</p><div className="detail-info"><span><MapPin size={17} />{selectedTask.district ? `${selectedTask.district} район · ` : ""}{selectedTask.address}</span><button className="author-link" onClick={() => { setProfileId(selectedTask.ownerId); setModal("profile"); }}><UserRound size={17} />{selectedTask.ownerName}<span>Открыть профиль</span></button><span>Опубликовано {formatDate(selectedTask.createdAt)}</span></div>{user?.id !== selectedTask.ownerId ? <button className="primary-button wide" disabled={applicationsLoading || applications.length > 0 || Boolean(selectedTask.workStatus)} onClick={() => requireAuth(() => setModal("apply"))}><Send size={18} />{selectedTask.workStatus === "done" ? "Задача завершена" : selectedTask.workStatus === "accepted" ? "Исполнитель выбран" : applications.length ? "Вы уже откликнулись" : "Откликнуться"}</button> : <div className="application-list"><h3>Отклики на вашу задачу</h3>{applicationsLoading ? <p>Загрузка…</p> : applicationError ? <p role="alert">{applicationError}</p> : applications.length ? applications.map((item) => <div className="application-card" key={item.id}><button className="author-link" onClick={() => { setProfileId(item.applicantId); setModal("profile"); }}><strong>{item.fullName}</strong></button><small>@{item.login}</small><p>{item.message}</p><button className="secondary-button chat-task-button" onClick={() => { setModal(null); setChatTarget(item.id); }}><MessageCircle size={17} />Написать в чат</button>{item.status === "new" && !applications.some((entry) => entry.status === "accepted" || entry.status === "done") ? <button className="secondary-button" disabled={busy} onClick={() => void updateApplication(item.id, "accepted")}>Выбрать исполнителем</button> : item.status === "accepted" ? <button className="primary-button" disabled={busy} onClick={() => void updateApplication(item.id, "done")}>Подтвердить завершение</button> : item.status === "done" ? <p className="save-success">Задача завершена</p> : null}</div>) : <p>Пока никто не откликнулся. Новые сообщения появятся здесь.</p>}</div>}</div> : null}
        {modal === "detail" && user && selectedTask && user.id !== selectedTask.ownerId && applications.length > 0 ? <div className="modal-content"><button className="secondary-button wide" onClick={() => { setModal(null); setChatTarget(applications[0].id); }}><MessageCircle size={18} />Чат с заказчиком</button></div> : null}
        {modal === "detail" && selectedTask && applications.some((item) => item.status === "done") ? <div className="modal-content"><ReviewForm key={selectedTask.id} taskId={selectedTask.id} /></div> : null}
        {modal === "profile" && profileId ? <ProfilePanel key={profileId} id={profileId} own={profileId === user?.id} onSaved={(fullName) => { setUser((current) => current ? { ...current, fullName } : null); void loadTasks(); }} onTask={(id) => void openTask(id)} /> : null}
        {modal === "apply" && selectedTask ? <div className="modal-content"><div className="modal-eyebrow">ОТКЛИК НА ЗАДАЧУ</div><h2>{selectedTask.title}</h2><p className="modal-lead">Напишите заказчику, почему вы подходите для этой работы.</p><form className="modal-form" onSubmit={submitApplication}><label>Сообщение<textarea name="message" required minLength={4} placeholder="Здравствуйте! Готов выполнить задачу..." /></label><button className="primary-button wide" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <Send size={18} />} Отправить отклик</button></form></div> : null}
      </DialogContent></Dialog>
    </div>
  );
}

function ListIcon() { return <span className="list-icon"><i /><i /><i /></span>; }

function TaskIcon({ category }: { category: string }) { const Icon = categories.find((item) => item.id === category)?.icon ?? Grid2X2; return <Icon size={26} strokeWidth={1.7} />; }

function plural(count: number) { const rem100 = count % 100; const rem10 = count % 10; return rem100 >= 11 && rem100 <= 14 ? "объявлений" : rem10 === 1 ? "объявление" : rem10 >= 2 && rem10 <= 4 ? "объявления" : "объявлений"; }
