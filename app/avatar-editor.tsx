"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

const PREVIEW = 280;

export function AvatarEditor({ file, busy, onCancel, onSave }: { file: File; busy: boolean; onCancel: () => void; onSave: (file: File) => Promise<void> }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
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
  const limitX = Math.max(0, (width - PREVIEW) / 2);
  const limitY = Math.max(0, (height - PREVIEW) / 2);
  const clamp = (x: number, y: number) => ({ x: Math.max(-limitX, Math.min(limitX, x)), y: Math.max(-limitY, Math.min(limitY, y)) });

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
      <p>Перетащите фото, чтобы выбрать область внутри круга.</p>
      <div className="avatar-editor-stage" style={{ width: PREVIEW, height: PREVIEW }} onPointerDown={(event) => { if (busy || !dimensions.width) return; drag.current = { x: event.clientX, y: event.clientY, startX: offset.x, startY: offset.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) setOffset(clamp(drag.current.startX + event.clientX - drag.current.x, drag.current.startY + event.clientY - drag.current.y)); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {url && dimensions.width > 0 && <img src={url} alt="Предпросмотр фотографии профиля" draggable={false} style={{ width, height, left: PREVIEW / 2 - width / 2 + offset.x, top: PREVIEW / 2 - height / 2 + offset.y }} />}
        <div className="avatar-editor-mask" aria-hidden="true" />
      </div>
      <label className="avatar-editor-zoom">Масштаб<input type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy || !dimensions.width} onChange={(event) => { const next = Number(event.target.value); const nextWidth = dimensions.width * base * next; const nextHeight = dimensions.height * base * next; setZoom(next); setOffset({ x: Math.max(-(nextWidth - PREVIEW) / 2, Math.min((nextWidth - PREVIEW) / 2, offset.x)), y: Math.max(-(nextHeight - PREVIEW) / 2, Math.min((nextHeight - PREVIEW) / 2, offset.y)) }); }} /></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="avatar-editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Отмена</button><button type="button" className="primary-button" disabled={busy || !dimensions.width} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить фото"}</button></div>
    </section>
  </div>;
}
