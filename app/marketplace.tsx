"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ProfilePanel, ReviewForm } from "./profile-panel";
import { districts } from "@/lib/districts";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle, BookOpen, Check, Grid2X2, Heart, Home as HomeIcon, Loader2, LogOut,
  Map as MapIcon, MapPin, Navigation, Package, Plus, Search, Send,
  UserRound, Video, Wrench, X, Zap,
} from "lucide-react";

type User = { id: string; login: string; fullName: string };
type Task = {
  id: string; title: string; description: string; category: string; price: number; address: string;
  lat: number; lng: number; urgent: number | boolean; commissionRate: number; createdAt: number;
  workStatus: "accepted" | "done" | null; district: string | null; ownerId: string; ownerName: string; isFavorite: number | boolean;
};
type AuthMode = "login" | "register";
type Modal = "auth" | "create" | "detail" | "apply" | "profile" | null;
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
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayer = useRef<LeafletLayer | null>(null);

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
    if (nextView !== "all") params.set("view", nextView);
    try {
      const data = await api<{ tasks: Task[] }>(`/api/tasks?${params}`);
      if (sequence === requestSequence.current) setTasks((current) => JSON.stringify(current) === JSON.stringify(data.tasks) ? current : data.tasks);
    } catch (error) { if (sequence === requestSequence.current) setLoadError(error instanceof Error ? error.message : "Не удалось загрузить объявления"); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [category, query, view, selectedDistricts, onlyUrgent]);

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
    if (!showMap) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !mapElement.current || !window.L || mapRef.current) return;
      const L = window.L;
      const map = L.map(mapElement.current, {
        center: CENTER, zoom: 12, minZoom: 3, maxZoom: 19,
        zoomControl: false, scrollWheelZoom: true, inertia: true, inertiaDeceleration: 2200, zoomAnimation: true, fadeAnimation: true,
        markerZoomAnimation: true, zoomSnap: 0.25, zoomDelta: 0.5, wheelDebounceTime: 16,
        wheelPxPerZoomLevel: 160, preferCanvas: true,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        updateWhenZooming: false, keepBuffer: 4,
      }).addTo(map);
      markerLayer.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      observer.observe(mapElement.current);
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
  }, [showMap]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerLayer.current || !window.L) return;
    const L = window.L;
    const layer = markerLayer.current;
    layer.clearLayers?.();
    filteredTasks.forEach((task) => {
      const icon = L.divIcon({ className: "task-marker-wrap", html: `<div class="task-marker ${task.urgent ? "is-urgent" : ""}" aria-label="Открыть объявление"><span>${task.urgent ? "ϟ " : ""}${task.price ? new Intl.NumberFormat("ru-RU").format(task.price) + " ₽" : "Договорная"}</span></div>`, iconSize: [110, 38], iconAnchor: [55, 42] });
      const marker = L.marker([task.lat, task.lng], { icon, riseOnHover: true, keyboard: true });
      marker.on("click", () => { setSelectedTask(task); setModal("detail"); });
      const safeTitle = task.title.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
      marker.bindTooltip(`<strong>${safeTitle}</strong><br>${formatPrice(task.price)}`, { direction: "top", offset: [0, -28], opacity: 0.96 });
      marker.addTo(layer);
    });
  }, [filteredTasks, mapReady]);

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

  async function logout() { try { await api("/api/auth/logout", { method: "POST" }); setUser(null); setView("all"); await loadTasks(category, query, "all"); notify("Вы вышли из аккаунта"); } catch { notify("Не удалось выйти. Попробуйте снова."); } }

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
      await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: form.get("title"), description: form.get("description"), category: form.get("category"), price: Number(form.get("price")), address, district: form.get("district"), urgent: form.get("urgent") === "on", ...point }) });
      setModal(null); notify("Объявление опубликовано на карте"); await loadTasks();
    } catch (error) { notify(error instanceof Error ? error.message : "Не удалось разместить объявление"); }
    finally { setBusy(false); }
  }

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
  function resetFilters() { setSelectedDistricts([]); setOnlyUrgent(false); setCategory("all"); setMinPrice(""); setMaxPrice(""); setSort("recommended"); setView("all"); setQuery(""); setSearchInput(""); void loadTasks("all", "", "all"); }

  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="topbar-links"><MapPin size={16} /><span>Поручения и подработка в Красноярске</span></div>
        <div className="topbar-actions"><button className={view === "saved" ? "icon-button active-icon" : "icon-button"} aria-label="Избранное" onClick={() => chooseView("saved")}><Heart size={21} fill={view === "saved" ? "currentColor" : "none"} /></button>{user ? <><button className="profile-chip" onClick={() => { setProfileId(user.id); setModal("profile"); }}><span className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>{user.fullName}</button><button className="icon-button" aria-label="Выйти" onClick={logout}><LogOut size={19} /></button></> : <button className="login-link" onClick={() => openAuth()}>Войти и зарегистрироваться</button>}<button className="post-button" onClick={() => requireAuth(() => setModal("create"))}><Plus size={20} /> Разместить объявление</button></div>
      </header>

      <div className="brand-row"><Link className="brand" href="/"><img className="brand-logo" src="/ryadom-logo.png" alt="" width="52" height="52" /><b>рядом</b></Link><form className="global-search" onSubmit={submitSearch}><Search size={21} /><input aria-label="Поиск по объявлениям" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Поиск по объявлениям" /><button type="submit">Найти</button></form><button className="location-label" onClick={() => { mapRef.current?.setView(CENTER, 12, { animate: true }); }}>{"⌖"} Красноярск</button></div>

      <main className="main-content">
        <div className="breadcrumbs">Главная <span>•</span> Объявления <span>•</span> Красноярск</div>
        <div className="heading-row"><div><h1>Задачи рядом</h1><p>Найди исполнителя или подработку в своём городе.</p></div><div className="view-switch"><button className={view === "all" ? "active" : ""} onClick={() => { setView("all"); void loadTasks(category, query, "all"); }}><ListIcon /> Все объявления</button><button className={view === "mine" ? "active" : ""} onClick={() => chooseView("mine")}>Мои объявления</button></div></div>
        <div className="map-toggle-row"><button className={showMap ? "map-toggle active" : "map-toggle"} onClick={() => { setShowMap((current) => !current); window.setTimeout(() => mapRef.current?.invalidateSize({ animate: true }), 120); }}><MapIcon size={17} />{showMap ? "Скрыть карту" : "Открыть карту"}</button></div>
        <div className="category-row">{categories.map(({ id, label, icon: Icon }) => <button key={id} className={category === id ? "category active" : "category"} onClick={() => chooseCategory(id)}><Icon size={19} />{label}</button>)}</div>
        <div className="results-toolbar"><span>{filteredTasks.length ? `${filteredTasks.length} ${plural(filteredTasks.length)} в Красноярске` : "Пока нет объявлений"}</span><span className="toolbar-note">{view === "mine" ? "Ваши объявления" : view === "saved" ? "Сохранённые объявления" : "По дате публикации"}</span></div>
        <div className={showMap ? "workspace-grid" : "workspace-grid no-map"}>
          <aside className={filtersOpen ? "filter-sidebar expanded" : "filter-sidebar"}><div className="filter-head"><h2>Фильтры</h2><button className="mobile-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}>{filtersOpen ? "Свернуть" : "Настроить"}</button><button onClick={resetFilters}>Сбросить</button></div><div className="filter-section"><h3>Категория</h3><div className="filter-category-list">{categories.filter((item) => item.id !== "urgent").map(({ id, label, icon: Icon }) => <button key={id} className={category === id ? "filter-category active" : "filter-category"} onClick={() => chooseCategory(id)}><Icon size={17} /><span>{label}</span>{category === id ? <Check size={16} /> : null}</button>)}</div></div><div className="filter-section"><h3>Район Красноярска</h3><div className="district-list">{districts.map((district) => <label key={district}><input type="checkbox" checked={selectedDistricts.includes(district)} onChange={(event) => setSelectedDistricts((current) => event.target.checked ? [...current, district] : current.filter((item) => item !== district))} /><span>{district}</span></label>)}</div><label className="urgency-filter"><input type="checkbox" checked={onlyUrgent} onChange={(event) => setOnlyUrgent(event.target.checked)} /><Zap size={16} /> Только срочные</label></div><div className="filter-section"><h3>Цена, ₽</h3><div className="price-fields"><input aria-label="Минимальная цена" type="number" min="0" placeholder="От" value={minPrice} onChange={(event) => setMinPrice(event.target.value ? Number(event.target.value) : "")} /><input aria-label="Максимальная цена" type="number" min="0" placeholder="До" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value ? Number(event.target.value) : "")} /></div></div><div className="filter-section"><h3>Сортировка</h3><select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Рекомендуемые</option><option value="newest">Сначала новые</option><option value="priceAsc">Сначала дешевле</option><option value="priceDesc">Сначала дороже</option></select></div></aside>
          <section className="task-panel"><div className="panel-head"><div><h2>Объявления в Красноярске</h2><span>{filteredTasks.length ? "Обновляются сразу после публикации" : "Разместите первое поручение"}</span></div><button className="near-button" onClick={() => { mapRef.current?.locate?.({ setView: true, maxZoom: 15 }); notify("Определяем ваше местоположение"); }}><Navigation size={16} /> Моё местоположение</button></div><div className="task-list" aria-busy={loading}>{loading ? <div className="empty-state"><Loader2 className="spin" /><p>Загружаем объявления…</p></div> : loadError ? <div className="empty-state"><AlertCircle /><h3>Не удалось загрузить объявления</h3><p>{loadError}</p><button className="primary-button" onClick={() => void loadTasks()}>Попробовать снова</button></div> : filteredTasks.length ? filteredTasks.map((task) => <article tabIndex={0} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedTask(task); setModal("detail"); } }} className={task.urgent ? "task-card urgent" : "task-card"} key={task.id} onClick={() => { setSelectedTask(task); setModal("detail"); }}><div className="task-symbol"><TaskIcon category={task.category} /></div><div className="task-card-body"><div className="task-card-top"><div><div className="task-kicker">{categoryName(task.category)} {task.workStatus ? <b className="category-pill">{task.workStatus === "done" ? "Завершено" : "В работе"}</b> : null} {task.urgent ? <b className="urgent-badge">Срочно</b> : null}</div><h3>{task.title}</h3></div><button className={task.isFavorite ? "heart-button saved" : "heart-button"} onClick={(event) => { event.stopPropagation(); void toggleFavorite(task); }} aria-label="Сохранить"><Heart size={21} fill={task.isFavorite ? "currentColor" : "none"} /></button></div><p>{task.description}</p><div className="task-meta"><span><MapPin size={15} />{task.district ? `${task.district} · ` : ""}{task.address}</span><span>{formatDate(task.createdAt)}</span></div><div className="task-footer"><b>{formatPrice(task.price)}</b><button className="card-author" onClick={(event) => { event.stopPropagation(); setProfileId(task.ownerId); setModal("profile"); }}>{task.ownerName}</button></div></div></article>) : <div className="empty-state"><div className="empty-icon"><MapIcon size={27} /></div><h3>{view === "saved" ? "Избранное пока пусто" : query || category !== "all" || minPrice !== "" || maxPrice !== "" ? "Ничего не найдено" : "Пока нет объявлений"}</h3><p>{view === "saved" ? "Нажмите на сердечко у объявления, чтобы сохранить его здесь." : "Попробуйте изменить фильтры или разместите своё поручение."}</p><button className="reset-link" onClick={resetFilters}>Сбросить фильтры</button><button className="primary-button" onClick={() => requireAuth(() => setModal("create"))}><Plus size={18} /> Разместить объявление</button></div>}</div></section>
          <section className={showMap ? "map-panel" : "map-panel map-panel-hidden"}><div ref={mapElement} className="map-container" aria-label="Карта объявлений Красноярска" />{!mapReady && !mapError ? <div className="map-loading"><Loader2 className="spin" size={21} /> Загружаем карту Красноярска</div> : null}{mapError ? <div className="map-loading"><AlertCircle size={20} /> Не удалось загрузить карту</div> : null}<div className="map-title"><MapIcon size={17} /> Карта Красноярска</div><button className="map-locate" aria-label="Центрировать карту" onClick={() => mapRef.current?.setView(CENTER, 12, { animate: true })}><Navigation size={17} /></button><div className="map-caption">{filteredTasks.length ? `${filteredTasks.length} ${filteredTasks.length === 1 ? "точка" : "точек"} на карте` : "Новые объявления появятся здесь"}</div></section>
        </div>
      </main>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
      <Dialog open={modal !== null} onOpenChange={(open) => { if (!open && !busy) setModal(null); }}><DialogContent showCloseButton={false} className={modal === "detail" ? "market-dialog detail-modal" : "market-dialog"} aria-describedby={undefined}><DialogTitle className="sr-only">{modal === "auth" ? "Вход и регистрация" : modal === "create" ? "Новое объявление" : modal === "profile" ? "Профиль пользователя" : selectedTask?.title || "Объявление"}</DialogTitle>
        <button className="modal-close" onClick={() => !busy && setModal(null)} aria-label="Закрыть"><X size={20} /></button>
        {modal === "auth" ? <div className="modal-content"><div className="modal-eyebrow">РЯДОМ</div><h2>{authMode === "login" ? "С возвращением" : "Создать аккаунт"}</h2><p className="modal-lead">{authMode === "login" ? "Войдите, чтобы откликаться и сохранять объявления." : "Заполните данные — и можно искать подработку рядом."}</p><div className="auth-tabs"><button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Войти</button><button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Регистрация</button></div><form className="modal-form" onSubmit={submitAuth}>{authMode === "register" ? <label>Имя и фамилия<input name="fullName" maxLength={100} required placeholder="Иван Иванов" /></label> : null}<label>Логин<input name="login" required minLength={3} autoComplete="username" placeholder="ivan2003" /></label><label>Пароль<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="Не менее 8 символов" /></label><button className="primary-button wide" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : null}{authMode === "login" ? "Войти" : "Зарегистрироваться"}</button></form><p className="form-footnote">Пароль хранится в защищённом виде и не показывается другим пользователям.</p></div> : null}
        {modal === "create" ? <div className="modal-content"><div className="modal-eyebrow">НОВОЕ ОБЪЯВЛЕНИЕ</div><h2>Что нужно сделать?</h2><p className="modal-lead">Объявление увидят исполнители рядом с указанным адресом.</p><form className="modal-form" onSubmit={submitTask}><label>Заголовок<input name="title" maxLength={120} required minLength={4} placeholder="Например, смонтировать видео" /></label><label>Описание<textarea name="description" maxLength={5000} required minLength={10} placeholder="Расскажите, что нужно сделать и к какому сроку" /></label><div className="form-grid"><label>Категория<select name="category" defaultValue="digital">{categories.slice(1, 6).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Бюджет, ₽<input name="price" type="number" min="0" step="1" required placeholder="1500" /></label></div><label>Район<select name="district" required defaultValue=""><option value="" disabled>Выберите район</option>{districts.map((district) => <option key={district} value={district}>{district}</option>)}</select></label><label>Адрес в Красноярске<input name="address" required placeholder="улица Ленина, 5" /></label><label className="urgent-check"><input name="urgent" type="checkbox" /><span><Zap size={17} /> Нужно срочно <small>Расчётная комиссия — 12% вместо 7%. Оплата через сервис пока не подключена.</small></span></label><button className="primary-button wide" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <Plus size={18} />} Опубликовать на карте</button></form></div> : null}
        {modal === "detail" && selectedTask ? <div className="modal-content detail-content"><div className="detail-topline"><span className={selectedTask.urgent ? "urgent-badge large" : "category-pill"}>{selectedTask.urgent ? "Срочно" : categoryName(selectedTask.category)}</span><button className={selectedTask.isFavorite ? "heart-button saved" : "heart-button"} onClick={() => void toggleFavorite(selectedTask)}><Heart size={22} fill={selectedTask.isFavorite ? "currentColor" : "none"} /></button></div><h2>{selectedTask.title}</h2><div className="detail-price">{formatPrice(selectedTask.price)}</div><p className="detail-description">{selectedTask.description}</p><div className="detail-info"><span><MapPin size={17} />{selectedTask.district ? `${selectedTask.district} район · ` : ""}{selectedTask.address}</span><button className="author-link" onClick={() => { setProfileId(selectedTask.ownerId); setModal("profile"); }}><UserRound size={17} />{selectedTask.ownerName}<span>Открыть профиль</span></button><span>Опубликовано {formatDate(selectedTask.createdAt)}</span></div>{user?.id !== selectedTask.ownerId ? <button className="primary-button wide" disabled={applicationsLoading || applications.length > 0 || Boolean(selectedTask.workStatus)} onClick={() => requireAuth(() => setModal("apply"))}><Send size={18} />{selectedTask.workStatus === "done" ? "Задача завершена" : selectedTask.workStatus === "accepted" ? "Исполнитель выбран" : applications.length ? "Вы уже откликнулись" : "Откликнуться"}</button> : <div className="application-list"><h3>Отклики на вашу задачу</h3>{applicationsLoading ? <p>Загрузка…</p> : applicationError ? <p role="alert">{applicationError}</p> : applications.length ? applications.map((item) => <div className="application-card" key={item.id}><button className="author-link" onClick={() => { setProfileId(item.applicantId); setModal("profile"); }}><strong>{item.fullName}</strong></button><small>@{item.login}</small><p>{item.message}</p>{item.status === "new" && !applications.some((entry) => entry.status === "accepted" || entry.status === "done") ? <button className="secondary-button" disabled={busy} onClick={() => void updateApplication(item.id, "accepted")}>Выбрать исполнителем</button> : item.status === "accepted" ? <button className="primary-button" disabled={busy} onClick={() => void updateApplication(item.id, "done")}>Подтвердить завершение</button> : item.status === "done" ? <p className="save-success">Задача завершена</p> : null}</div>) : <p>Пока никто не откликнулся. Новые сообщения появятся здесь.</p>}</div>}</div> : null}
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
