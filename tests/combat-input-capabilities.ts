import { readFileSync } from 'node:fs';
import {
  combatPointerMedia,
  keyboardMoveFromCodes,
  resolveCombatInputCapabilities,
  subscribePointerCapabilityChanges,
  type PointerCapabilityQuery,
} from '../src/game/combatInputCapabilities';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const narrowFine = resolveCombatInputCapabilities({
  viewportWidth: 720,
  primaryCoarse: false,
  primaryFine: true,
  anyCoarse: false,
  anyFine: true,
});
assert(narrowFine.compactLayout, 'P24-A narrow fine-pointer devices must retain compact combat layout.');
assert(narrowFine.primaryPointer === 'fine' && narrowFine.finePointerAvailable, 'P24-A narrow fine-pointer devices must retain mouse/fine-pointer capability.');
assert(!narrowFine.touchPointerAvailable, 'P24-A fine-pointer-only devices must not be treated as touch-capable.');
const narrowKeyboardMove = keyboardMoveFromCodes(new Set(['KeyW', 'KeyD']));
assert(narrowKeyboardMove.x === 1 && narrowKeyboardMove.y === -1, 'P24-A WASD must remain available on narrow fine-pointer devices.');

const coarseTouch = resolveCombatInputCapabilities({
  viewportWidth: 820,
  primaryCoarse: true,
  primaryFine: false,
  anyCoarse: true,
  anyFine: false,
});
assert(coarseTouch.compactLayout, 'P24-A coarse touch devices must retain compact combat layout.');
assert(coarseTouch.touchPointerAvailable && !coarseTouch.finePointerAvailable && coarseTouch.primaryPointer === 'coarse', 'P24-A coarse touch capability must remain touch-first.');
const touchKeyboardMove = keyboardMoveFromCodes(new Set(['KeyA', 'KeyS']));
assert(touchKeyboardMove.x === -1 && touchKeyboardMove.y === 1, 'P24-A an attached keyboard must not be disabled by touch/compact layout.');

class FakePointerQuery implements PointerCapabilityQuery {
  private listeners = new Set<() => void>();
  addEventListener(type: 'change', listener: () => void) {
    assert(type === 'change', 'P24-A pointer subscriptions must listen to media-query changes.');
    this.listeners.add(listener);
  }
  removeEventListener(type: 'change', listener: () => void) {
    assert(type === 'change', 'P24-A pointer cleanup must remove media-query change listeners.');
    this.listeners.delete(listener);
  }
  emitChange() {
    for (const listener of this.listeners) listener();
  }
}

const hybridQuery = new FakePointerQuery();
let hybridFine = false;
const hybridSnapshots: boolean[] = [];
const unsubscribe = subscribePointerCapabilityChanges([hybridQuery], () => {
  hybridSnapshots.push(resolveCombatInputCapabilities({
    viewportWidth: 800,
    primaryCoarse: true,
    primaryFine: false,
    anyCoarse: true,
    anyFine: hybridFine,
  }).finePointerAvailable);
});
hybridFine = true;
hybridQuery.emitChange();
hybridFine = false;
hybridQuery.emitChange();
assert(hybridSnapshots.length === 2 && hybridSnapshots[0] === true && hybridSnapshots[1] === false, 'P24-A hybrid mouse attach/remove must update from pointer media-query changes without a resize.');
unsubscribe();
hybridFine = true;
hybridQuery.emitChange();
assert(hybridSnapshots.length === 2, 'P24-A pointer capability subscriptions must clean up listeners.');

const gameCanvas = readFileSync('src/components/GameCanvas.tsx', 'utf8');
for (const query of Object.values(combatPointerMedia)) {
  assert(gameCanvas.includes(`window.matchMedia(combatPointerMedia.${Object.entries(combatPointerMedia).find(([, value]) => value === query)?.[0]})`), `P24-A GameCanvas must read ${query} capability.`);
}
assert(gameCanvas.includes('subscribePointerCapabilityChanges(pointerQueries, update)'), 'P24-A GameCanvas must subscribe directly to pointer-capability changes.');
assert(gameCanvas.includes('const keyMove = keyboardMoveFromCodes(keys);') && gameCanvas.includes('else if (keyMove.x !== 0 || keyMove.y !== 0) setMove(state, keyMove);'), 'P24-A GameCanvas must apply keyboard movement independently of compact layout.');
assert(!gameCanvas.includes('!compactLayout && (keyMove.x !== 0 || keyMove.y !== 0)'), 'P24-A compact layout must not gate WASD movement.');
assert(gameCanvas.includes("pointerUsesFineInput(event.pointerType, inputCapabilities)"), 'P24-A canvas pointer routing must use the actual pointer event modality.');
assert(gameCanvas.includes("data-fine-pointer-available={inputCapabilities.finePointerAvailable ? 'true' : 'false'}") && gameCanvas.includes("data-touch-pointer-available={inputCapabilities.touchPointerAvailable ? 'true' : 'false'}"), 'P24-A live capability state must be exposed for runtime QA.');

console.log('P24_A_COMBAT_INPUT_CAPABILITIES_PASS narrow=compact+wasd coarse=touch+keyboard hybrid=media-change-live pointer=event-modality');
