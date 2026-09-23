import { getRawDb } from "./server";
import { calculateStreak, krasnoyarskDay, milestoneForStreak } from "./flame-rules";
export { FLAME_REWARDS } from "./flame-rules";

export async function flameSummary(userId: string) {
  const db = getRawDb();
  const [daysResult, rewardsResult] = await Promise.all([
    db.prepare("SELECT day FROM flame_days WHERE user_id = ? ORDER BY day DESC LIMIT 12").bind(userId).all<{ day: string }>(),
    db.prepare("SELECT id, milestone, amount, day, status FROM flame_rewards WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").bind(userId).all<{ id: string; milestone: number; amount: number; day: string; status: string }>(),
  ]);
  const days = daysResult.results.map((row) => row.day);
  const today = krasnoyarskDay(Date.now());
  const streak = calculateStreak(days, today);
  return { streak, days, rewards: rewardsResult.results, nextMilestone: streak < 5 ? 5 : 10 };
}

export async function recordFlame(userId: string, taskId: string, timestamp: number) {
  const db = getRawDb();
  const day = krasnoyarskDay(timestamp);
  const inserted = await db.prepare("INSERT INTO flame_days (id, user_id, task_id, day, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING")
    .bind(crypto.randomUUID(), userId, taskId, day, timestamp).run();
  if (!inserted.meta.changes) return null;
  const summary = await flameSummary(userId);
  const reward = milestoneForStreak(summary.streak);
  if (reward) await db.prepare("INSERT INTO flame_rewards (id, user_id, milestone, amount, day, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending_review', ?) ON CONFLICT DO NOTHING")
    .bind(crypto.randomUUID(), userId, reward.days, reward.amount, day, timestamp).run();
  return { day, streak: summary.streak, reward: reward?.amount ?? null };
}
