import type { GameDoc, FrameEvents } from "../../../shared/types";
import { applyEvents, makeRecord } from "./ledger";
import { saveRecords } from "../lib/storage";
export function stepResults(doc: GameDoc, events: FrameEvents): void {
  if (doc.phase === "ended") return;
  applyEvents(doc, events);
  // The combat step's lethal verdict is the terminal authority for the run.
  // It cannot be revoked by heal/magnet/level-up rewards resolved in the same
  // step, and it even overrides a wave-clear victory that lands on that frame.
  const dead = events.lethal || doc.player.hp <= 0;
  if (!dead && !doc.victory) return;
  if (dead) doc.victory = false;
  // End the run before persistence, making repeated animation frames idempotent.
  doc.phase = "ended";
  doc.choices = [];
  doc.pendingLevels = 0;
  doc.notice = doc.victory ? "撤离成功 · 信号保全" : "信号中断 · 再次连接";
  doc.records = [makeRecord(doc), ...doc.records].slice(0, 20);
  saveRecords(doc.records);
}
