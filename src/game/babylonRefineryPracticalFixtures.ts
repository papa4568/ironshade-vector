import type { PointLight } from '@babylonjs/core/Lights/pointLight';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

// The coordinates are local to the two already-authored refinery practical lights.
// No new light, collision surface, gameplay object, or per-frame scene scan is added.
export const REFINERY_PRACTICAL_FIXTURE_PROFILE = Object.freeze({
  id: 'p28-e3-light-linked-emissive-v1',
  assemblies: [
    {
      id: 'furnace',
      surfaces: [
        { role: 'furnace-port', offset: [0, -0.25, 0], size: [1.32, 0.07, 0.68], color: 0xffb36c, glow: 1.38 },
        { role: 'warning-beacon', offset: [-1.05, -0.42, 0.42], size: [0.22, 0.12, 0.22], color: 0xff994d, glow: 1.12 },
        { role: 'machinery-indicator', offset: [0.96, -0.40, -0.54], size: [0.46, 0.06, 0.18], color: 0xffb36c, glow: 0.92 },
      ],
    },
    {
      id: 'service',
      surfaces: [
        { role: 'terminal-bank', offset: [0, -0.20, 0], size: [1.05, 0.06, 0.48], color: 0x6edce7, glow: 1.22 },
        { role: 'warning-beacon', offset: [-0.82, -0.37, 0.36], size: [0.20, 0.12, 0.20], color: 0xff994d, glow: 1.05 },
        { role: 'machinery-indicator', offset: [0.84, -0.37, -0.43], size: [0.54, 0.06, 0.16], color: 0x6edce7, glow: 0.92 },
      ],
    },
  ],
} as const);

type FixtureAssembly = { root: TransformNode; emitters: Mesh[] };

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 255, (hex >> 8) & 255, hex & 255);
}

export class BabylonRefineryPracticalFixtures {
  private readonly assemblies: FixtureAssembly[] = [];
  private readonly materials: PBRMaterial[] = [];
  private enabled = false;

  constructor(scene: Scene) {
    for (const assembly of REFINERY_PRACTICAL_FIXTURE_PROFILE.assemblies) {
      const root = new TransformNode('p28-e3-refinery-' + assembly.id + '-fixture-root', scene);
      const body = new PBRMaterial('p28-e3-refinery-' + assembly.id + '-housing-material', scene);
      body.albedoColor = new Color3(0.13, 0.19, 0.21);
      body.metallic = 0.7;
      body.roughness = 0.38;
      this.materials.push(body);

      const emitters: Mesh[] = [];
      for (const surface of assembly.surfaces) {
        const [x, y, z] = surface.offset;
        const [width, height, depth] = surface.size;
        const housing = MeshBuilder.CreateBox(
          'p28-e3-refinery-' + surface.role + '-housing-' + assembly.id,
          { width: width + 0.14, height: height + 0.10, depth: depth + 0.14 },
          scene,
        );
        housing.parent = root;
        housing.position.set(x, y - 0.045, z);
        housing.material = body;
        housing.isPickable = false;
        housing.receiveShadows = false;

        const emitterMaterial = new PBRMaterial(
          'p28-e3-refinery-' + surface.role + '-emissive-material-' + assembly.id,
          scene,
        );
        const tint = colorFromHex(surface.color);
        emitterMaterial.albedoColor = tint.scale(0.18);
        emitterMaterial.emissiveColor = tint.scale(surface.glow);
        emitterMaterial.metallic = 0.12;
        emitterMaterial.roughness = 0.24;
        this.materials.push(emitterMaterial);

        const emitter = MeshBuilder.CreateBox(
          'p28-e3-refinery-' + surface.role + '-emitter-' + assembly.id,
          { width, height, depth },
          scene,
        );
        emitter.parent = root;
        emitter.position.set(x, y + 0.047, z);
        emitter.material = emitterMaterial;
        emitter.isPickable = false;
        emitter.receiveShadows = false;
        emitters.push(emitter);
      }
      root.setEnabled(false);
      this.assemblies.push({ root, emitters });
    }
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    for (const assembly of this.assemblies) assembly.root.setEnabled(enabled);
  }

  sync(practicals: readonly PointLight[], activeCount: number) {
    for (let index = 0; index < this.assemblies.length; index += 1) {
      const assembly = this.assemblies[index];
      const practical = practicals[index];
      if (!practical) {
        assembly.root.setEnabled(false);
        continue;
      }
      if (!assembly.root.position.equals(practical.position)) {
        assembly.root.position.copyFrom(practical.position);
      }
      // The fixture emits only while its existing practical light is budget-enabled.
      const lit = this.enabled && index < activeCount && practical.isEnabled();
      for (const emitter of assembly.emitters) emitter.setEnabled(lit);
    }
  }

  get sourceCount() {
    return this.assemblies.reduce((total, assembly) => total + assembly.emitters.length, 0);
  }

  dispose() {
    this.setEnabled(false);
    for (const assembly of this.assemblies) assembly.root.dispose(false, false);
    for (const material of this.materials) material.dispose();
    this.assemblies.length = 0;
    this.materials.length = 0;
  }
}
