import type { GameDoc, Input } from "../shared/types";
import { stepCombat } from "../features/combat";
import { stepWaves } from "../features/waves";
import { stepArsenal } from "../features/arsenal";
import { stepProgression } from "../features/progression";
import { stepResults } from "../features/results";
export function simulate(doc: GameDoc, input: Input, dt: number) {
  if (doc.phase !== "playing") return;
  doc.time += dt;
  stepWaves(doc, dt);
  const shots = stepArsenal(doc, input, dt);
  const events = stepCombat(doc, input, dt);
  events.shots += shots;
  // Resolve the lethal verdict before any reward. A confirmed death is terminal:
  // skip drop generation/collection (heal, magnet, experience) and level-up
  // choices so nothing in this step can revive the operator or queue upgrades.
  if (!events.lethal && doc.player.hp > 0)
    stepProgression(doc, events, dt);
  stepResults(doc, events);
}
