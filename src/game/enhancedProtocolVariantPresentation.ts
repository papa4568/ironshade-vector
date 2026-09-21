import type { EnhancedProtocolVariantId } from './eliteProtocols';

type EnhancedProtocolVariantPresentation = {
  name: string;
  shortName: string;
};

const presentation: Record<EnhancedProtocolVariantId, EnhancedProtocolVariantPresentation> = {
  'ablative-bloom': { name: 'Ablative Bloom', shortName: 'ABLATIVE' },
  'cutline-pair': { name: 'Cutline Pair', shortName: 'CUTLINE' },
  'twin-well-lock': { name: 'Twin-Well Lock', shortName: 'TWIN-WELL' },
  'anchor-singularity': { name: 'Anchor Singularity', shortName: 'SINGULARITY' },
  'wake-anchor': { name: 'Wake Anchor', shortName: 'WAKE-ANCHOR' },
  'cascade-grid': { name: 'Cascade Grid', shortName: 'CASCADE' },
  'overlink-mesh': { name: 'Overlink Mesh', shortName: 'OVERLINK' },
  'dual-rack': { name: 'Dual Rack', shortName: 'DUAL-RACK' },
  'cross-shutter': { name: 'Cross-Shutter', shortName: 'CROSS-SHUT' },
  'capacitor-scramble': { name: 'Capacitor Scramble', shortName: 'CAP-SCRAM' },
  'coolant-redline': { name: 'Coolant Redline', shortName: 'COOLANT' },
  'tech-bus-sync': { name: 'Tech Bus Sync', shortName: 'BUS-SYNC' },
  'cross-fan-volley': { name: 'Cross-Fan Volley', shortName: 'CROSS-FAN' },
  'mass-theft': { name: 'Mass Theft', shortName: 'MASS-THEFT' },
  'hard-lock-grid': { name: 'Hard Lock Grid', shortName: 'HARD-LOCK' },
};

export function enhancedProtocolVariantPresentationFor(id: EnhancedProtocolVariantId) {
  return presentation[id];
}
