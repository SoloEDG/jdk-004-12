import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/shared/createRun";
import { stepCombat } from "../src/features/combat";
import { stepWaves } from "../src/features/waves";
import { stepArsenal } from "../src/features/arsenal";
import { stepProgression, chooseUpgrade } from "../src/features/progression";
import { stepResults } from "../src/features/results";
import type { FrameEvents } from "../src/shared/types";
const input = { x: 0, y: 0, aim: { x: 700, y: 325 }, firing: false };
const events = (): FrameEvents => ({
  kills: [],
  damage: 0,
  taken: 0,
  shots: 0,
  collected: 0,
  lethal: false,
});
const enemy = (id = 1) => ({
  id,
  kind: "chaser" as const,
  x: 600,
  y: 325,
  hp: 10,
  maxHp: 10,
  radius: 12,
  cooldown: 0,
});
test("automatic fire acquires a target without pointer firing", () => {
  const d = createRun();
  d.enemies = [enemy()];
  assert.ok(stepArsenal(d, input, 1 / 60) > 0);
  assert.ok(d.bullets.some((b) => b.owner === "player"));
});
test("collision kills once, reports actual damage and prevents duplicate piercing hits", () => {
  const d = createRun();
  d.enemies = [enemy()];
  d.bullets = [
    {
      id: 2,
      x: 600,
      y: 325,
      vx: 0,
      vy: 0,
      radius: 5,
      damage: 20,
      life: 1,
      owner: "player",
      weapon: "pulse",
      pierce: 2,
      hit: [],
    },
  ];
  const e = stepCombat(d, input, 0);
  assert.equal(e.kills.length, 1);
  assert.equal(e.damage, 10);
  assert.equal(stepCombat(d, input, 0).kills.length, 0);
});
test("contact invincibility prevents repeated frame damage", () => {
  const d = createRun();
  d.enemies = [{ ...enemy(), x: 500 }];
  assert.ok(stepCombat(d, input, 0).taken > 0);
  assert.equal(stepCombat(d, input, 0).taken, 0);
});
test("large experience pickup queues every level and choices consume one at a time", () => {
  const d = createRun();
  d.phase = "playing";
  d.drops = [{ id: 4, x: 500, y: 325, kind: "xp", value: 100, life: 30 }];
  stepProgression(d, events(), 0);
  assert.equal(d.phase, "upgrade");
  assert.ok(d.pendingLevels > 1);
  const pending = d.pendingLevels;
  chooseUpgrade(d, d.choices[0]);
  assert.equal(d.pendingLevels, pending - 1);
  assert.equal(d.phase, "upgrade");
  while (d.pendingLevels) chooseUpgrade(d, d.choices[0]);
  assert.equal(d.phase, "playing");
});
test("eight elapsed waves signal victory", () => {
  const d = createRun();
  d.wave = 8;
  d.waveTime = 29.99;
  stepWaves(d, 0.02);
  assert.equal(d.victory, true);
});
test("finished results append a single immutable record", () => {
  const d = createRun();
  d.phase = "playing";
  d.player.hp = 0;
  stepResults(d, events());
  assert.equal(d.phase, "ended");
  assert.equal(d.records.length, 1);
  stepResults(d, events());
  assert.equal(d.records.length, 1);
});
test("weapon damage includes nonlethal hits and ignores overkill", () => {
  const d = createRun();
  d.enemies = [{ ...enemy(), hp: 30, maxHp: 30 }];
  d.bullets = [
    {
      id: 2,
      x: 600,
      y: 325,
      vx: 0,
      vy: 0,
      radius: 5,
      damage: 20,
      life: 1,
      owner: "player",
      weapon: "pulse",
      pierce: 0,
      hit: [],
    },
  ];
  const e = stepCombat(d, input, 0);
  stepResults(d, e);
  assert.equal(d.stats.byWeapon.pulse, 20);
  assert.equal(d.stats.kills, 0);
});
test("a lethal verdict blocks drops, heal and the upgrade queue", () => {
  const d = createRun();
  d.phase = "playing";
  d.player.hp = 10;
  d.pendingLevels = 2;
  d.drops = [
    { id: 10, x: 500, y: 325, kind: "heal", value: 18, life: 30 },
    { id: 11, x: 502, y: 325, kind: "xp", value: 50, life: 30 },
    { id: 12, x: 504, y: 325, kind: "magnet", value: 1, life: 30 },
  ];
  const e = events();
  e.lethal = true;
  stepProgression(d, e, 0);
  // Nothing is consumed: heal cannot revive, magnet/xp cannot feed a level-up.
  assert.equal(d.player.hp, 10);
  assert.equal(d.drops.length, 3);
  assert.equal(e.collected, 0);
  assert.equal(d.phase, "playing");
  assert.equal(d.choices.length, 0);
  assert.equal(d.pendingLevels, 2);
});
test("the lethal verdict ends the run as defeat even when the final wave clears", () => {
  const d = createRun();
  d.phase = "playing";
  d.victory = true;
  d.player.hp = 0;
  d.pendingLevels = 1;
  const e = events();
  e.lethal = true;
  e.taken = 100;
  stepResults(d, e);
  assert.equal(d.phase, "ended");
  assert.equal(d.victory, false);
  assert.equal(d.pendingLevels, 0);
  assert.equal(d.records.length, 1);
  assert.equal(d.records[0].victory, false);
  assert.equal(d.stats.taken, 100);
  // Repeated animation frames must never append a second record.
  stepResults(d, e);
  assert.equal(d.records.length, 1);
});
test("non-lethal damage still lets a heal drop restore life", () => {
  const d = createRun();
  d.phase = "playing";
  d.player.hp = 40;
  d.drops = [{ id: 9, x: 500, y: 325, kind: "heal", value: 18, life: 30 }];
  const e = events();
  stepProgression(d, e, 0);
  assert.equal(d.player.hp, 58);
  assert.equal(e.collected, 1);
  assert.equal(d.drops.length, 0);
  assert.equal(d.phase, "playing");
});
