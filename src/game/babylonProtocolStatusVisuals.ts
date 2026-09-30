import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { resolveEnemyPresentation, type EnemyPresentationContract } from './enemyPresentation';
import {
  enhancedProtocolVisualSpecFor,
  protocolVisualSpecFor,
  type EnhancedProtocolVisualMarker,
  type ProtocolVisualSignature,
} from './protocolVisualLanguage';
import {
  enemyStatusVisualIds,
  enemyStatusVisualSpecFor,
  playerStatusVisualSpecFor,
  resolvePlayerStatusVisuals,
  type EnemyStatusVisualId,
  type PlayerStatusVisualId,
} from './statusVisualLanguage';
import { getPlayerSector, type Enemy, type SimState } from './sim';
import type { HighTierMutationId } from './t9Mutations';

const WORLD_SCALE = 0.02;
const MAX_PROTOCOL_SLOTS = 3;
const MUTATION_IDS: readonly HighTierMutationId[] = [
  'reinforced-core',
  'ablative-mantle',
  'hunter-servo',
  'redline-bus',
  'countermass-rig',
  'relay-reflex',
];
const MUTATION_CUES: Record<HighTierMutationId, string> = {
  'reinforced-core': 'core-braced',
  'ablative-mantle': 'mantle-settle',
  'hunter-servo': 'hunter-ready',
  'redline-bus': 'redline-tension',
  'countermass-rig': 'countermass-ready',
  'relay-reflex': 'relay-ready',
};
const MUTATION_COLORS: Record<HighTierMutationId, readonly [number, number]> = {
  'reinforced-core': [0x52666b, 0x78d8ca],
  'ablative-mantle': [0xb6aa8c, 0xffbd71],
  'hunter-servo': [0x425d61, 0x7ee5e4],
  'redline-bus': [0x71392f, 0xff7855],
  'countermass-rig': [0x455165, 0x91a9df],
  'relay-reflex': [0x3f5260, 0x9ef2ef],
};
const PROTOCOL_DIMENSIONS: Record<ProtocolVisualSignature, readonly [number, number, number]> = {
  split: [0.72, 0.16, 0.18],
  crown: [0.6, 0.18, 0.16],
  rails: [0.82, 0.1, 0.14],
  ring: [0.34, 0.28, 0.16],
  fork: [0.58, 0.12, 0.16],
  clamp: [0.7, 0.2, 0.14],
  grid: [0.62, 0.25, 0.12],
  fan: [0.84, 0.1, 0.13],
  beacon: [0.34, 0.34, 0.14],
};

type ProtocolSlotVisual = {
  root: TransformNode;
  housing: Mesh;
  field: Mesh;
  nodes: Mesh[];
  enhancedRing: Mesh;
  enhancedSpokes: Mesh[];
  hardwareMaterial: StandardMaterial;
  fieldMaterial: StandardMaterial;
};

type MutationVisual = {
  root: TransformNode;
  hardware: Mesh[];
  fields: Mesh[];
  secondary: Mesh[];
  hardwareMaterial: StandardMaterial;
  fieldMaterial: StandardMaterial;
};

type EnemyStatusVisual = {
  root: TransformNode;
  field: Mesh;
  marker: Mesh;
  nodes: Mesh[];
  hardwareMaterial: StandardMaterial;
  fieldMaterial: StandardMaterial;
};

type EnemySignalVisual = {
  root: TransformNode;
  protocolSlots: ProtocolSlotVisual[];
  mutationRoot: TransformNode;
  mutations: Map<HighTierMutationId, MutationVisual>;
  statusRoot: TransformNode;
  statuses: Map<EnemyStatusVisualId, EnemyStatusVisual>;
  materials: Set<StandardMaterial>;
};

type PlayerStatusVisual = {
  root: TransformNode;
  field: Mesh;
  markers: Mesh[];
  material: StandardMaterial;
};

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function roleScale(enemy: Pick<Enemy, 'role'>) {
  if (enemy.role === 'boss') return 1.28;
  if (enemy.role === 'elite') return 1.08;
  return 1;
}

function markerAngle(
  marker: EnhancedProtocolVisualMarker,
  index: number,
  count: number,
  phase: number,
  motion: number,
) {
  if (marker === 'fan') return phase + (index - (count - 1) / 2) * 0.52 + motion * 0.25;
  if (marker === 'scramble') return phase + index * 1.37 + (index % 2 === 0 ? motion : -motion);
  if (marker === 'cross') return phase + index * Math.PI / 2;
  if (marker === 'grid' || marker === 'mesh') return phase + index * Math.PI / 2 + motion * 0.12;
  return phase + index * Math.PI * 2 / Math.max(1, count) + motion;
}

export function babylonProtocolStatusEffectsMode(detailScale: number, coarse: boolean) {
  const effectiveDetail = coarse ? Math.min(detailScale, 0.55) : detailScale;
  return effectiveDetail < 0.58 ? 'reduced' as const : 'full' as const;
}

export class BabylonProtocolStatusVisuals {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly coarse: boolean;
  private readonly enemies = new Map<number, EnemySignalVisual>();
  private readonly playerRoot: TransformNode;
  private readonly playerStatuses = new Map<PlayerStatusVisualId, PlayerStatusVisual>();
  private readonly playerMaterials = new Set<StandardMaterial>();
  private disposed = false;

