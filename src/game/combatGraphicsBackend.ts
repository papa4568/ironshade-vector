import { ThreeCombatRenderer } from './threeCombatRenderer';

export type CombatGraphicsBackendId = 'webgl2';

export interface CombatGraphicsBackend {
  readonly id: CombatGraphicsBackendId;
  render(...args: Parameters<ThreeCombatRenderer['render']>): ReturnType<ThreeCombatRenderer['render']>;
  performanceStats(): ReturnType<ThreeCombatRenderer['performanceStats']>;
  screenDirection(...args: Parameters<ThreeCombatRenderer['screenDirection']>): ReturnType<ThreeCombatRenderer['screenDirection']>;
  dispose(): void;
}

export interface CombatGraphicsBackendFactory {
  readonly id: CombatGraphicsBackendId;
  isSupported(): boolean;
  create(canvas: HTMLCanvasElement, coarse: boolean): CombatGraphicsBackend;
}

class WebGl2CombatGraphicsBackend implements CombatGraphicsBackend {
  readonly id = 'webgl2' as const;
  private readonly renderer: ThreeCombatRenderer;

  constructor(canvas: HTMLCanvasElement, coarse: boolean) {
    this.renderer = new ThreeCombatRenderer(canvas, coarse);
  }

  render(...args: Parameters<ThreeCombatRenderer['render']>) {
    return this.renderer.render(...args);
  }

  performanceStats() {
    return this.renderer.performanceStats();
  }

  screenDirection(...args: Parameters<ThreeCombatRenderer['screenDirection']>) {
    return this.renderer.screenDirection(...args);
  }

  dispose() {
    this.renderer.dispose();
  }
}

export const productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'webgl2';

export type CombatGraphicsPathSelection = {
  mode: 'production-default' | 'qa-explicit';
  requestedId: CombatGraphicsBackendId | null;
  selectedId: CombatGraphicsBackendId;
};

export function resolveCombatGraphicsPathSelection(search: string): CombatGraphicsPathSelection {
  const params = new URLSearchParams(search);
  const requested = params.get('graphicsPath');
  if (params.get('graphicsCompare') === '1' && requested === 'webgl2') {
    return { mode: 'qa-explicit', requestedId: 'webgl2', selectedId: 'webgl2' };
  }
  return { mode: 'production-default', requestedId: null, selectedId: productionCombatGraphicsBackendId };
}

export const webgl2CombatGraphicsBackendFactory: CombatGraphicsBackendFactory = {
  id: 'webgl2',
  isSupported: () => ThreeCombatRenderer.isSupported(),
  create: (canvas, coarse) => new WebGl2CombatGraphicsBackend(canvas, coarse),
};

export function selectCombatGraphicsBackendFactory(
  factories: readonly CombatGraphicsBackendFactory[] = [webgl2CombatGraphicsBackendFactory],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
) {
  return factories.find(factory => factory.id === selectedId && factory.isSupported()) ?? null;
}

export function createCombatGraphicsBackend(
  canvas: HTMLCanvasElement,
  coarse: boolean,
  factories: readonly CombatGraphicsBackendFactory[] = [webgl2CombatGraphicsBackendFactory],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
) {
  return selectCombatGraphicsBackendFactory(factories, selectedId)?.create(canvas, coarse) ?? null;
}
