import { protocolDefinition, type ProtocolFamily } from './eliteProtocols';
import type { Enemy } from './sim';
import type { HighTierMutationId } from './t9Mutations';
import type { EnemyLifecycleSignals } from './enemyLifecyclePresentation';

export type EnemyPresentationSource = 'mutation' | 'protocol' | 'status' | 'telegraph' | 'spawn' | 'readiness' | 'boss' | 'death';
export type EnemyPresentationPriority = 1 | 2 | 3 | 4;

export type EnemyPresentationLayer = {
  key: string;
  cue: string;
  source: EnemyPresentationSource;
  priority: EnemyPresentationPriority;
  intensity: number;
  sustained: boolean;
  enhanced?: boolean;
};

export type EnemyPresentationContract = {
  animation: EnemyPresentationLayer[];
  material: EnemyPresentationLayer[];
  vfx: EnemyPresentationLayer[];
  audio: EnemyPresentationLayer[];
  dominant: string | null;
  signature: string;
};

export type EnemyPresentationInput = Pick<
  Enemy,
  'role' | 'combatClass' | 'mutations' | 'protocols' | 'statuses' | 'telegraph' | 'protocolPulse' | 'bossPhase' | 'dead' | 'anchored'
>;

type PresentationBundle = {
  animation: string;
  material: string;
  vfx: string;
  audio: string;
  priority: EnemyPresentationPriority;
};

const mutationPresentation: Record<HighTierMutationId, PresentationBundle> = {
  'reinforced-core': { animation: 'core-braced', material: 'reinforced-core-plates', vfx: 'core-pressure-glow', audio: 'load-bearing-hum', priority: 2 },
  'ablative-mantle': { animation: 'mantle-settle', material: 'ablative-shell', vfx: 'mantle-shed-sparks', audio: 'ceramic-rattle', priority: 2 },
  'hunter-servo': { animation: 'hunter-ready', material: 'servo-heat', vfx: 'tracking-streak', audio: 'servo-whine', priority: 2 },
  'redline-bus': { animation: 'redline-tension', material: 'bus-hot', vfx: 'redline-pulse', audio: 'power-bus-rise', priority: 2 },
  'countermass-rig': { animation: 'countermass-ready', material: 'mass-field', vfx: 'countermass-orbit', audio: 'mass-thrum', priority: 2 },
  'relay-reflex': { animation: 'relay-ready', material: 'relay-charge', vfx: 'relay-snap', audio: 'relay-click', priority: 2 },
};

const protocolFamilyPresentation: Record<ProtocolFamily, PresentationBundle> = {
  defense: { animation: 'protocol-brace', material: 'defense-hardpoints', vfx: 'defense-lattice', audio: 'defense-lock', priority: 2 },
  pressure: { animation: 'protocol-pressure-set', material: 'pressure-seals', vfx: 'pressure-stream', audio: 'pressure-valve', priority: 2 },
  mass: { animation: 'protocol-mass-set', material: 'mass-coils', vfx: 'mass-field', audio: 'mass-thrum', priority: 3 },
  systems: { animation: 'protocol-systems-route', material: 'systems-bus', vfx: 'systems-arc', audio: 'systems-chatter', priority: 2 },
  control: { animation: 'protocol-control-track', material: 'control-array', vfx: 'control-scan', audio: 'control-ping', priority: 3 },
  fire: { animation: 'protocol-fire-commit', material: 'weapon-redline', vfx: 'weapon-charge', audio: 'weapon-charge', priority: 3 },
  objective: { animation: 'protocol-objective-lock', material: 'objective-clamps', vfx: 'objective-beacon', audio: 'objective-lock', priority: 3 },
};