  constructor(scene: Scene, canvas: HTMLCanvasElement, coarse: boolean) {
    this.scene = scene;
    this.canvas = canvas;
    this.coarse = coarse;
    this.playerRoot = new TransformNode('p27-b9-player-status-root', scene);
    this.playerRoot.setEnabled(false);
    this.canvas.dataset.babylonProtocolStatusVisuals = 'ready';
    this.canvas.dataset.babylonProtocolStatusReadability = 'shape-coded+non-hue+performance-safe';
    this.canvas.dataset.babylonEnemyProtocols = '';
    this.canvas.dataset.babylonEnemyMutations = '';
    this.canvas.dataset.babylonEnemyStatuses = '';
    this.canvas.dataset.babylonPlayerStatuses = '';
    this.canvas.dataset.babylonPlayerStatusDominant = 'none';
  }

  sync(state: SimState, detailScale: number) {
    if (this.disposed) return;
    const effectsMode = babylonProtocolStatusEffectsMode(detailScale, this.coarse);
    const reduced = effectsMode === 'reduced';
    const seen = new Set<number>();
    const protocolTelemetry = new Set<string>();
    const mutationTelemetry = new Set<string>();
    const enemyStatusTelemetry = new Set<string>();

    for (const enemy of state.enemies) {
      seen.add(enemy.id);
      const activeStatusIds = enemyStatusVisualIds.filter(id => enemy.statuses[id] > 0);
      const needsSignals = enemy.active
        && !enemy.dead
        && (enemy.protocols.length > 0 || enemy.mutations.length > 0 || activeStatusIds.length > 0);
      let visual = this.enemies.get(enemy.id);
      if (!needsSignals) {
        visual?.root.setEnabled(false);
        continue;
      }
      visual ??= this.createEnemyVisual(enemy.id);
      visual.root.setEnabled(true);
      visual.root.position.set(scaled(enemy.x), 0, scaled(enemy.y));
      const presentation = resolveEnemyPresentation(enemy);

      this.syncProtocols(visual, enemy, state, presentation, reduced, protocolTelemetry);
      this.syncMutations(visual, enemy, state, presentation, reduced, mutationTelemetry);
      this.syncEnemyStatuses(visual, enemy, state, presentation, reduced, enemyStatusTelemetry);
    }

    for (const [id, visual] of this.enemies) {
      if (seen.has(id)) continue;
      this.disposeEnemyVisual(visual);
      this.enemies.delete(id);
    }

    const activePlayerStatuses = this.syncPlayerStatuses(state, reduced);
    this.canvas.dataset.babylonProtocolStatusEffectsMode = effectsMode;
    this.canvas.dataset.babylonEnemyProtocols = [...protocolTelemetry].sort().join(',');
    this.canvas.dataset.babylonEnemyMutations = [...mutationTelemetry].sort().join(',');
    this.canvas.dataset.babylonEnemyStatuses = [...enemyStatusTelemetry].sort().join(',');
    this.canvas.dataset.babylonPlayerStatuses = activePlayerStatuses.map(entry => entry.id).join(',');
    this.canvas.dataset.babylonPlayerStatusDominant = activePlayerStatuses[0]?.id ?? 'none';
    this.canvas.dataset.babylonProtocolStatusPriority = 'telegraph>status>protocol+mutation';
    this.canvas.dataset.babylonProtocolStatusVisuals = 'protocol+mutation+enemy-status+player-status';
    this.canvas.dataset.babylonProtocolStatusSimulationOwnership = 'read-only-presentation';
  }

