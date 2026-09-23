"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

const PREVIEW = 240;
const MAX_ZOOM = 4;
type Point = { x: number; y: number };
type Gesture = { center: Point; distance: number; zoom: number; offset: Point };

export function AvatarEditor({ file, busy, onCancel, onSave }: { file: File; busy: boolean; onCancel: () => void; onSave: (file: File) => Promise<void> }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const image = useRef<HTMLImageElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const loaded = new Image();
    loaded.onload = () => { image.current = loaded; setDimensions({ width: loaded.naturalWidth, height: loaded.naturalHeight }); setError(""); };
    loaded.onerror = () => setError("Не удалось открыть фотографию. Выберите другой файл.");
    loaded.src = url;
    cancelButton.current?.focus();
    return () => { URL.revokeObjectURL(url); image.current = null; };
  }, [url]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape" && !busy) onCancel(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  const base = dimensions.width && dimensions.height ? Math.max(PREVIEW / dimensions.width, PREVIEW / dimensions.height) : 0;
  const width = dimensions.width * base * zoom;
  const height = dimensions.height * base * zoom;
  function moveTo(nextZoom: number, nextOffset: Point) {
    const safeZoom = Math.max(1, Math.min(MAX_ZOOM, nextZoom));
    const limitX = Math.max(0, (dimensions.width * base * safeZoom - PREVIEW) / 2);
    const limitY = Math.max(0, (dimensions.height * base * safeZoom - PREVIEW) / 2);
    const safeOffset = { x: Math.max(-limitX, Math.min(limitX, nextOffset.x)), y: Math.max(-limitY, Math.min(limitY, nextOffset.y)) };
    zoomRef.current = safeZoom;
    offsetRef.current = safeOffset;
    setZoom(safeZoom);
    setOffset(safeOffset);
  }

  function point(event: { currentTarget: HTMLDivElement; clientX: number; clientY: number }): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function resetGesture() {
    const active = [...pointers.current.values()].slice(0, 2);
    if (!active.length) { gesture.current = null; return; }
    const center = active.length === 1 ? active[0] : { x: (active[0].x + active[1].x) / 2, y: (active[0].y + active[1].y) / 2 };
    const distance = active.length === 1 ? 1 : Math.hypot(active[0].x - active[1].x, active[0].y - active[1].y);
    gesture.current = { center, distance: Math.max(1, distance), zoom: zoomRef.current, offset: offsetRef.current };
  }

  function movePointers() {
    const active = [...pointers.current.values()].slice(0, 2);
    const start = gesture.current;
    if (!start || !active.length) return;
    const center = active.length === 1 ? active[0] : { x: (active[0].x + active[1].x) / 2, y: (active[0].y + active[1].y) / 2 };
    const distance = active.length === 1 ? start.distance : Math.max(1, Math.hypot(active[0].x - active[1].x, active[0].y - active[1].y));
    const nextZoom = Math.max(1, Math.min(MAX_ZOOM, start.zoom * distance / start.distance));
    const ratio = nextZoom / start.zoom;
    moveTo(nextZoom, {
      x: center.x - PREVIEW / 2 + (start.offset.x - (start.center.x - PREVIEW / 2)) * ratio,
      y: center.y - PREVIEW / 2 + (start.offset.y - (start.center.y - PREVIEW / 2)) * ratio,
    });
  }

  async function save() {
    if (!image.current || !base) return;
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Не удалось обработать фотографию.");
      const ratio = 512 / PREVIEW;
      context.drawImage(image.current, (PREVIEW / 2 - width / 2 + offset.x) * ratio, (PREVIEW / 2 - height / 2 + offset.y) * ratio, width * ratio, height * ratio);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Не удалось сохранить фотографию.");
      await onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить фотографию."); }
  }

  return <div className="avatar-editor-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="avatar-editor" role="dialog" aria-modal="true" aria-labelledby="avatar-editor-title">
      <button ref={cancelButton} type="button" className="avatar-editor-close" aria-label="Закрыть редактор" disabled={busy} onClick={onCancel}><X size={20} /></button>
      <h2 id="avatar-editor-title">Фото профиля</h2>
      <p>Перемещайте фото одним пальцем, увеличивайте двумя.</p>
      <div className="avatar-editor-stage" style={{ width: PREVIEW, height: PREVIEW }} onPointerDown={(event) => { if (busy || !dimensions.width) return; pointers.current.set(event.pointerId, point(event)); event.currentTarget.setPointerCapture(event.pointerId); resetGesture(); }} onPointerMove={(event) => { if (!pointers.current.has(event.pointerId)) return; pointers.current.set(event.pointerId, point(event)); movePointers(); }} onPointerUp={(event) => { pointers.current.delete(event.pointerId); resetGesture(); }} onPointerCancel={(event) => { pointers.current.delete(event.pointerId); resetGesture(); }} onWheel={(event) => { if (busy || !dimensions.width) return; event.preventDefault(); const center = point(event); const nextZoom = Math.max(1, Math.min(MAX_ZOOM, zoomRef.current * (event.deltaY < 0 ? 1.08 : 1 / 1.08))); const ratio = nextZoom / zoomRef.current; moveTo(nextZoom, { x: center.x - PREVIEW / 2 + (offsetRef.current.x - (center.x - PREVIEW / 2)) * ratio, y: center.y - PREVIEW / 2 + (offsetRef.current.y - (center.y - PREVIEW / 2)) * ratio }); }}>
        {url && dimensions.width > 0 && <img src={url} alt="Предпросмотр фотографии профиля" draggable={false} style={{ width, height, left: PREVIEW / 2 - width / 2 + offset.x, top: PREVIEW / 2 - height / 2 + offset.y }} />}
        <div className="avatar-editor-mask" aria-hidden="true" />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="avatar-editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Отмена</button><button type="button" className="primary-button" disabled={busy || !dimensions.width} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить фото"}</button></div>
    </section>
  </div>;
}
