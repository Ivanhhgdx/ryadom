"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, BookOpen, Check, ChevronDown, Grid2X2, Heart, Home, Loader2, LogOut,
  Map as MapIcon, MapPin, Menu, Navigation, Package, Plus, Search, Send,
  UserRound, Video, Wrench, X, Zap,
} from "lucide-react";

type User = { id: string; login: string; fullName: string };
type Task = {
  id: string; title: string; description: string; category: string; price: number; address: string;
  lat: number; lng: number; urgent: number | boolean; commissionRate: number; createdAt: number;
  ownerId: string; ownerName: string; isFavorite: number | boolean;
};
type AuthMode = "login" | "register";
type Modal = "auth" | "create" | "detail" | "apply" | null;
type ViewMode = "all" | "mine" | "saved";

type LeafletMap = { setView: (center: [number, number], zoom: number, options?: { animate?: boolean }) => void; invalidateSize: (options?: { animate?: boolean }) => void; fitBounds: (bounds: LeafletBounds, options?: { animate?: boolean; duration?: number; maxZoom?: number }) => void; locate?: (options: { setView: boolean; maxZoom: number }) => void };
type LeafletBounds = { pad: (value: number) => LeafletBounds };
type LeafletLayer = { addTo: (target: LeafletMap | LeafletLayer) => LeafletLayer; clearLayers?: () => void };
type LeafletMarker = { on: (event: string, callback: () => void) => LeafletMarker; bindTooltip: (content: string, options: { direction: string; offset: [number, number]; opacity: number }) => LeafletMarker; addTo: (target: LeafletMap | LeafletLayer) => LeafletMarker };
type LeafletApi = { map: (element: HTMLDivElement, options: Record<string, unknown>) => LeafletMap; control: { zoom: (options: { position: string }) => LeafletLayer }; tileLayer: (url: string, options: Record<string, unknown>) => LeafletLayer; layerGroup: () => LeafletLayer; divIcon: (options: Record<string, unknown>) => unknown; marker: (coordinates: [number, number], options: Record<string, unknown>) => LeafletMarker; latLngBounds: (coordinates: [number, number][]) => LeafletBounds };
declare global { interface Window { L?: LeafletApi } }

const CENTER = [56.0153, 92.8932] as [number, number];
const categories = [
  { id: "all", label: "Все категории", icon: Grid2X2 },
  { id: "delivery", label: "Доставка", icon: Package },
  { id: "digital", label: "Диджитал", icon: Video },
  { id: "repair", label: "Ремонт", icon: Wrench },
  { id: "home", label: "Дом и быт", icon: Home },
  { id: "study", label: "Учёба", icon: BookOpen },
  { id: "urgent", label: "Срочные", icon: Zap },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Что-то пошло не так");
  return data as T;
}

