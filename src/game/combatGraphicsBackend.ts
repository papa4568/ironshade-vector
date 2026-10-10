export * from './combatGraphicsBackendCore';

import {
  babylonCombatGraphicsBackendFactory as coreBabylonCombatGraphicsBackendFactory,
  productionCombatGraphicsBackendId,
  type CombatGraphicsBackend,
  type CombatGraphicsBackendCreateOptions,
  type CombatGraphicsBackendFactory,
  type CombatGraphicsBackendId,
  type CombatGraphicsPointerProjectionArgs,
  type CombatGraphicsRenderArgs,
} from './combatGraphicsBackendCore';
import type { Player, SimState } from './sim';

export function createCombatGraphicsRenderSnapshot(state: SimState): SimState {
  return structuredClone(state);
}

export function createCombatGraphicsPlayerSnapshot(player: Player): Player {
  return structuredClone(player);
}

class SnapshotIsolatedCombatGraphicsBackend implements CombatGraphicsBackend {
  constructor(private readonly delegate: CombatGraphicsBackend) {}

  get id() {
    return this.delegate.id;
  }

  get loadedId() {
    return this.delegate.loadedId;
  }

  render(...args: CombatGraphicsRenderArgs) {
    const snapshotArgs: CombatGraphicsRenderArgs = [...args];
    snapshotArgs[0] = createCombatGraphicsRenderSnapshot(args[0]);
    this.delegate.render(...snapshotArgs);
  }

  missionVisualReadiness() {
    const readiness = this.delegate.missionVisualReadiness;
    if (!readiness) throw new Error('Babylon graphics delegate must expose mission visual readiness.');
    return readiness.call(this.delegate);
  }

  performanceStats() {
    return this.delegate.performanceStats();
  }

  screenDirection(...args: CombatGraphicsPointerProjectionArgs) {
    const snapshotArgs: CombatGraphicsPointerProjectionArgs = [...args];
    snapshotArgs[3] = createCombatGraphicsPlayerSnapshot(args[3]);
    return this.delegate.screenDirection(...snapshotArgs);
  }

  dispose() {
    this.delegate.dispose();
  }
}

export const babylonCombatGraphicsBackendFactory: CombatGraphicsBackendFactory = {
  id: coreBabylonCombatGraphicsBackendFactory.id,
  isSupported: () => coreBabylonCombatGraphicsBackendFactory.isSupported(),
  create: (canvas, coarse, options) => new SnapshotIsolatedCombatGraphicsBackend(
    coreBabylonCombatGraphicsBackendFactory.create(canvas, coarse, options),
  ),
};

export function selectCombatGraphicsBackendFactory(
  factories: readonly CombatGraphicsBackendFactory[] = [babylonCombatGraphicsBackendFactory],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
) {
  return factories.find(factory => factory.id === selectedId && factory.isSupported()) ?? null;
}

export function createCombatGraphicsBackend(
  canvas: HTMLCanvasElement,
  coarse: boolean,
  factories: readonly CombatGraphicsBackendFactory[] = [babylonCombatGraphicsBackendFactory],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
  options?: CombatGraphicsBackendCreateOptions,
) {
  return selectCombatGraphicsBackendFactory(factories, selectedId)?.create(canvas, coarse, options) ?? null;
}
