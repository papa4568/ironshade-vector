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

export const webgl2CombatGraphicsBackendFactory: CombatGraphicsBackendFactory = {
  id: 'webgl2',
  isSupported: () => ThreeCombatRenderer.isSupported(),
  create: (canvas, coarse) => new WebGl2CombatGraphicsBackend(canvas, coarse),
};

export function selectCombatGraphicsBackendFactory(
  factories: readonly CombatGraphicsBackendFactory[] = [webgl2CombatGraphicsBackendFactory],
) {
  return factories.find(factory => factory.id === productionCombatGraphicsBackendId && factory.isSupported()) ?? null;
}

export function createCombatGraphicsBackend(
  canvas: HTMLCanvasElement,
  coarse: boolean,
  factories: readonly CombatGraphicsBackendFactory[] = [webgl2CombatGraphicsBackendFactory],
) {
  return selectCombatGraphicsBackendFactory(factories)?.create(canvas, coarse) ?? null;
}
