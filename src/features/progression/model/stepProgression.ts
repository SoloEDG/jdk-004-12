import type { GameDoc, FrameEvents } from "../../../shared/types";
import { generateDrops, collectDrops } from "../lib/drops";
import { rollChoices } from "./choices";
export function stepProgression(
  doc: GameDoc,
  events: FrameEvents,
  dt: number,
): void {
  // A lethal combat verdict is terminal for the step: no drops are generated or
  // consumed, no heal is applied and no upgrade choices are offered. Magnet
  // pulls, experience levels and max-Hp expansion therefore cannot revoke death.
  if (events.lethal || doc.player.hp <= 0) return;
  generateDrops(doc, events);
  collectDrops(doc, events, dt);
  if (
    doc.pendingLevels > 0 &&
    doc.phase === "playing" &&
    doc.player.hp > 0 &&
    !doc.victory
  )
    rollChoices(doc);
}
