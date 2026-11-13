import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/shared/createRun";
import { simulate } from "../src/app/simulate";
test("pause freezes all simulation including bullets, drops, waves and cooldowns", () => {
  const d = createRun();
  d.phase = "paused";
  const before = JSON.stringify(d);
  simulate(d, { x: 1, y: 0, aim: { x: 0, y: 0 }, firing: true }, 1 / 60);
  assert.equal(JSON.stringify(d), before);
});
test("playing advances battle time and wave", () => {
  const d = createRun();
  d.phase = "playing";
  simulate(d, { x: 0, y: 0, aim: { x: 0, y: 0 }, firing: false }, 1 / 60);
  assert.ok(d.time > 0);
  assert.equal(d.wave, 1);
});
test("a lethal combat step cannot be undone by heal, magnet or a level-up in the same step", () => {
  const d = createRun();
  d.phase = "playing";
  d.spawnBudget = -100;
  d.player.hp = 20;
  d.enemies = [
    {
      id: 1,
      kind: "elite",
      x: 500,
      y: 325,
      hp: 9999,
      maxHp: 9999,
      radius: 22,
      cooldown: 10,
    },
  ];
  d.drops = [
    { id: 2, x: 500, y: 325, kind: "heal", value: 18, life: 30 },
    { id: 3, x: 502, y: 325, kind: "xp", value: 200, life: 30 },
    { id: 4, x: 504, y: 325, kind: "magnet", value: 1, life: 30 },
  ];
  const levelBefore = d.level;
  simulate(
    d,
    { x: 0, y: 0, aim: { x: 500, y: 0 }, firing: false },
    1 / 60,
  );
  // Death is confirmed by the combat step and survives every same-step reward.
  assert.equal(d.player.hp, 0);
  assert.equal(d.phase, "ended");
  assert.equal(d.victory, false);
  assert.equal(d.choices.length, 0);
  assert.equal(d.pendingLevels, 0);
  assert.equal(d.level, levelBefore);
  assert.equal(d.stats.collected, 0);
  assert.equal(d.drops.length, 3);
  assert.ok(d.stats.taken > 0);
  // Exactly one settlement for the whole frame.
  assert.equal(d.records.length, 1);
  assert.equal(d.records[0].victory, false);
});
test("healing after a non-lethal step still works and keeps the run playing", () => {
  const d = createRun();
  d.phase = "playing";
  d.spawnBudget = -100;
  d.player.hp = 60;
  d.drops = [{ id: 5, x: 500, y: 325, kind: "heal", value: 18, life: 30 }];
  simulate(
    d,
    { x: 0, y: 0, aim: { x: 500, y: 0 }, firing: false },
    1 / 60,
  );
  assert.equal(d.phase, "playing");
  assert.equal(d.player.hp, 78);
  assert.equal(d.stats.collected, 1);
  assert.equal(d.drops.length, 0);
});
test("restarting begins a clean run without old drops or re-counted records", () => {
  const d = createRun();
  d.phase = "playing";
  d.spawnBudget = -100;
  d.player.hp = 20;
  d.drops = [{ id: 6, x: 500, y: 325, kind: "heal", value: 18, life: 30 }];
  d.enemies = [
    {
      id: 7,
      kind: "elite",
      x: 500,
      y: 325,
      hp: 9999,
      maxHp: 9999,
      radius: 22,
      cooldown: 10,
    },
  ];
  simulate(
    d,
    { x: 0, y: 0, aim: { x: 500, y: 0 }, firing: false },
    1 / 60,
  );
  assert.equal(d.phase, "ended");
  assert.equal(d.records.length, 1);
  // A restart builds a fresh document but carries the historical records over.
  const fresh = createRun(204004, d.records);
  assert.equal(fresh.drops.length, 0);
  assert.equal(fresh.enemies.length, 0);
  assert.equal(fresh.player.hp, fresh.player.maxHp);
  assert.equal(fresh.stats.kills, 0);
  assert.equal(fresh.stats.taken, 0);
  assert.equal(fresh.records, d.records);
  assert.equal(fresh.records.length, 1);
  // Ending the new run adds exactly one record and never re-counts the old run.
  fresh.phase = "playing";
  fresh.spawnBudget = -100;
  fresh.player.hp = 5;
  fresh.enemies = [
    {
      id: 8,
      kind: "elite",
      x: 500,
      y: 325,
      hp: 9999,
      maxHp: 9999,
      radius: 22,
      cooldown: 10,
    },
  ];
  simulate(
    fresh,
    { x: 0, y: 0, aim: { x: 500, y: 0 }, firing: false },
    1 / 60,
  );
  assert.equal(fresh.phase, "ended");
  assert.equal(fresh.records.length, 2);
  assert.equal(fresh.stats.taken, 5);
});
