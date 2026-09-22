"use client";
import { useState } from "react";
import { ExternalLink, MapPin, Maximize2, Zap } from "lucide-react";

type MapTask = { id: string; title: string; price: number; lat: number; lng: number; urgent: boolean | number };
export function YandexMap({ tasks, onTask }: { tasks: MapTask[]; onTask: (id: string) => void }) {
  const [focused, setFocused] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = tasks.find((task) => task.id === focused);
  const points = tasks.slice(0, 50).filter((task) => Number.isFinite(task.lat) && Number.isFinite(task.lng));
  const params = new URLSearchParams({ ll: selected ? `${selected.lng},${selected.lat}` : "92.8932,56.0153", z: selected ? "16" : "12", lang: "ru_RU" });
  if (points.length) params.set("pt", points.map((task, index) => `${task.lng},${task.lat},${task.urgent ? "pm2ywm" : "pm2blm"}${index + 1}`).join("~"));
  const href = `https://yandex.ru/maps/?${params}`;
  return <section className={expanded ? "yandex-map expanded-map" : "yandex-map"}>
    <div className="yandex-map-toolbar"><strong><MapPin size={17} />Красноярск · Яндекс Карты</strong><button onClick={() => setExpanded((current) => !current)} aria-label={expanded ? "Уменьшить карту" : "Увеличить карту"}><Maximize2 size={17} /></button><a href={href} target="_blank" rel="noreferrer" aria-label="Открыть в Яндекс Картах"><ExternalLink size={17} /></a></div>
    <iframe title="Яндекс Карты — объявления в Красноярске" src={`https://yandex.ru/map-widget/v1/?${params}`} allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
    {points.length > 0 && <div className="map-task-picker" aria-label="Объявления на карте">{points.map((task, index) => <div key={task.id} className={`map-task-option ${selected?.id === task.id ? "selected" : ""}`}><button className="map-focus-task" onClick={() => setFocused(task.id)}><span className={task.urgent ? "map-point-number urgent" : "map-point-number"}>{task.urgent ? <Zap size={13} /> : null}{index + 1}</span><span>{task.title}<b>{task.price ? `${task.price.toLocaleString("ru-RU")} ₽` : "Договорная"}</b></span></button><button className="map-open-task" onClick={() => onTask(task.id)}>Открыть</button></div>)}</div>}
    <p className="map-provider-note">Масштаб и жесты управляются Яндекс Картами. Выберите объявление под картой, чтобы приблизить адрес.</p>
  </section>;
}
