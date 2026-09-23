import test from "node:test";
import assert from "node:assert/strict";
import { calculateStreak, krasnoyarskDay, milestoneForStreak } from "../lib/flame-rules.ts";

test("uses Krasnoyarsk calendar day at UTC boundary", () => {
  assert.equal(krasnoyarskDay(Date.parse("2026-09-22T17:00:00Z")), "2026-09-23");
});

test("continues a streak through today or yesterday, including month boundary", () => {
  assert.equal(calculateStreak(["2026-10-01", "2026-09-30", "2026-09-29"], "2026-10-01"), 3);
  assert.equal(calculateStreak(["2026-09-30", "2026-09-29"], "2026-10-01"), 2);
  assert.equal(calculateStreak(["2026-09-29", "2026-09-28"], "2026-10-01"), 0);
});

test("issues milestones only at five and ten days", () => {
  assert.equal(milestoneForStreak(4), null);
  assert.deepEqual(milestoneForStreak(5), { days: 5, amount: 150 });
  assert.deepEqual(milestoneForStreak(10), { days: 10, amount: 300 });
  assert.equal(milestoneForStreak(11), null);
});