function formatPrice(price: number) { return price ? `${new Intl.NumberFormat("ru-RU").format(price)} ₽` : "Договорная"; }
function formatDate(timestamp: number) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(timestamp)); }
function categoryName(id: string) { return categories.find((category) => category.id === id)?.label ?? "Другое"; }

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<ViewMode>("all");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [sort, setSort] = useState("newest");
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayer = useRef<LeafletLayer | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3400);
  }, []);

  const loadTasks = useCallback(async (nextCategory = category, nextQuery = query, nextView = view) => {
    const params = new URLSearchParams();
    if (nextCategory !== "all" && nextCategory !== "urgent") params.set("category", nextCategory);
    if (nextCategory === "urgent") params.set("urgent", "1");
    if (nextQuery) params.set("query", nextQuery);
    if (nextView !== "all") params.set("view", nextView);
    try {
      const data = await api<{ tasks: Task[] }>(`/api/tasks?${params}`);
      setTasks(data.tasks);
    } catch (error) { notify(error instanceof Error ? error.message : "Не удалось загрузить объявления"); }
  }, [category, query, view, notify]);

  useEffect(() => {
    void Promise.all([
      api<{ user: User | null }>("/api/auth/me").then((data) => setUser(data.user)).catch(() => undefined),
      loadTasks(),
    ]);
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    const result = tasks.filter((task) => (minPrice === "" || task.price >= minPrice) && (maxPrice === "" || task.price <= maxPrice));
    return [...result].sort((a, b) => sort === "priceAsc" ? a.price - b.price : sort === "priceDesc" ? b.price - a.price : Number(b.urgent) - Number(a.urgent) || b.createdAt - a.createdAt);
  }, [tasks, minPrice, maxPrice, sort]);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (cancelled || !mapElement.current || !window.L || mapRef.current) return;
      const L = window.L;
      const map = L.map(mapElement.current, {
        center: CENTER, zoom: 12, minZoom: 3, maxZoom: 19,
        zoomControl: false, scrollWheelZoom: true, zoomAnimation: true, fadeAnimation: true,
        markerZoomAnimation: true, zoomSnap: 0.25, zoomDelta: 0.5, wheelDebounceTime: 16,
        wheelPxPerZoomLevel: 100, zoomAnimationDuration: 0.35, preferCanvas: true,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        updateWhenZooming: false, keepBuffer: 4,
      }).addTo(map);
      markerLayer.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 80);
    };
    if (window.L) mount();
    else {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
      const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.async = true;
      script.onload = mount; script.onerror = () => setMapError(true); document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerLayer.current || !window.L) return;
    const L = window.L;
    markerLayer.current.clearLayers();
    filteredTasks.forEach((task) => {
      const icon = L.divIcon({ className: "task-marker-wrap", html: `<button class="task-marker ${task.urgent ? "is-urgent" : ""}" aria-label="${task.title.replaceAll('"', "&quot;")}"><span>${task.urgent ? "!" : "₽"}</span></button>`, iconSize: [42, 42], iconAnchor: [21, 38] });
      const marker = L.marker([task.lat, task.lng], { icon, riseOnHover: true, keyboard: true });
      marker.on("click", () => { setSelectedTask(task); setModal("detail"); });
      marker.bindTooltip(`<strong>${task.title}</strong><br>${formatPrice(task.price)}`, { direction: "top", offset: [0, -28], opacity: 0.96 });
      marker.addTo(markerLayer.current);
    });
    if (filteredTasks.length > 0 && filteredTasks.length < 30) {
      const bounds = L.latLngBounds(filteredTasks.map((task: Task) => [task.lat, task.lng]));
      mapRef.current.fitBounds(bounds.pad(0.16), { animate: true, duration: 0.55, maxZoom: 14 });
    }
  }, [filteredTasks, mapReady]);

  function openAuth(mode: AuthMode = "login") { setAuthMode(mode); setModal("auth"); }
  function requireAuth(action: () => void) { if (!user) { openAuth(); notify("Сначала войдите или зарегистрируйтесь"); return; } action(); }

  async function toggleFavorite(task: Task) {
    requireAuth(async () => {
      try {
        const saved = Boolean(task.isFavorite);
        await api(`/api/tasks/${task.id}/favorite`, { method: saved ? "DELETE" : "POST" });
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, isFavorite: !saved } : item));
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

  async function logout() { await api("/api/auth/logout", { method: "POST" }).catch(() => undefined); setUser(null); setTasks((current) => current.map((task) => ({ ...task, isFavorite: false }))); notify("Вы вышли из аккаунта"); }

  async function geocode(address: string) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ru&q=${encodeURIComponent(`Красноярск, ${address}`)}`, { headers: { Accept: "application/json" } });
    const result = await response.json() as Array<{ lat: string; lon: string }>;
    if (!result[0]) throw new Error("Не нашли этот адрес в Красноярске. Уточните улицу и номер дома.");
    return { lat: Number(result[0].lat), lng: Number(result[0].lon) };
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const address = String(form.get("address") ?? "");
      const point = await geocode(address);
      await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: form.get("title"), description: form.get("description"), category: form.get("category"), price: Number(form.get("price")), address, urgent: form.get("urgent") === "on", ...point }) });
      setModal(null); notify("Объявление опубликовано на карте"); await loadTasks();
    } catch (error) { notify(error instanceof Error ? error.message : "Не удалось разместить объявление"); }
    finally { setBusy(false); }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedTask) return; setBusy(true);
    const form = new FormData(event.currentTarget);
    try { await api(`/api/tasks/${selectedTask.id}/apply`, { method: "POST", body: JSON.stringify({ message: form.get("message") }) }); setModal("detail"); notify("Отклик отправлен заказчику"); }
    catch (error) { notify(error instanceof Error ? error.message : "Не удалось отправить отклик"); }
    finally { setBusy(false); }
  }

  function chooseCategory(id: string) { setCategory(id); setView("all"); void loadTasks(id, query, "all"); }
  function submitSearch(event: FormEvent) { event.preventDefault(); setQuery(searchInput.trim()); void loadTasks(category, searchInput.trim(), view); }
  function chooseView(nextView: ViewMode) { if (!user) { openAuth(); notify("Войдите, чтобы открыть этот раздел"); return; } setView(nextView); void loadTasks(category, query, nextView); }
  function resetFilters() { setCategory("all"); setMinPrice(""); setMaxPrice(""); setSort("newest"); setView("all"); setQuery(""); setSearchInput(""); void loadTasks("all", "", "all"); }

  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="topbar-links"><span>Для бизнеса <ChevronDown size={15} /></span><span>Карьера в Рядом</span><span>Помощь</span><span>Ещё <ChevronDown size={15} /></span></div>
        <div className="topbar-actions"><button className={view === "saved" ? "icon-button active-icon" : "icon-button"} aria-label="Избранное" onClick={() => chooseView("saved")}><Heart size={21} fill={view === "saved" ? "currentColor" : "none"} /></button>{user ? <><button className="profile-chip" onClick={() => notify(`Вы вошли как ${user.fullName}`)}><span className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>{user.fullName}</button><button className="icon-button" aria-label="Выйти" onClick={logout}><LogOut size={19} /></button></> : <button className="login-link" onClick={() => openAuth()}>Войти и зарегистрироваться</button>}<button className="post-button" onClick={() => requireAuth(() => setModal("create"))}><Plus size={20} /> Разместить объявление</button></div>
      </header>

      <div className="brand-row"><Link className="brand" href="/"><span className="brand-mark"><span /></span><b>рядом</b></Link><button className="menu-button" aria-label="Меню"><Menu size={22} /></button><form className="global-search" onSubmit={submitSearch}><Search size={21} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Поиск по объявлениям" /><button type="submit">Найти</button></form><button className="location-label" onClick={() => { mapRef.current?.setView(CENTER, 12, { animate: true }); }}>{"⌖"} Красноярск</button></div>

      <main className="main-content">
        <div className="breadcrumbs">Главная <span>•</span> Объявления <span>•</span> Красноярск</div>
        <div className="heading-row"><div><h1>Задачи рядом</h1><p>Найди исполнителя или подработку в своём городе.</p></div><div className="view-switch"><button className={view === "all" ? "active" : ""} onClick={() => { setView("all"); void loadTasks(category, query, "all"); }}><ListIcon /> Все объявления</button><button className={view === "mine" ? "active" : ""} onClick={() => chooseView("mine")}>Мои объявления</button></div></div>
        <div className="map-toggle-row"><button className={showMap ? "map-toggle active" : "map-toggle"} onClick={() => { setShowMap((current) => !current); window.setTimeout(() => mapRef.current?.invalidateSize({ animate: true }), 120); }}><MapIcon size={17} />{showMap ? "Скрыть карту" : "Открыть карту"}</button></div>
        <div className="category-row">{categories.map(({ id, label, icon: Icon }) => <button key={id} className={category === id ? "category active" : "category"} onClick={() => chooseCategory(id)}><Icon size={19} />{label}</button>)}</div>
        <div className="results-toolbar"><span>{filteredTasks.length ? `${filteredTasks.length} ${filteredTasks.length === 1 ? "объявление" : "объявлений"} в Красноярске` : "Пока нет объявлений"}</span><span className="toolbar-note">{view === "mine" ? "Ваши объявления" : view === "saved" ? "Сохранённые объявления" : "По дате публикации"}</span></div>
        <div className={showMap ? "workspace-grid" : "workspace-grid no-map"}>
          <aside className="filter-sidebar"><div className="filter-head"><h2>Фильтры</h2><button onClick={resetFilters}>Сбросить</button></div><div className="filter-section"><h3>Категория</h3><div className="filter-category-list">{categories.map(({ id, label, icon: Icon }) => <button key={id} className={category === id ? "filter-category active" : "filter-category"} onClick={() => chooseCategory(id)}><Icon size={17} /><span>{label}</span>{category === id ? <Check size={16} /> : null}</button>)}</div></div><div className="filter-section"><h3>Цена, ₽</h3><div className="price-fields"><input type="number" min="0" placeholder="От" value={minPrice} onChange={(event) => setMinPrice(event.target.value ? Number(event.target.value) : "")} /><input type="number" min="0" placeholder="До" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value ? Number(event.target.value) : "")} /></div></div><div className="filter-section"><h3>Сортировка</h3><select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Сначала новые</option><option value="priceAsc">Сначала дешевле</option><option value="priceDesc">Сначала дороже</option></select></div></aside>
          <section className="task-panel"><div className="panel-head"><div><h2>Объявления в Красноярске</h2><span>{filteredTasks.length ? "Обновляются сразу после публикации" : "Разместите первое поручение"}</span></div><button className="near-button" onClick={() => { mapRef.current?.locate?.({ setView: true, maxZoom: 15 }); notify("Определяем ваше местоположение"); }}><Navigation size={16} /> Моё местоположение</button></div><div className="task-list">{filteredTasks.length ? filteredTasks.map((task) => <article className={task.urgent ? "task-card urgent" : "task-card"} key={task.id} onClick={() => { setSelectedTask(task); setModal("detail"); }}><div className="task-symbol"><span>{task.urgent ? "!" : categoryName(task.category).slice(0, 1)}</span></div><div className="task-card-body"><div className="task-card-top"><div><div className="task-kicker">{categoryName(task.category)} {task.urgent ? <b className="urgent-badge">Срочно</b> : null}</div><h3>{task.title}</h3></div><button className={task.isFavorite ? "heart-button saved" : "heart-button"} onClick={(event) => { event.stopPropagation(); void toggleFavorite(task); }} aria-label="Сохранить"><Heart size={21} fill={task.isFavorite ? "currentColor" : "none"} /></button></div><p>{task.description}</p><div className="task-meta"><span><MapPin size={15} />{task.address}</span><span>{formatDate(task.createdAt)}</span></div><div className="task-footer"><b>{formatPrice(task.price)}</b><span>{task.ownerName}</span></div></div></article>) : <div className="empty-state"><div className="empty-icon"><MapIcon size={27} /></div><h3>Здесь пока тихо</h3><p>Создайте объявление — оно появится здесь и на карте у всех пользователей.</p><button className="primary-button" onClick={() => requireAuth(() => setModal("create"))}><Plus size={18} /> Разместить объявление</button></div>}</div></section>
          <section className={showMap ? "map-panel" : "map-panel map-panel-hidden"}><div ref={mapElement} className="map-container" aria-label="Карта объявлений Красноярска" />{!mapReady && !mapError ? <div className="map-loading"><Loader2 className="spin" size={21} /> Загружаем карту Красноярска</div> : null}{mapError ? <div className="map-loading"><AlertCircle size={20} /> Не удалось загрузить карту</div> : null}<div className="map-title"><MapIcon size={17} /> Карта Красноярска</div><button className="map-locate" aria-label="Центрировать карту" onClick={() => mapRef.current?.setView(CENTER, 12, { animate: true })}><Navigation size={17} /></button><div className="map-caption">{filteredTasks.length ? `${filteredTasks.length} ${filteredTasks.length === 1 ? "точка" : "точек"} на карте` : "Новые объявления появятся здесь"}</div></section>
        </div>
      </main>

      {toast ? <div className="toast"><Check size={18} />{toast}</div> : null}
      {modal ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModal(null); }}><div className={modal === "detail" ? "modal detail-modal" : "modal"}>
        <button className="modal-close" onClick={() => !busy && setModal(null)} aria-label="Закрыть"><X size={20} /></button>
        {modal === "auth" ? <div className="modal-content"><div className="modal-eyebrow">РЯДОМ</div><h2>{authMode === "login" ? "С возвращением" : "Создать аккаунт"}</h2><p className="modal-lead">{authMode === "login" ? "Войдите, чтобы откликаться и сохранять объявления." : "Заполните данные — и можно искать подработку рядом."}</p><div className="auth-tabs"><button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Войти</button><button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Регистрация</button></div><form className="modal-form" onSubmit={submitAuth}>{authMode === "register" ? <label>Имя и фамилия<input name="fullName" required placeholder="Иван Иванов" /></label> : null}<label>Логин<input name="login" required minLength={3} autoComplete="username" placeholder="ivan2003" /></label><label>Пароль<input name="password" type="password" required minLength={8} autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="Не менее 8 символов" /></label><button className="primary-button wide" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : null}{authMode === "login" ? "Войти" : "Зарегистрироваться"}</button></form><p className="form-footnote">Пароль хранится в защищённом виде и не показывается другим пользователям.</p></div> : null}
        {modal === "create" ? <div className="modal-content"><div className="modal-eyebrow">НОВОЕ ОБЪЯВЛЕНИЕ</div><h2>Что нужно сделать?</h2><p className="modal-lead">Объявление увидят исполнители рядом с указанным адресом.</p><form className="modal-form" onSubmit={submitTask}><label>Заголовок<input name="title" required minLength={4} placeholder="Например, смонтировать видео" /></label><label>Описание<textarea name="description" required minLength={10} placeholder="Расскажите, что нужно сделать и к какому сроку" /></label><div className="form-grid"><label>Категория<select name="category" defaultValue="digital">{categories.slice(1, 6).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Бюджет, ₽<input name="price" type="number" min="0" step="50" required placeholder="1500" /></label></div><label>Адрес в Красноярске<input name="address" required placeholder="улица Ленина, 5" /></label><label className="urgent-check"><input name="urgent" type="checkbox" /><span><Zap size={17} /> Нужно срочно <small>Комиссия сервиса для срочных задач — 12% вместо 7%</small></span></label><button className="primary-button wide" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <Plus size={18} />} Опубликовать на карте</button></form></div> : null}
        {modal === "detail" && selectedTask ? <div className="modal-content detail-content"><div className="detail-topline"><span className={selectedTask.urgent ? "urgent-badge large" : "category-pill"}>{selectedTask.urgent ? "Срочно" : categoryName(selectedTask.category)}</span><button className={selectedTask.isFavorite ? "heart-button saved" : "heart-button"} onClick={() => void toggleFavorite(selectedTask)}><Heart size={22} fill={selectedTask.isFavorite ? "currentColor" : "none"} /></button></div><h2>{selectedTask.title}</h2><div className="detail-price">{formatPrice(selectedTask.price)}</div><p className="detail-description">{selectedTask.description}</p><div className="detail-info"><span><MapPin size={17} />{selectedTask.address}</span><span><UserRound size={17} />{selectedTask.ownerName}</span><span>Опубликовано {formatDate(selectedTask.createdAt)}</span></div>{user?.id !== selectedTask.ownerId ? <button className="primary-button wide" onClick={() => requireAuth(() => setModal("apply"))}><Send size={18} /> Откликнуться</button> : <div className="owner-note">Это ваше объявление. Отклики появятся в личном кабинете.</div>}</div> : null}
        {modal === "apply" && selectedTask ? <div className="modal-content"><div className="modal-eyebrow">ОТКЛИК НА ЗАДАЧУ</div><h2>{selectedTask.title}</h2><p className="modal-lead">Напишите заказчику, почему вы подходите для этой работы.</p><form className="modal-form" onSubmit={submitApplication}><label>Сообщение<textarea name="message" required minLength={4} placeholder="Здравствуйте! Готов выполнить задачу..." /></label><button className="primary-button wide" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <Send size={18} />} Отправить отклик</button></form></div> : null}
      </div></div> : null}
    </div>
  );
}

function ListIcon() { return <span className="list-icon"><i /><i /><i /></span>; }
