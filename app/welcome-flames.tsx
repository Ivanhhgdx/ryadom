"use client";

import { useEffect, useState } from "react";
import { Check, Flame, MapPin, MessageCircle, ShieldCheck, X } from "lucide-react";

type FlameData = { streak: number; days: string[]; nextMilestone: number; rewards: Array<{ id: string; amount: number; milestone: number; status: string }> };
function welcomeKey(userId?: string) { return `ryadom:welcome:v1:${userId || "guest"}`; }

export function WelcomeAndFlames({ userId }: { userId?: string }) {
  const [welcome, setWelcome] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [data, setData] = useState<FlameData | null>(null);

  useEffect(() => {
    try { if (!localStorage.getItem(welcomeKey(userId))) queueMicrotask(() => setWelcome(true)); } catch { /* Private browsing can deny storage. */ }
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const refresh = () => { if (document.hidden) return; void fetch("/api/flames").then(async (response): Promise<FlameData | null> => response.ok ? await response.json() as FlameData : null).then((result) => {
      if (!active || !result) return;
      setData(result);
      const newest = result.days[0];
      const key = `ryadom:flame-seen:${userId}`;
      try {
        const seen = localStorage.getItem(key);
        if (newest && seen !== newest) setCelebrate(true);
        localStorage.setItem(key, newest || "none");
      } catch { /* Celebration is optional if storage is disabled. */ }
    }).catch(() => undefined); };
    refresh();
    const timer = window.setInterval(refresh, 45000);
    return () => { active = false; clearInterval(timer); };
  }, [userId]);

  function dismissWelcome() {
    try { localStorage.setItem(welcomeKey(userId), "1"); } catch { /* Ignore storage errors. */ }
    setWelcome(false);
  }

  return <>
    <button className="flame-banner" onClick={() => setWelcome(true)} aria-label="Открыть правила программы Огоньки">
      <span className="flame-banner-icon"><Flame size={25} fill="currentColor" /></span>
      <span className="flame-banner-copy"><strong>Огоньки за выполненные задачи</strong><small>{userId ? `${data?.streak ?? 0} подряд · 150 ₽ за 5 дней, 300 ₽ за 10 дней` : "150 ₽ за 5 дней · 300 ₽ за 10 дней"}</small></span>
      <span className="flame-banner-more">Как это работает →</span>
    </button>
    {userId && data && data.streak > 0 ? <div className="flame-progress" aria-label={`${data.streak} огоньков подряд`}>
      <strong><Flame size={18} fill="currentColor" /> {data.streak} {data.streak === 1 ? "огонёк" : data.streak < 5 ? "огонька" : "огоньков"} подряд</strong>
      <span>{data.streak >= 10 ? "Вы достигли обеих отметок" : `Следующая отметка: ${data.nextMilestone} дней`}</span>
      <div className="flame-progress-track"><i style={{ width: `${Math.min(100, data.streak / data.nextMilestone * 100)}%` }} /></div>
      {data.rewards.some((reward) => reward.status === "pending_review") ? <small>Награды ожидают проверки и подключения выплат.</small> : null}
    </div> : null}
    {welcome ? <div className="experience-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div className="experience-card welcome-card">
      <button className="experience-close" onClick={dismissWelcome} aria-label="Закрыть приветствие"><X size={20} /></button>
      <div className="experience-brand"><img src="/ryadom-logo.png" alt="" width="42" height="42" /><b>рядом</b></div>
      <span className="experience-eyebrow">ДОБРО ПОЖАЛОВАТЬ</span>
      <h2 id="welcome-title">Дела находятся рядом. Люди тоже.</h2>
      <p className="experience-intro">Публикуйте задачу, находите исполнителя в Красноярске и договаривайтесь напрямую в чате. Или выбирайте заказы и зарабатывайте рядом с домом.</p>
      <div className="welcome-features"><div><MapPin size={21} /><span><b>Задачи в городе</b><small>Поиск по району и формату работы</small></span></div><div><MessageCircle size={21} /><span><b>Общение в приложении</b><small>Отклики, чат и уведомления</small></span></div><div><ShieldCheck size={21} /><span><b>История работы</b><small>Подтверждения и отзывы в профиле</small></span></div></div>
      <div className="welcome-rewards"><span className="welcome-rewards-icon"><Flame fill="currentColor" size={27} /></span><div><b>Зажигайте огоньки</b><p>Выполняйте хотя бы одну задачу каждый день подряд. За 5 дней — 150 ₽, за 10 дней — ещё 300 ₽.</p><small>Огоньки начисляются после подтверждения заказчиком. Денежные награды проходят проверку; выплаты начнутся после подключения платёжного сервиса.</small></div></div>
      <button className="experience-primary" onClick={dismissWelcome}>Начать пользоваться <span>→</span></button>
    </div></div> : null}
    {celebrate && !welcome ? <div className="experience-overlay" role="dialog" aria-modal="true" aria-labelledby="flame-title"><div className="experience-card flame-celebration">
      <span className="flame-celebration-icon"><Flame size={65} fill="currentColor" /></span>
      <span className="experience-eyebrow">ЗАДАЧА ЗАВЕРШЕНА</span>
      <h2 id="flame-title">Ваш огонёк зажёгся!</h2>
      <p>Сегодня вы помогли человеку рядом. {data?.streak ?? 1} дней подряд — отличный ритм. Возвращайтесь завтра за следующим огоньком.</p>
      <div className="flame-celebration-count"><Check size={20} /> {data?.streak ?? 1} из {data?.nextMilestone ?? 5} дней</div>
      {data?.rewards.some((reward) => reward.milestone === data.streak && reward.status === "pending_review") ? <p className="flame-reward-note">Награда {data.rewards.find((reward) => reward.milestone === data.streak)?.amount} ₽ за эту отметку записана и ожидает проверки. Выплаты будут доступны после подключения платёжного сервиса.</p> : null}
      <button className="experience-primary" onClick={() => setCelebrate(false)}>Продолжить</button>
    </div></div> : null}
  </>;
}
