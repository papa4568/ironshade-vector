import type { EnemyProtocolId, EnhancedProtocolVariantId, ProtocolFamily } from './eliteProtocols';

export type ProtocolVisualSignature = 'split' | 'crown' | 'rails' | 'ring' | 'fork' | 'clamp' | 'grid' | 'fan' | 'beacon';
export type ProtocolVisualMotion = 'brace' | 'vent' | 'float' | 'lock' | 'orbit' | 'link' | 'scan' | 'heat' | 'aim' | 'objective';

export type ProtocolVisualSpec = {
  family: ProtocolFamily;
  signature: ProtocolVisualSignature;
  primary: number;
  accent: number;
  nodeCount: number;
  radius: number;
  height: number;
  motion: ProtocolVisualMotion;
  phase: number;
  scale: number;
};

export type EnhancedProtocolVisualMarker =
  | 'double'
  | 'cross'
  | 'twin'
  | 'halo'
  | 'trail'
  | 'cascade'
  | 'mesh'
  | 'scramble'
  | 'coolant'
  | 'sync'
  | 'fan'
  | 'grid';

export type EnhancedProtocolVisualSpec = {
  marker: EnhancedProtocolVisualMarker;
  spokes: number;
  scale: number;
  phase: number;
};

const familyPalette: Record<ProtocolFamily, { primary: number; accent: number }> = {
  defense: { primary: 0x78918d, accent: 0xa8e0d3 },
  pressure: { primary: 0x6d8792, accent: 0x8fd2e0 },
  mass: { primary: 0x566a86, accent: 0x9cb7ed },
  systems: { primary: 0x567b70, accent: 0x83d7b7 },
  control: { primary: 0x6f6589, accent: 0xc0a4ec },
  fire: { primary: 0x895849, accent: 0xff9a6d },
  objective: { primary: 0x82764e, accent: 0xe4cb75 },
};

const spec = (
  family: ProtocolFamily,
  signature: ProtocolVisualSignature,
  nodeCount: number,
  radius: number,
  height: number,
  motion: ProtocolVisualMotion,
  phase: number,
  scale = 1,
): ProtocolVisualSpec => ({ family, signature, nodeCount, radius, height, motion, phase, scale, ...familyPalette[family] });

const protocolVisuals: Record<EnemyProtocolId, ProtocolVisualSpec> = {
  reactivePlating: spec('defense', 'split', 2, 0.38, 1.02, 'brace', 0.13, 1.08),
  pressureHunter: spec('pressure', 'crown', 3, 0.36, 1.28, 'vent', 0.47, 1),
  vacuumAdapted: spec('pressure', 'ring', 2, 0.43, 0.88, 'float', 0.83, 1.04),
  breachmaker: spec('pressure', 'rails', 2, 0.42, 1.12, 'aim', 1.19, 1.08),
  magneticLock: spec('mass', 'fork', 2, 0.46, 1.17, 'lock', 1.61, 1),
  gravityAnchor: spec('mass', 'ring', 3, 0.5, 0.82, 'orbit', 2.03, 1.12),
  countermassMobility: spec('mass', 'split', 3, 0.48, 0.75, 'orbit', 2.39, 1.08),
  arcConduit: spec('systems', 'fork', 4, 0.42, 1.03, 'link', 2.77, 1),
  repairMesh: spec('systems', 'grid', 4, 0.4, 1.08, 'link', 3.11, 1.02),
  droneEscort: spec('systems', 'crown', 2, 0.5, 1.38, 'orbit', 3.53, 1.12),
  emergencyShutters: spec('control', 'clamp', 2, 0.48, 0.92, 'lock', 3.89, 1.12),
  sensorGhost: spec('control', 'ring', 3, 0.4, 1.31, 'scan', 4.27, 0.98),
  signalJammer: spec('control', 'beacon', 4, 0.5, 1.19, 'scan', 4.61, 1.08),
  thermalOverrun: spec('fire', 'rails', 3, 0.39, 1.1, 'heat', 5.03, 1.03),
  suppressionCoordinator: spec('fire', 'grid', 3, 0.46, 1.25, 'aim', 5.41, 1.05),
  penetratorVolley: spec('fire', 'fan', 4, 0.52, 1.08, 'aim', 5.83, 1.12),
  salvageInterdictor: spec('objective', 'beacon', 2, 0.45, 0.96, 'objective', 6.17, 1.06),
  recoveryDenial: spec('objective', 'clamp', 4, 0.52, 0.91, 'objective', 6.59, 1.12),
};

const enhancedVisuals: Record<EnhancedProtocolVariantId, EnhancedProtocolVisualSpec> = {
  'ablative-bloom': { marker: 'double', spokes: 4, scale: 1.12, phase: 0.2 },
  'cutline-pair': { marker: 'cross', spokes: 2, scale: 1.08, phase: 0.6 },
  'twin-well-lock': { marker: 'twin', spokes: 2, scale: 1.14, phase: 0.9 },
  'anchor-singularity': { marker: 'halo', spokes: 3, scale: 1.18, phase: 1.3 },
  'wake-anchor': { marker: 'trail', spokes: 3, scale: 1.12, phase: 1.7 },
  'cascade-grid': { marker: 'cascade', spokes: 4, scale: 1.1, phase: 2.1 },
  'overlink-mesh': { marker: 'mesh', spokes: 4, scale: 1.12, phase: 2.5 },
  'dual-rack': { marker: 'twin', spokes: 4, scale: 1.16, phase: 2.9 },
  'cross-shutter': { marker: 'cross', spokes: 4, scale: 1.13, phase: 3.3 },
  'capacitor-scramble': { marker: 'scramble', spokes: 3, scale: 1.08, phase: 3.7 },
  'coolant-redline': { marker: 'coolant', spokes: 2, scale: 1.1, phase: 4.1 },
  'tech-bus-sync': { marker: 'sync', spokes: 4, scale: 1.14, phase: 4.5 },
  'cross-fan-volley': { marker: 'fan', spokes: 4, scale: 1.18, phase: 4.9 },
  'mass-theft': { marker: 'trail', spokes: 2, scale: 1.12, phase: 5.3 },
  'hard-lock-grid': { marker: 'grid', spokes: 4, scale: 1.18, phase: 5.7 },
};

export const protocolVisualIds = Object.keys(protocolVisuals) as EnemyProtocolId[];
export const enhancedProtocolVisualIds = Object.keys(enhancedVisuals) as EnhancedProtocolVariantId[];

export function protocolVisualSpecFor(id: EnemyProtocolId) {
  return protocolVisuals[id];
}

export function enhancedProtocolVisualSpecFor(id: EnhancedProtocolVariantId) {
  return enhancedVisuals[id];
}

export function protocolVisualCss(color: number, alpha: number) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