const statusPresentation: Record<keyof Enemy['statuses'], PresentationBundle> = {
  armorBreach: { animation: 'armor-break-open', material: 'armor-fracture', vfx: 'armor-fracture-sparks', audio: 'armor-fracture', priority: 3 },
  disrupted: { animation: 'disruption-jitter', material: 'disruption-flicker', vfx: 'disruption-arc', audio: 'disruption-crackle', priority: 4 },
  marked: { animation: 'mark-track', material: 'mark-highlight', vfx: 'mark-reticle', audio: 'mark-lock', priority: 2 },
  stagger: { animation: 'stagger-break', material: 'stagger-impact', vfx: 'stagger-shock', audio: 'stagger-hit', priority: 4 },
  conductive: { animation: 'conductive-tension', material: 'conductive-charge', vfx: 'conductive-arc', audio: 'arc-crackle', priority: 3 },
  vacuum: { animation: 'vacuum-drift', material: 'vacuum-frost', vfx: 'vacuum-stream', audio: 'vacuum-leak', priority: 3 },
};

const telegraphPresentation: PresentationBundle = {
  animation: 'attack-telegraph',
  material: 'attack-charge',
  vfx: 'attack-direction',
  audio: 'attack-warning',
  priority: 4,
};

const spawnPresentation: PresentationBundle = {
  animation: 'activation-rise',
  material: 'activation-powerup',
  vfx: 'activation-lock-ring',
  audio: 'activation-lock',
  priority: 3,
};

const dangerousReadinessPresentation: PresentationBundle = {
  animation: 'stacked-threat-brace',
  material: 'stacked-threat-hot',
  vfx: 'stacked-threat-crown',
  audio: 'stacked-threat-warning',
  priority: 4,
};

const bossPhaseTransitionPresentation: PresentationBundle = {
  animation: 'boss-phase-break',
  material: 'boss-phase-surge',
  vfx: 'boss-phase-shock-ring',
  audio: 'boss-phase-stinger',
  priority: 4,
};

const bossPhasePresentation: PresentationBundle = {
  animation: 'boss-phase-rise',
  material: 'boss-phase-hot',
  vfx: 'boss-phase-halo',
  audio: 'boss-phase-stinger',
  priority: 4,
};

const deathPresentation: PresentationBundle = {
  animation: 'death-disable',
  material: 'death-powerdown',
  vfx: 'death-discharge',
  audio: 'death-collapse',
  priority: 4,
};