  release(reason: string) {
    if (this.disposed) return;
    for (const visual of this.enemies.values()) visual.root.setEnabled(false);
    this.playerRoot.setEnabled(false);
    this.canvas.dataset.babylonEnemyProtocols = '';
    this.canvas.dataset.babylonEnemyMutations = '';
    this.canvas.dataset.babylonEnemyStatuses = '';
    this.canvas.dataset.babylonPlayerStatuses = '';
    this.canvas.dataset.babylonPlayerStatusDominant = 'none';
    this.canvas.dataset.babylonProtocolStatusRelease = reason;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const visual of this.enemies.values()) this.disposeEnemyVisual(visual);
    this.enemies.clear();
    for (const material of this.playerMaterials) material.dispose();
    this.playerMaterials.clear();
    this.playerRoot.dispose();
    this.canvas.dataset.babylonProtocolStatusVisuals = 'disposed';
  }

  private createMaterial(
    name: string,
    primary: number,
    accent: number,
    alpha: number,
    materials: Set<StandardMaterial>,
  ) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = colorFromHex(primary).scale(0.24);
    material.emissiveColor = colorFromHex(accent).scale(0.78);
    material.specularColor = Color3.Black();
    material.alpha = alpha;
    material.disableLighting = true;
    materials.add(material);
    return material;
  }

  private updateMaterial(
    material: StandardMaterial,
    primary: number,
    accent: number,
    alpha: number,
    emissiveScale: number,
  ) {
    material.diffuseColor = colorFromHex(primary).scale(0.24);
    material.emissiveColor = colorFromHex(accent).scale(emissiveScale);
    material.alpha = clamp01(alpha);
  }

  private createEnemyVisual(enemyId: number): EnemySignalVisual {
    const root = new TransformNode('p27-b9-enemy-signal-root-' + enemyId, this.scene);
    const mutationRoot = new TransformNode('p27-b9-mutation-root-' + enemyId, this.scene);
    mutationRoot.parent = root;
    mutationRoot.setEnabled(false);
    const statusRoot = new TransformNode('p27-b9-enemy-status-root-' + enemyId, this.scene);
    statusRoot.parent = root;
    statusRoot.setEnabled(false);
    const visual: EnemySignalVisual = {
      root,
      protocolSlots: [],
      mutationRoot,
      mutations: new Map(),
      statusRoot,
      statuses: new Map(),
      materials: new Set(),
    };
    for (let index = 0; index < MAX_PROTOCOL_SLOTS; index += 1) {
      visual.protocolSlots.push(this.createProtocolSlot(enemyId, index, root, visual.materials));
    }
    this.enemies.set(enemyId, visual);
    return visual;
  }

  private createProtocolSlot(
    enemyId: number,
    index: number,
    parent: TransformNode,
    materials: Set<StandardMaterial>,
  ): ProtocolSlotVisual {
    const root = new TransformNode('p27-b9-protocol-slot-' + enemyId + '-' + index, this.scene);
    root.parent = parent;
    const hardwareMaterial = this.createMaterial(
      'p27-b9-protocol-hardware-material-' + enemyId + '-' + index,
      0x60746f,
      0x9cd7c7,
      0.92,
      materials,
    );
    const fieldMaterial = this.createMaterial(
      'p27-b9-protocol-field-material-' + enemyId + '-' + index,
      0x294039,
      0x9cd7c7,
      0.46,
      materials,
    );
    const housing = MeshBuilder.CreateBox('p27-b9-protocol-housing-' + enemyId + '-' + index, { size: 1 }, this.scene);
    housing.parent = root;
    housing.material = hardwareMaterial;
    housing.isPickable = false;
    const field = MeshBuilder.CreateTorus('p27-b9-protocol-field-' + enemyId + '-' + index, {
      diameter: 1,
      thickness: 0.045,
      tessellation: 28,
    }, this.scene);
    field.parent = root;
    field.material = fieldMaterial;
    field.isPickable = false;
    const nodes: Mesh[] = [];
    for (let nodeIndex = 0; nodeIndex < 4; nodeIndex += 1) {
      const node = MeshBuilder.CreateSphere('p27-b9-protocol-node-' + enemyId + '-' + index + '-' + nodeIndex, {
        diameter: 0.11,
        segments: 6,
      }, this.scene);
      node.parent = root;
      node.material = hardwareMaterial;
      node.isPickable = false;
      nodes.push(node);
    }
    const enhancedRing = MeshBuilder.CreateTorus('p27-b9-protocol-enhanced-ring-' + enemyId + '-' + index, {
      diameter: 1,
      thickness: 0.055,
      tessellation: 30,
    }, this.scene);
    enhancedRing.parent = root;
    enhancedRing.material = fieldMaterial;
    enhancedRing.isPickable = false;
    const enhancedSpokes: Mesh[] = [];
    for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
      const spoke = MeshBuilder.CreateBox('p27-b9-protocol-enhanced-spoke-' + enemyId + '-' + index + '-' + spokeIndex, {
        width: 0.4,
        height: 0.035,
        depth: 0.05,
      }, this.scene);
      spoke.parent = root;
      spoke.material = fieldMaterial;
      spoke.isPickable = false;
      enhancedSpokes.push(spoke);
    }
    root.setEnabled(false);
    return {
      root,
      housing,
      field,
      nodes,
      enhancedRing,
      enhancedSpokes,
      hardwareMaterial,
      fieldMaterial,
    };
  }

  private syncProtocols(
    visual: EnemySignalVisual,
    enemy: Enemy,
    state: SimState,
    presentation: EnemyPresentationContract,
    reduced: boolean,
    telemetry: Set<string>,
  ) {
    const active = enemy.protocols.slice(0, MAX_PROTOCOL_SLOTS);
    for (let index = 0; index < visual.protocolSlots.length; index += 1) {
      const slot = visual.protocolSlots[index]!;
      const protocol = active[index];
      if (!protocol) {
        slot.root.setEnabled(false);
        continue;
      }
      const spec = protocolVisualSpecFor(protocol.id);
      const dimensions = PROTOCOL_DIMENSIONS[spec.signature];
      const scale = spec.scale * roleScale(enemy);
      const materialLead = presentation.material[0];
      const vfxLead = presentation.vfx[0];
      const materialReadability = materialLead && materialLead.source !== 'protocol' && materialLead.priority > 2 ? 0.34 : 1;
      const vfxReadability = vfxLead && vfxLead.source !== 'protocol' && vfxLead.priority > 2 ? 0.28 : 1;
      const windup = protocol.windup > 0
        ? clamp01(0.65 + protocol.windup * 0.45)
        : clamp01(0.45 + enemy.protocolPulse * 0.4);
      const pulse = reduced
        ? 0.78
        : 0.72 + Math.sin(state.time * (3.2 + spec.phase * 0.08) + enemy.id * 0.31 + spec.phase) * 0.16;
      const motion = reduced ? 0 : state.time;
      const slotOffset = (index - (active.length - 1) / 2) * 0.5;

      slot.root.setEnabled(true);
      slot.root.position.set(slotOffset, 0, index * -0.035);
      slot.root.rotation.y = spec.motion === 'orbit'
        ? motion * 0.5 + spec.phase
        : spec.motion === 'scan'
          ? Math.sin(motion * 2.2 + spec.phase) * 0.16
          : spec.motion === 'aim'
            ? Math.sin(motion * 1.8 + spec.phase) * 0.08
            : 0;
      slot.root.rotation.z = spec.motion === 'vent'
        ? Math.sin(motion * 5.2 + spec.phase) * 0.045
        : spec.motion === 'heat'
          ? Math.sin(motion * 7.4 + spec.phase) * 0.032
          : 0;

      slot.housing.position.set(0, spec.height * scale, 0.04);
      slot.housing.rotation.set(0, 0, spec.signature === 'fork' ? -0.18 : spec.signature === 'fan' ? 0.24 : spec.signature === 'crown' ? -0.1 : 0);
      slot.housing.scaling.set(
        dimensions[0] * scale * (0.96 + windup * (reduced ? 0.03 : 0.07)),
        dimensions[1] * scale,
        dimensions[2] * scale,
      );
      this.updateMaterial(
        slot.hardwareMaterial,
        spec.primary,
        spec.accent,
        0.96 * materialReadability,
        (0.28 + pulse * 0.38 + windup * 0.2) * materialReadability,
      );
      this.updateMaterial(
        slot.fieldMaterial,
        spec.primary,
        spec.accent,
        (0.24 + pulse * 0.3 + windup * 0.12) * vfxReadability,
        (0.72 + windup * 0.18) * vfxReadability,
      );

      slot.field.position.set(0, spec.height * scale, 0.08);
      slot.field.rotation.x = spec.signature === 'rails' || spec.signature === 'clamp' ? Math.PI / 2 : 0;
      slot.field.rotation.z = reduced
        ? spec.phase
        : state.time * (spec.motion === 'scan' ? -1.25 : spec.motion === 'orbit' ? 0.85 : 0.28) + spec.phase;
      slot.field.scaling.setAll(spec.radius * 2 * scale * (0.94 + windup * (reduced ? 0.05 : 0.13)));
      slot.field.setEnabled(true);

      const nodeCount = reduced ? Math.min(2, spec.nodeCount) : spec.nodeCount;
      for (let nodeIndex = 0; nodeIndex < slot.nodes.length; nodeIndex += 1) {
        const node = slot.nodes[nodeIndex]!;
        const enabled = nodeIndex < nodeCount;
        node.setEnabled(enabled);
        if (!enabled) continue;
        const angle = -Math.PI * 0.76 + (nodeIndex / Math.max(1, spec.nodeCount - 1)) * Math.PI * 1.52;
        node.position.set(
          Math.cos(angle) * spec.radius * scale,
          (spec.height + Math.sin(angle) * spec.radius * 0.34) * scale,
          0.13,
        );
        const nodePulse = reduced ? 1 : 1 + Math.sin(state.time * 4.6 + spec.phase + nodeIndex * 0.9) * 0.08;
        node.scaling.setAll(nodePulse * scale);
      }

      const enhanced = protocol.enhanced && !!protocol.variantId;
      slot.enhancedRing.setEnabled(enhanced);
      for (const spoke of slot.enhancedSpokes) spoke.setEnabled(false);
      if (enhanced && protocol.variantId) {
        const variant = enhancedProtocolVisualSpecFor(protocol.variantId);
        const enhancedScale = spec.radius * 2.34 * scale * variant.scale;
        slot.enhancedRing.position.set(0, spec.height * scale + (variant.marker === 'halo' ? 0.16 : 0.05), 0.11);
        slot.enhancedRing.rotation.x = variant.marker === 'grid' || variant.marker === 'mesh' ? Math.PI / 2 : 0;
        slot.enhancedRing.rotation.z = reduced ? variant.phase : state.time * 0.62 + variant.phase;
        slot.enhancedRing.scaling.setAll(enhancedScale * (0.96 + windup * (reduced ? 0.04 : 0.08)));

        const spokeCount = reduced ? Math.min(2, variant.spokes) : variant.spokes;
        for (let spokeIndex = 0; spokeIndex < slot.enhancedSpokes.length; spokeIndex += 1) {
          const spoke = slot.enhancedSpokes[spokeIndex]!;
          const enabled = spokeIndex < spokeCount;
          spoke.setEnabled(enabled);
          if (!enabled) continue;
          const angle = markerAngle(variant.marker, spokeIndex, spokeCount, variant.phase, reduced ? 0 : state.time * 0.38);
          const radius = spec.radius * scale * variant.scale * (variant.marker === 'twin' ? 1.25 : 1.1);
          const gridX = variant.marker === 'grid' || variant.marker === 'mesh'
            ? (spokeIndex % 2 === 0 ? -1 : 1) * radius * 0.52
            : Math.cos(angle) * radius;
          const gridZ = variant.marker === 'grid' || variant.marker === 'mesh'
            ? (spokeIndex < 2 ? -1 : 1) * radius * 0.46
            : Math.sin(angle) * radius;
          spoke.position.set(
            gridX,
            spec.height * scale + (variant.marker === 'cascade' ? spokeIndex * 0.055 : variant.marker === 'coolant' ? (spokeIndex % 2) * 0.08 : 0),
            gridZ + (variant.marker === 'trail' ? spokeIndex * 0.065 : 0),
          );
          spoke.rotation.y = -angle;
          spoke.rotation.z = variant.marker === 'scramble' ? (spokeIndex % 2 === 0 ? 0.42 : -0.42) : 0;
          const lengthScale = variant.marker === 'cross' || variant.marker === 'fan' ? 1.25 : variant.marker === 'sync' ? 0.85 : 1;
          spoke.scaling.set(lengthScale * scale, 1, 1);
        }
      }

      telemetry.add(protocol.id + (protocol.variantId ? ':' + protocol.variantId : ''));
    }
  }

  private mutationActive(presentation: EnemyPresentationContract, id: HighTierMutationId) {
    return presentation.animation.some(layer => layer.source === 'mutation' && layer.cue === MUTATION_CUES[id]);
  }

  private syncMutations(
    visual: EnemySignalVisual,
    enemy: Enemy,
    state: SimState,
    presentation: EnemyPresentationContract,
    reduced: boolean,
    telemetry: Set<string>,
  ) {
    for (const mutation of visual.mutations.values()) mutation.root.setEnabled(false);
    const active = MUTATION_IDS.filter(id => this.mutationActive(presentation, id));
    visual.mutationRoot.setEnabled(active.length > 0);
    if (active.length === 0) return;

    const materialLead = presentation.material[0];
    const vfxLead = presentation.vfx[0];
    const materialReadability = materialLead && materialLead.source !== 'mutation' && materialLead.priority > 2 ? 0.36 : 1;
    const vfxReadability = vfxLead && vfxLead.source !== 'mutation' && vfxLead.priority > 2 ? 0.3 : 1;

    active.forEach((id, index) => {
      const mutation = visual.mutations.get(id) ?? this.createMutationVisual(visual, enemy.id, id);
      const colors = MUTATION_COLORS[id];
      const pulse = reduced ? 0.76 : 0.72 + Math.sin(state.time * (id === 'redline-bus' ? 8.6 : id === 'relay-reflex' ? 10.5 : 3.4) + enemy.id * 0.47 + index) * 0.16;
      mutation.root.setEnabled(true);
      mutation.root.scaling.setAll(roleScale(enemy));
      mutation.root.rotation.y = !reduced && id === 'countermass-rig' ? state.time * 0.45 : 0;
      this.updateMaterial(mutation.hardwareMaterial, colors[0], colors[1], 0.96 * materialReadability, (0.36 + pulse * 0.4) * materialReadability);
      this.updateMaterial(mutation.fieldMaterial, colors[0], colors[1], (0.28 + pulse * 0.34) * vfxReadability, (0.72 + pulse * 0.2) * vfxReadability);
      mutation.hardware.forEach(mesh => mesh.setEnabled(true));
      mutation.fields.forEach((mesh, fieldIndex) => {
        mesh.setEnabled(true);
        const fieldPulse = 0.96 + pulse * (reduced ? 0.04 : 0.1);
        mesh.scaling.setAll(fieldPulse);
        mesh.rotation.z = reduced ? 0 : state.time * (fieldIndex % 2 === 0 ? 0.52 : -0.36);
      });
      mutation.secondary.forEach((mesh, secondaryIndex) => {
        const enabled = !reduced || secondaryIndex === 0;
        mesh.setEnabled(enabled);
        if (!enabled) return;
        if (id === 'ablative-mantle') {
          const phase = state.time * (1.4 + secondaryIndex * 0.17) + enemy.id * 0.41 + secondaryIndex * 1.7;
          mesh.position.set(
            Math.sin(phase * 1.7) * (0.38 + secondaryIndex * 0.05),
            0.62 + ((phase * 0.24) % 0.72),
            Math.cos(phase * 1.2) * 0.28,
          );
        } else if (id === 'hunter-servo' || id === 'relay-reflex') {
          const side = secondaryIndex % 2 === 0 ? -1 : 1;
          mesh.position.x = side * (0.36 + pulse * 0.08);
        }
      });
      telemetry.add(id);
    });
  }

  private createMutationVisual(visual: EnemySignalVisual, enemyId: number, id: HighTierMutationId) {
    const root = new TransformNode('p27-b9-mutation-' + id + '-' + enemyId, this.scene);
    root.parent = visual.mutationRoot;
    const colors = MUTATION_COLORS[id];
    const hardwareMaterial = this.createMaterial(
      'p27-b9-mutation-hardware-material-' + id + '-' + enemyId,
      colors[0],
      colors[1],
      0.96,
      visual.materials,
    );
    const fieldMaterial = this.createMaterial(
      'p27-b9-mutation-field-material-' + id + '-' + enemyId,
      colors[0],
      colors[1],
      0.5,
      visual.materials,
    );
    const hardware: Mesh[] = [];
    const fields: Mesh[] = [];
    const secondary: Mesh[] = [];
    const addBox = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, rz = 0, target = hardware) => {
      const mesh = MeshBuilder.CreateBox('p27-b9-mutation-' + id + '-' + name + '-' + enemyId, { width, height, depth }, this.scene);
      mesh.parent = root;
      mesh.position.set(x, y, z);
      mesh.rotation.z = rz;
      mesh.material = target === hardware ? hardwareMaterial : fieldMaterial;
      mesh.isPickable = false;
      target.push(mesh);
      return mesh;
    };
    const addSphere = (name: string, diameter: number, x: number, y: number, z: number, target = hardware) => {
      const mesh = MeshBuilder.CreateSphere('p27-b9-mutation-' + id + '-' + name + '-' + enemyId, { diameter, segments: 7 }, this.scene);
      mesh.parent = root;
      mesh.position.set(x, y, z);
      mesh.material = target === hardware ? hardwareMaterial : fieldMaterial;
      mesh.isPickable = false;
      target.push(mesh);
      return mesh;
    };
    const addTorus = (name: string, diameter: number, y: number, z: number, vertical = false) => {
      const mesh = MeshBuilder.CreateTorus('p27-b9-mutation-' + id + '-' + name + '-' + enemyId, {
        diameter,
        thickness: 0.05,
        tessellation: 28,
      }, this.scene);
      mesh.parent = root;
      mesh.position.set(0, y, z);
      mesh.rotation.x = vertical ? Math.PI / 2 : 0;
      mesh.material = fieldMaterial;
      mesh.isPickable = false;
      fields.push(mesh);
      return mesh;
    };

    if (id === 'reinforced-core') {
      addBox('brace-left', 0.16, 0.62, 0.18, -0.43, 0.9, 0.01, 0.16);
      addBox('brace-right', 0.16, 0.62, 0.18, 0.43, 0.9, 0.01, -0.16);
      addTorus('core-glow', 0.86, 0.92, 0.04);
    } else if (id === 'ablative-mantle') {
      const placements = [
        [-0.46, 1.16, 0.02, -0.22],
        [0.46, 1.16, 0.02, 0.22],
        [-0.38, 0.72, 0.17, -0.1],
        [0.38, 0.72, 0.17, 0.1],
        [0, 1.32, -0.18, 0],
      ] as const;
      placements.forEach((placement, plateIndex) => {
        addBox('plate-' + plateIndex, 0.34, 0.23, 0.14, placement[0], placement[1], placement[2], placement[3]);
      });
      for (let index = 0; index < 4; index += 1) {
        addSphere('spark-' + index, 0.09, 0, 0.72, 0.24, secondary);
      }
    } else if (id === 'hunter-servo') {
      addBox('housing', 0.54, 0.14, 0.16, 0, 1.18, -0.28);
      addTorus('reticle', 0.62, 1.43, 0.25, true);
      addBox('streak-left', 0.42, 0.025, 0.04, -0.42, 1.06, 0.27, 0, secondary);
      addBox('streak-right', 0.42, 0.025, 0.04, 0.42, 1.06, 0.27, 0, secondary);
    } else if (id === 'redline-bus') {
      addBox('spine', 0.12, 0.82, 0.12, 0, 0.96, -0.31);
      addBox('rail-left', 0.08, 0.68, 0.08, -0.34, 0.96, -0.2, 0.08);
      addBox('rail-right', 0.08, 0.68, 0.08, 0.34, 0.96, -0.2, -0.08);
      addBox('bridge-0', 0.68, 0.055, 0.06, 0, 0.76, -0.22);
      addBox('bridge-1', 0.68, 0.055, 0.06, 0, 1.14, -0.22);
      addTorus('pulse', 0.58, 1.02, 0.31, true);
    } else if (id === 'countermass-rig') {
      addBox('arm-left', 0.54, 0.055, 0.06, -0.38, 0.76, -0.08, -0.08);
      addBox('arm-right', 0.54, 0.055, 0.06, 0.38, 0.76, -0.08, 0.08);
      addSphere('pod-left', 0.26, -0.67, 0.76, -0.08);
      addSphere('pod-right', 0.26, 0.67, 0.76, -0.08);
      addTorus('field', 1.28, 0.76, 0);
    } else {
      addBox('housing', 0.42, 0.13, 0.13, 0, 1.3, -0.24);
      addSphere('node-0', 0.13, -0.3, 1.35, 0.18);
      addSphere('node-1', 0.13, 0, 1.5, 0.18);
      addSphere('node-2', 0.13, 0.3, 1.35, 0.18);
      addTorus('scan', 0.6, 1.45, 0.2, true);
      addBox('snap-left', 0.34, 0.025, 0.03, -0.39, 1.2, 0.21, 0, secondary);
      addBox('snap-right', 0.34, 0.025, 0.03, 0.39, 1.2, 0.21, 0, secondary);
    }

    const mutation = { root, hardware, fields, secondary, hardwareMaterial, fieldMaterial };
    visual.mutations.set(id, mutation);
    return mutation;
  }

  private syncEnemyStatuses(
    visual: EnemySignalVisual,
    enemy: Enemy,
    state: SimState,
    presentation: EnemyPresentationContract,
    reduced: boolean,
    telemetry: Set<string>,
  ) {
    for (const status of visual.statuses.values()) status.root.setEnabled(false);
    const active = enemyStatusVisualIds.filter(id => enemy.statuses[id] > 0);
    visual.statusRoot.setEnabled(active.length > 0);
    if (active.length === 0) return;
    const lead = presentation.vfx[0];

    active.forEach((id, index) => {
      const spec = enemyStatusVisualSpecFor(id);
      const status = visual.statuses.get(id) ?? this.createEnemyStatusVisual(visual, enemy.id, id);
      const intensity = clamp01(0.4 + enemy.statuses[id] * 0.6);
      let readability = lead && lead.source !== 'status' && lead.priority > spec.priority ? 0.3 : 1;
      if (enemy.telegraph > 0) readability *= spec.priority >= 4 ? 0.72 : 0.42;
      const pulse = reduced
        ? 0.78
        : 0.72 + Math.sin(state.time * (id === 'disrupted' ? 11 : id === 'marked' ? 6.2 : 4.2) + enemy.id * 0.47 + index) * 0.16;
      const scale = spec.scale * roleScale(enemy);

      status.root.setEnabled(true);
      status.root.position.x = id === 'disrupted' && !reduced ? Math.sin(state.time * 18 + enemy.id) * 0.045 : 0;
      status.root.rotation.y = id === 'marked' && !reduced ? state.time * 0.22 : 0;
      status.root.rotation.z = id === 'stagger' && !reduced ? Math.sin(state.time * 16 + enemy.id) * 0.06 : 0;
      this.updateMaterial(status.hardwareMaterial, spec.primary, spec.accent, 0.94 * readability, (0.34 + intensity * 0.42) * readability);
      this.updateMaterial(status.fieldMaterial, spec.primary, spec.accent, (0.22 + intensity * 0.38) * readability, 0.8 * readability);
      status.field.scaling.setAll(scale * (0.96 + pulse * (reduced ? 0.04 : 0.08)));
      status.field.rotation.z = reduced ? 0 : state.time * (id === 'conductive' ? 1.25 : id === 'marked' ? -0.7 : 0.35);
      status.marker.scaling.setAll(scale * (0.94 + intensity * 0.12 + pulse * (reduced ? 0.02 : 0.04)));
      const nodeCount = reduced ? Math.min(3, spec.nodeCount) : spec.nodeCount;
      for (let nodeIndex = 0; nodeIndex < status.nodes.length; nodeIndex += 1) {
        const node = status.nodes[nodeIndex]!;
        const enabled = nodeIndex < nodeCount;
        node.setEnabled(enabled);
        if (!enabled) continue;
        const angle = nodeIndex * Math.PI * 2 / Math.max(1, spec.nodeCount);
        node.position.set(
          Math.cos(angle) * 0.48 * scale,
          (0.86 + Math.sin(angle) * 0.24) * scale,
          0.3 + (!reduced && (id === 'conductive' || id === 'vacuum') ? Math.sin(state.time * 6 + nodeIndex) * 0.035 : 0),
        );
      }
      telemetry.add(id);
    });
  }

  private createEnemyStatusVisual(
    visual: EnemySignalVisual,
    enemyId: number,
    id: EnemyStatusVisualId,
  ) {
    const spec = enemyStatusVisualSpecFor(id);
    const root = new TransformNode('p27-b9-enemy-status-' + id + '-' + enemyId, this.scene);
    root.parent = visual.statusRoot;
    const hardwareMaterial = this.createMaterial(
      'p27-b9-enemy-status-hardware-material-' + id + '-' + enemyId,
      spec.primary,
      spec.accent,
      0.94,
      visual.materials,
    );
    const fieldMaterial = this.createMaterial(
      'p27-b9-enemy-status-field-material-' + id + '-' + enemyId,
      spec.primary,
      spec.accent,
      0.48,
      visual.materials,
    );
    const field = MeshBuilder.CreateTorus('p27-b9-enemy-status-field-' + id + '-' + enemyId, {
      diameter: 1.08,
      thickness: 0.05,
      tessellation: 28,
    }, this.scene);
    field.parent = root;
    field.position.set(0, 0.82, 0.2);
    field.material = fieldMaterial;
    field.isPickable = false;

    let marker: Mesh;
    if (spec.signature === 'reticle') {
      marker = MeshBuilder.CreateTorus('p27-b9-enemy-status-marker-' + id + '-' + enemyId, {
        diameter: 0.44,
        thickness: 0.07,
        tessellation: 20,
      }, this.scene);
      marker.rotation.x = Math.PI / 2;
    } else if (spec.signature === 'arc') {
      marker = MeshBuilder.CreateSphere('p27-b9-enemy-status-marker-' + id + '-' + enemyId, {
        diameter: 0.3,
        segments: 5,
      }, this.scene);
    } else if (spec.signature === 'frost') {
      marker = MeshBuilder.CreateCylinder('p27-b9-enemy-status-marker-' + id + '-' + enemyId, {
        diameterTop: 0,
        diameterBottom: 0.3,
        height: 0.4,
        tessellation: 5,
      }, this.scene);
    } else {
      marker = MeshBuilder.CreateBox('p27-b9-enemy-status-marker-' + id + '-' + enemyId, {
        width: 0.36,
        height: spec.signature === 'fracture' ? 0.1 : 0.18,
        depth: 0.13,
      }, this.scene);
      marker.rotation.z = spec.signature === 'fracture' ? 0.44 : spec.signature === 'impact' ? -0.32 : 0;
    }
    marker.parent = root;
    marker.position.set(0, 1.15, 0.28);
    marker.material = hardwareMaterial;
    marker.isPickable = false;
    const nodes: Mesh[] = [];
    for (let index = 0; index < spec.nodeCount; index += 1) {
      const node = MeshBuilder.CreateSphere('p27-b9-enemy-status-node-' + id + '-' + enemyId + '-' + index, {
        diameter: 0.09,
        segments: 5,
      }, this.scene);
      node.parent = root;
      node.material = hardwareMaterial;
      node.isPickable = false;
      nodes.push(node);
    }
    const status = { root, field, marker, nodes, hardwareMaterial, fieldMaterial };
    visual.statuses.set(id, status);
    return status;
  }

  private syncPlayerStatuses(state: SimState, reduced: boolean) {
    const sector = getPlayerSector(state);
    const active = resolvePlayerStatusVisuals({
      heat: state.player.weaponHeat[state.player.currentWeapon] ?? 0,
      disrupted: state.player.disrupted,
      vacuumExposure: state.player.vacuumExposure,
      pressureState: sector.pressureState,
      pressure: sector.pressure,
    });
    for (const status of this.playerStatuses.values()) status.root.setEnabled(false);
    this.playerRoot.position.set(scaled(state.player.x), 0, scaled(state.player.y));
    this.playerRoot.setEnabled(active.length > 0);
    active.forEach((entry, index) => {
      const spec = playerStatusVisualSpecFor(entry.id);
      const status = this.playerStatuses.get(entry.id) ?? this.createPlayerStatusVisual(entry.id);
      const pulse = reduced
        ? 0.8
        : 0.76 + Math.sin(state.time * (entry.id === 'disrupted' ? 12 : entry.id === 'thermal' ? 7.5 : 4.2) + index) * 0.16;
      status.root.setEnabled(true);
      status.root.position.x = entry.id === 'disrupted' && !reduced ? Math.sin(state.time * 20) * 0.035 : 0;
      status.root.rotation.y = (entry.id === 'pressure-loss' || entry.id === 'vacuum') && !reduced ? state.time * 0.28 : 0;
      this.updateMaterial(status.material, spec.primary, spec.accent, 0.26 + entry.intensity * 0.48, 0.82);
      status.field.scaling.setAll((entry.id === 'vacuum' ? 1.42 : 1.2) * (0.96 + pulse * (reduced ? 0.04 : 0.08)));
      status.field.rotation.z = reduced ? 0 : state.time * (entry.id === 'disrupted' ? -1.2 : 0.42);
      const markerCount = reduced ? 2 : entry.id === 'disrupted' ? 4 : 3;
      for (let markerIndex = 0; markerIndex < status.markers.length; markerIndex += 1) {
        const marker = status.markers[markerIndex]!;
        const enabled = markerIndex < markerCount;
        marker.setEnabled(enabled);
        if (!enabled) continue;
        marker.position.set(
          (markerIndex - 1.5) * 0.22,
          1.12 + (markerIndex % 2) * 0.18 + (!reduced && (entry.id === 'thermal' || entry.id === 'vacuum') ? Math.sin(state.time * 4.5 + markerIndex) * 0.025 : 0),
          0.24,
        );
      }
    });
    return active;
  }

  private createPlayerStatusVisual(id: PlayerStatusVisualId) {
    const spec = playerStatusVisualSpecFor(id);
    const root = new TransformNode('p27-b9-player-status-' + id, this.scene);
    root.parent = this.playerRoot;
    const material = this.createMaterial(
      'p27-b9-player-status-material-' + id,
      spec.primary,
      spec.accent,
      0.5,
      this.playerMaterials,
    );
    const field = MeshBuilder.CreateTorus('p27-b9-player-status-field-' + id, {
      diameter: 1,
      thickness: 0.06,
      tessellation: 30,
    }, this.scene);
    field.parent = root;
    field.position.y = id === 'thermal' ? 1.05 : 0.72;
    field.rotation.x = id === 'pressure-loss' || id === 'vacuum' ? Math.PI / 2 : 0;
    field.material = material;
    field.isPickable = false;
    const markers: Mesh[] = [];
    for (let index = 0; index < 4; index += 1) {
      const marker = MeshBuilder.CreateBox('p27-b9-player-status-marker-' + id + '-' + index, {
        width: id === 'thermal' ? 0.08 : 0.16,
        height: id === 'vacuum' ? 0.34 : 0.08,
        depth: 0.04,
      }, this.scene);
      marker.parent = root;
      marker.position.set((index - 1.5) * 0.22, 1.12 + (index % 2) * 0.18, 0.24);
      marker.rotation.z = id === 'disrupted' ? (index % 2 === 0 ? 0.55 : -0.55) : id === 'thermal' ? 0.18 : 0;
      marker.material = material;
      marker.isPickable = false;
      markers.push(marker);
    }
    const status = { root, field, markers, material };
    this.playerStatuses.set(id, status);
    return status;
  }

  private disposeEnemyVisual(visual: EnemySignalVisual) {
    for (const material of visual.materials) material.dispose();
    visual.materials.clear();
    visual.root.dispose();
  }
}
