export const COMBAT_COMPACT_MAX_WIDTH = 900;

export const combatPointerMedia = {
  primaryCoarse: '(pointer: coarse)',
  primaryFine: '(pointer: fine)',
  anyCoarse: '(any-pointer: coarse)',
  anyFine: '(any-pointer: fine)',
} as const;

export type CombatInputCapabilities = {
  compactLayout: boolean;
  finePointerAvailable: boolean;
  touchPointerAvailable: boolean;
  primaryPointer: 'coarse' | 'fine' | 'none';
};

export type CombatInputCapabilitySnapshot = {
  viewportWidth: number;
  primaryCoarse: boolean;
  primaryFine: boolean;
  anyCoarse: boolean;
  anyFine: boolean;
};

export type PointerCapabilityQuery = {
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
};

export const defaultCombatInputCapabilities: CombatInputCapabilities = {
  compactLayout: false,
  finePointerAvailable: true,
  touchPointerAvailable: false,
  primaryPointer: 'fine',
};

export function resolveCombatInputCapabilities(snapshot: CombatInputCapabilitySnapshot): CombatInputCapabilities {
  const primaryPointer = snapshot.primaryFine ? 'fine' : snapshot.primaryCoarse ? 'coarse' : 'none';
  return {
    compactLayout: snapshot.primaryCoarse || snapshot.viewportWidth <= COMBAT_COMPACT_MAX_WIDTH,
    finePointerAvailable: snapshot.primaryFine || snapshot.anyFine,
    touchPointerAvailable: snapshot.primaryCoarse || snapshot.anyCoarse,
    primaryPointer,
  };
}

export function subscribePointerCapabilityChanges(queries: readonly PointerCapabilityQuery[], listener: () => void) {
  for (const query of queries) query.addEventListener('change', listener);
  return () => {
    for (const query of queries) query.removeEventListener('change', listener);
  };
}

export function keyboardMoveFromCodes(codes: ReadonlySet<string>) {
  return {
    x: (codes.has('KeyD') ? 1 : 0) - (codes.has('KeyA') ? 1 : 0),
    y: (codes.has('KeyS') ? 1 : 0) - (codes.has('KeyW') ? 1 : 0),
  };
}