const persistentDisabledPresentation: Omit<PresentationBundle, 'audio'> = {
  animation: 'disabled-settle',
  material: 'disabled-cold-hardware',
  vfx: 'disabled-residual-marker',
  priority: 2,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function pushBundle(
  contract: Omit<EnemyPresentationContract, 'dominant' | 'signature'>,
  source: EnemyPresentationSource,
  key: string,
  bundle: PresentationBundle,
  intensity: number,
  sustained: boolean,
  enhanced = false,
) {
  const normalized = clamp01(intensity);
  if (normalized <= 0) return;
  for (const channel of ['animation', 'material', 'vfx', 'audio'] as const) {
    contract[channel].push({
      key,
      cue: bundle[channel],
      source,
      priority: bundle.priority,
      intensity: normalized,
      sustained,
      ...(enhanced ? { enhanced: true } : {}),
    });
  }
}

function pushVisualBundle(
  contract: Omit<EnemyPresentationContract, 'dominant' | 'signature'>,
  source: EnemyPresentationSource,
  key: string,
  bundle: Omit<PresentationBundle, 'audio'>,
  intensity: number,
  sustained: boolean,
) {
  const normalized = clamp01(intensity);
  if (normalized <= 0) return;
  for (const channel of ['animation', 'material', 'vfx'] as const) {
    contract[channel].push({
      key,
      cue: bundle[channel],
      source,
      priority: bundle.priority,
      intensity: normalized,
      sustained,
    });
  }
}

function sortLayers(layers: EnemyPresentationLayer[]) {
  layers.sort((a, b) =>
    b.priority - a.priority
    || a.source.localeCompare(b.source)
    || a.key.localeCompare(b.key)
    || a.cue.localeCompare(b.cue)
    || b.intensity - a.intensity,
  );
}

function signatureFor(contract: Omit<EnemyPresentationContract, 'dominant' | 'signature'>) {
  const encode = (channel: keyof typeof contract) => contract[channel]
    .map(layer => `${layer.key}:${layer.cue}:${layer.intensity.toFixed(2)}:${layer.enhanced ? 'e' : 'n'}`)
    .join(',');
  return `a[${encode('animation')}]|m[${encode('material')}]|v[${encode('vfx')}]|s[${encode('audio')}]`;
}

export function resolveEnemyPresentation(input: EnemyPresentationInput, lifecycle?: EnemyLifecycleSignals): EnemyPresentationContract {
  const contract: Omit<EnemyPresentationContract, 'dominant' | 'signature'> = {
    animation: [],
    material: [],
    vfx: [],
    audio: [],
  };

  for (const mutation of [...input.mutations].sort()) {
    pushBundle(contract, 'mutation', `mutation:${mutation}`, mutationPresentation[mutation], 1, true);
  }

  const protocols = [...input.protocols].sort((a, b) =>
    a.id.localeCompare(b.id)
    || Number(b.enhanced) - Number(a.enhanced)
    || (a.variantId ?? '').localeCompare(b.variantId ?? ''),
  );
  for (const protocol of protocols) {
    const definition = protocolDefinition(protocol.id);
    const activeIntensity = protocol.windup > 0
      ? 1
      : input.protocolPulse > 0
        ? clamp01(0.45 + input.protocolPulse * 0.35)
        : 0.42;
    const intensity = clamp01(activeIntensity + (protocol.enhanced ? 0.14 : 0));
    const key = `protocol:${protocol.id}${protocol.variantId ? `:${protocol.variantId}` : ''}`;
    pushBundle(contract, 'protocol', key, protocolFamilyPresentation[definition.family], intensity, true, protocol.enhanced);
  }

  for (const status of Object.keys(statusPresentation) as Array<keyof Enemy['statuses']>) {
    const timer = input.statuses[status];
    if (timer <= 0) continue;
    pushBundle(contract, 'status', `status:${status}`, statusPresentation[status], clamp01(0.4 + timer * 0.6), true);
  }

  if (input.telegraph > 0) {
    pushBundle(contract, 'telegraph', 'telegraph:attack', telegraphPresentation, clamp01(0.55 + input.telegraph * 0.45), false);
  }

  if (lifecycle?.spawn) {
    pushBundle(contract, 'spawn', 'spawn:activation', spawnPresentation, lifecycle.spawn, false);
  }

  if (lifecycle?.dangerousReadiness) {
    pushBundle(contract, 'readiness', 'readiness:stacked-threat', dangerousReadinessPresentation, lifecycle.dangerousReadiness, true);
  }

  if (input.role === 'boss' && lifecycle?.phaseTransition) {
    pushBundle(contract, 'boss', 'boss:phase-transition', bossPhaseTransitionPresentation, lifecycle.phaseTransition, false);
  }

  if (input.role === 'boss' && input.bossPhase === 2) {
    pushBundle(contract, 'boss', 'boss:phase-2', bossPhasePresentation, 1, true);
  }

  if (input.dead) {
    const disableIntensity = lifecycle ? lifecycle.disable : 1;
    if (disableIntensity > 0) pushBundle(contract, 'death', 'death:disabled', deathPresentation, disableIntensity, false);
    if (lifecycle?.persistentDisabled) {
      pushVisualBundle(contract, 'death', 'death:persistent', persistentDisabledPresentation, lifecycle.persistentDisabled, true);
    }
    contract.audio = contract.audio.filter(layer => layer.key === 'death:disabled');
  }

  sortLayers(contract.animation);
  sortLayers(contract.material);
  sortLayers(contract.vfx);
  sortLayers(contract.audio);

  const dominant = [...contract.animation, ...contract.material, ...contract.vfx, ...contract.audio]
    .sort((a, b) => b.priority - a.priority || b.intensity - a.intensity || a.key.localeCompare(b.key))[0]?.key ?? null;

  return {
    ...contract,
    dominant,
    signature: signatureFor(contract),
  };
}

export function mutationPresentationCue(id: HighTierMutationId) {
  return mutationPresentation[id];
}
