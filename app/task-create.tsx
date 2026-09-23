"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, MapPin, Monitor, Plus, X, Zap } from "lucide-react";
import { districts } from "@/lib/districts";
import { uploadPhoto, type UploadedPhoto } from "@/lib/photo-client";
import { categoryGroups } from "@/lib/categories";
type Point = { lat: number; lng: number; district: string | null; address: string; house?: boolean };
type Photo = UploadedPhoto;
export type TaskDraft = { id: string; title: string; description: string; category: string; price: number; address: string; district: string | null; lat: number; lng: number; urgent: boolean | number; workMode: "onsite" | "remote"; imageIds?: string[] };
export function TaskCreate({ onCreated, onBusy, initial }: { onCreated: () => void; onBusy: (busy: boolean) => void; initial?: TaskDraft }) {
  const [mode, setMode] = useState(initial?.workMode || "onsite");
  const [address, setAddress] = useState(initial?.workMode === "onsite" ? initial.address : "");
  const [district, setDistrict] = useState(initial?.district || "");
  const [point, setPoint] = useState<Point | null>(initial?.workMode === "onsite" ? { lat: initial.lat, lng: initial.lng, district: initial.district, address: initial.address } : null);
  const [suggestions, setSuggestions] = useState<Point[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [photos, setPhotos] = useState<Photo[]>(() => (initial?.imageIds || []).map((id) => ({ id, url: `/api/media/${id}?preview=1` })));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const addressGeneration = useRef(0);
  useEffect(() => { onBusy(uploading || saving); return () => onBusy(false); }, [uploading, saving, onBusy]);
  useEffect(() => {
    if (mode !== "onsite" || address.trim().length < 3 || point) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true); setAddressError("");
      try {
        const response = await fetch(`/api/addresses?q=${encodeURIComponent(address)}`, { signal: controller.signal });
        const data = await response.json() as { suggestions: Point[]; error?: string }; if (!response.ok) throw new Error(data.error);
        setSuggestions(data.suggestions); setExpanded(true); setActive(-1);
        if (!data.suggestions.length) setAddressError("Нет подсказок. Введите полный адрес и нажмите «Проверить адрес».");
      } catch (e) { if (!controller.signal.aborted) setAddressError(e instanceof Error ? e.message : "Подсказки недоступны."); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 650);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [address, mode, point]);
  function choose(item: Point) {
    addressGeneration.current++; setAddress(item.address); setDistrict(item.district || ""); setPoint(item); setSuggestions([]); setExpanded(false); setAddressError(""); setSearching(false);
  }
  async function resolveAddress() {
    const generation = addressGeneration.current;
    setSearching(true); setAddressError("");
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const result = await response.json() as Point & { error?: string }; if (!response.ok) throw new Error(result.error);
      if (generation !== addressGeneration.current) return;
      choose({ ...result, address });
    } catch (e) { if (generation === addressGeneration.current) setAddressError(e instanceof Error ? e.message : "Не удалось найти адрес."); }
    finally { if (generation === addressGeneration.current) setSearching(false); }
  }
  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    if (files.length + photos.length > 5) { setError("Можно добавить до 5 фотографий."); return; }
    setUploading(true); setError("");
    try { for (const file of Array.from(files)) { const photo = await uploadPhoto(file, "task"); setPhotos((current) => [...current, photo]); } }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки"); }
    finally { setUploading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (mode === "onsite" && (!point || !district)) { setError("Выберите адрес из подсказок или проверьте его, затем уточните район."); return; }
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(initial ? `/api/tasks/${initial.id}` : "/api/tasks", { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), description: form.get("description"), category: form.get("category"), price: Number(form.get("price")), urgent: form.get("urgent") === "on", workMode: mode, address, district, lat: point?.lat, lng: point?.lng, imageIds: photos.map((p) => p.id) }) });
      const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error);
      onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось опубликовать объявление."); }
    finally { setSaving(false); }
  }
  return <div className="modal-content"><div className="modal-eyebrow">{initial ? "РЕДАКТИРОВАНИЕ" : "НОВОЕ ОБЪЯВЛЕНИЕ"}</div><h2>{initial ? "Изменить объявление" : "Что нужно сделать?"}</h2><form className="modal-form" onSubmit={submit}>
    <label>Заголовок<input name="title" defaultValue={initial?.title} required minLength={4} maxLength={120} placeholder="Например, смонтировать видео" /></label>
    <label>Описание<textarea name="description" defaultValue={initial?.description} required minLength={10} maxLength={5000} placeholder="Что нужно сделать и к какому сроку?" /></label>
    <div className="photo-upload"><strong>Фотографии <small>до 5 · JPEG, PNG, WebP · до 100 МБ</small></strong><div className="photo-previews">{photos.map((photo, index) => <div key={photo.id}><img src={photo.url} alt={`Фотография ${index + 1}`} /><button type="button" disabled={uploading || saving} aria-label={`Убрать фотографию ${index + 1}`} onClick={() => setPhotos((current) => current.filter((p) => p.id !== photo.id))}><X size={15} /></button></div>)}{photos.length < 5 && <label className="photo-add"><ImagePlus size={24} /><span>{uploading ? "Загрузка…" : "Добавить"}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || saving} onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} /></label>}</div></div>
    <div className="form-grid"><label>Категория<select name="category" defaultValue={initial?.category || "delivery:courier"}>{initial?.category && !initial.category.includes(":") && <option value={initial.category}>{categoryGroups.find((group) => group.id === initial.category)?.label}</option>}{categoryGroups.map((group) => <optgroup key={group.id} label={group.label}>{group.items.map((item) => <option key={item.id} value={`${group.id}:${item.id}`}>{item.label}</option>)}</optgroup>)}</select></label><label>Бюджет, ₽<input name="price" type="number" min="0" max="10000000" step="1" required defaultValue={initial?.price} placeholder="1500" /></label></div>
    <fieldset className="work-mode"><legend>Где выполнять</legend><label className={mode === "onsite" ? "selected" : ""}><input type="radio" name="workMode" value="onsite" checked={mode === "onsite"} onChange={() => setMode("onsite")} /><MapPin size={18} />На месте</label><label className={mode === "remote" ? "selected" : ""}><input type="radio" name="workMode" value="remote" checked={mode === "remote"} onChange={() => { addressGeneration.current++; setMode("remote"); setSearching(false); }} /><Monitor size={18} />Удалённо</label></fieldset>
    {mode === "onsite" ? <><div className="address-control"><label htmlFor="task-address">Адрес в Красноярске</label><input id="task-address" role="combobox" aria-autocomplete="list" aria-expanded={expanded && suggestions.length > 0} aria-controls="address-options" aria-activedescendant={expanded && active >= 0 ? `address-option-${active}` : undefined} autoComplete="off" value={address} required maxLength={250} placeholder="Начните вводить улицу и дом" onChange={(e) => { addressGeneration.current++; setAddress(e.target.value); setPoint(null); setDistrict(""); setSuggestions([]); setActive(-1); setSearching(false); }} onFocus={() => setExpanded(true)} onBlur={() => setExpanded(false)} onKeyDown={(e) => { if (e.key === "ArrowDown" && suggestions.length) { e.preventDefault(); setExpanded(true); setActive((n) => (n + 1) % suggestions.length); } else if (e.key === "ArrowUp" && suggestions.length) { e.preventDefault(); setActive((n) => (n - 1 + suggestions.length) % suggestions.length); } else if (e.key === "Enter" && expanded && active >= 0) { e.preventDefault(); choose(suggestions[active]); } else if (e.key === "Escape" && expanded) { e.stopPropagation(); setExpanded(false); } }} />
      {expanded && suggestions.length > 0 && <div className="address-options" role="listbox" id="address-options">{suggestions.map((s, index) => <button type="button" role="option" aria-selected={active === index} id={`address-option-${index}`} key={`${s.lat}:${s.lng}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}><MapPin size={17} /><span><strong>{s.address}</strong><small>Красноярск{s.district ? ` · ${s.district} район` : ""}{!s.house ? " · улица, уточните дом при необходимости" : ""}</small></span></button>)}</div>}
      <div className="address-status">{point ? <span><Check size={15} />Место выбрано</span> : <button type="button" onClick={() => void resolveAddress()} disabled={searching || address.trim().length < 3}>{searching ? "Ищем адрес…" : "Проверить адрес"}</button>}</div>{addressError && <p className="field-error" role="status">{addressError}</p>}<small className="source-note">Подсказки: Photon / OpenStreetMap</small></div>
    <label>Район<select value={district} onChange={(e) => setDistrict(e.target.value)} required><option value="">Определится по адресу</option>{districts.map((d) => <option key={d}>{d}</option>)}</select><small className="field-hint">Если район не определился или указан неточно, выберите его вручную.</small></label></> : <p className="remote-note"><Monitor size={18} />Адрес и район не нужны. На карте задача появится в разделе «Удалённо», без отметки конкретного дома.</p>}
    <label className="urgent-check"><input name="urgent" type="checkbox" defaultChecked={Boolean(initial?.urgent)} /><span><Zap size={17} />Нужно срочно<small>Выше в рекомендациях. Расчётная комиссия — 12% вместо 7%; списания пока не подключены.</small></span></label>
    {error && <p className="field-error" role="alert">{error}</p>}<button className="primary-button wide" disabled={saving || uploading}>{saving || uploading ? <Loader2 size={18} className="spin" /> : initial ? <Check size={18} /> : <Plus size={18} />}{initial ? "Сохранить изменения" : "Опубликовать объявление"}</button>
  </form></div>;
}
