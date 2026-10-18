import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { RenderBudgetSnapshot } from './renderQuality';

// Probe count follows actual focal assemblies, not a global or device-class ceiling.
// Every probe samples a different point in the same authored refinery world.
export const REFINERY_REFLECTION_PROFILE = Object.freeze({
  id: 'p28-e4-local-machinery-v1',
  faceSize: 256,
  captureMode: 'static-one-shot-staggered',
  families: ['processor', 'gantry', 'terminal'] as const,
});

export type RefineryReflectionFamily = typeof REFINERY_REFLECTION_PROFILE.families[number];
export type RefineryReflectionAnchor = {
  id: string;
  family: RefineryReflectionFamily;
  root: TransformNode;
};

export function isRefineryReflectionFamily(family: string): family is RefineryReflectionFamily {
  return REFINERY_REFLECTION_PROFILE.families.some(item => item === family);
}

type MaterialBinding = { mesh: Mesh; original: PBRMaterial; local: PBRMaterial };
type LocalProbe = {
  probe: ReflectionProbe;
  bindings: MaterialBinding[];
  captured: boolean;
};

export class BabylonRefineryReflectionProbes {
  private probes: LocalProbe[] = [];
  private captureMeshes: AbstractMesh[] = [];
  private nextCapture = 0;
  private completedCaptures = 0;
  private active = false;
  private generation = 0;

  constructor(private readonly scene: Scene, private readonly canvas: HTMLCanvasElement) {}

  configure(anchors: readonly RefineryReflectionAnchor[], refineryRoot: TransformNode) {
    this.release();
    // The actual authored environment is captured, never actors, telegraphs, HUD
    // markers or a reflected copy of the hero itself (which would recurse).
    const heroMeshes = new Set<AbstractMesh>(anchors.flatMap(anchor => anchor.root.getChildMeshes(false)));
    this.captureMeshes = refineryRoot.getChildMeshes(false)
      .filter(mesh => !heroMeshes.has(mesh) && mesh.isEnabled() && mesh.isVisible);

    for (const anchor of anchors) {
      const meshes = anchor.root.getChildMeshes(false)
        .filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.material instanceof PBRMaterial);
      if (!meshes.length) continue;
      anchor.root.computeWorldMatrix(true);
      const probe = new ReflectionProbe('p28-e4-' + anchor.id, REFINERY_REFLECTION_PROFILE.faceSize, this.scene, true);
      probe.position.copyFrom(anchor.root.getAbsolutePosition());
      probe.position.y += 1.7;
      // The list is populated only when scheduled; no duplicate six-face
      // captures are performed during stable gameplay frames.
      probe.cubeTexture.refreshRate = 0; // Babylon's RENDER_ONCE constant
      const bindings: MaterialBinding[] = [];
      for (const [index, mesh] of meshes.entries()) {
        const original = mesh.material as PBRMaterial;
        const local = original.clone('p28-e4-' + anchor.id + '-material-' + index) as PBRMaterial | null;
        if (!local) continue;
        local.realTimeFiltering = true; // rough PBR still samples the local cubemap coherently
        bindings.push({ mesh, original, local });
      }
      if (!bindings.length) {
        probe.dispose();
        continue;
      }
      this.probes.push({ probe, bindings, captured: false });
    }
    this.publishTelemetry();
  }

  sync(budget: RenderBudgetSnapshot) {
    // Explicit performance mode or measured adaptive pressure returns to the
    // existing global IBL without destroying already captured GPU resources.
    const qaIblDisabled = this.canvas.dataset.graphicsPathSelection === 'qa-explicit'
      && this.canvas.dataset.refineryIblQa === 'off';
    const active = budget.tierName !== 'performance' && budget.refineryIblScale > 0 && !qaIblDisabled;
    if (active !== this.active) {
      this.active = active;
      this.applyMaterials();
    }
    for (const record of this.probes) record.probe.cubeTexture.level = budget.refineryIblScale;
    if (active && this.nextCapture < this.probes.length) {
      const record = this.probes[this.nextCapture++];
      record.probe.renderList?.push(...this.captureMeshes);
      // An RTT may be visited once with an empty render list before its
      // assigned frame. Count only captures armed with actual refinery geometry.
      const generation = this.generation;
      record.probe.cubeTexture.onAfterUnbindObservable.addOnce(() => {
        if (this.generation !== generation || !this.probes.includes(record)) return;
        record.captured = true;
        this.completedCaptures += 1;
        this.applyMaterials();
        this.publishTelemetry();
      });
      record.probe.cubeTexture.resetRefreshCounter();
    }
    this.publishTelemetry();
  }

  private applyMaterials() {
    for (const record of this.probes) {
      for (const binding of record.bindings) {
        if (binding.mesh.isDisposed()) continue;
        if (this.active && record.captured) {
          binding.local.reflectionTexture = record.probe.cubeTexture;
          binding.mesh.material = binding.local;
        } else {
          binding.mesh.material = binding.original;
        }
      }
    }
  }

  private publishTelemetry() {
    const bound = this.probes.reduce((total, record) => total + record.bindings.length, 0);
    const activeMaterials = this.probes.reduce((total, record) => total + record.bindings.filter(binding =>
      !binding.mesh.isDisposed() && binding.mesh.material === binding.local).length, 0);
    // RGBA8 six-face allocation with a full mip pyramid; conservative byte estimate.
    const faceBytes = REFINERY_REFLECTION_PROFILE.faceSize ** 2 * 4;
    const estimatedBytes = Math.ceil(this.probes.length * 6 * faceBytes * 4 / 3);
    this.canvas.dataset.refineryReflectionProbes = [
      REFINERY_REFLECTION_PROFILE.id,
      'state:' + (this.active ? 'local' : 'global-ibl'),
      'probes:' + this.probes.length,
      'materials:' + bound,
      'active-materials:' + activeMaterials,
      'capture-geometry:' + this.captureMeshes.length,
      'faces:' + this.probes.length * 6,
      'scheduled:' + this.nextCapture,
      'completed:' + this.completedCaptures,
      'resident-estimate-bytes:' + estimatedBytes,
      'update:' + REFINERY_REFLECTION_PROFILE.captureMode,
    ].join('|');
  }

  get probeCount() { return this.probes.length; }
  get materialCount() { return this.probes.reduce((total, record) => total + record.bindings.length, 0); }

  release() {
    // Release before authored GLB instances so their shared source materials
    // never retain a probe texture or a per-placement PBR clone.
    this.generation += 1;
    for (const record of this.probes) {
      for (const binding of record.bindings) {
        if (!binding.mesh.isDisposed()) binding.mesh.material = binding.original;
        binding.local.dispose();
      }
      record.probe.dispose();
    }
    this.probes = [];
    this.captureMeshes = [];
    this.nextCapture = 0;
    this.completedCaptures = 0;
    this.active = false;
    delete this.canvas.dataset.refineryReflectionProbes;
  }

  dispose() { this.release(); }
}
