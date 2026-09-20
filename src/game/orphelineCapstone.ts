import type { Contract } from './campaign';

export type OrphelineStageNumber = 1 | 2 | 3 | 4;

export type OrphelineStageIdentity = {
  stage: OrphelineStageNumber;
  code: string;
  name: string;
  purpose: string;
  continuity: string;
  kit: readonly string[];
  eventA: string;
  eventB: string;
};

export type OrphelineRenderProfileName = 'full' | 'balanced' | 'mobile' | 'performance';

export type OrphelineRenderProfile = {
  name: OrphelineRenderProfileName;
  rockRibs: number;
  utilityLights: number;
  stageProps: number;
  castStructuralShadows: boolean;
};

export const ORPHELINE_STAGES: readonly OrphelineStageIdentity[] = [
  {
    stage: 1,
    code: 'OR-01',
    name: 'Ice Access Bore',
    purpose: 'Cut through the concealed approach and recover the first unregistered transit record.',
    continuity: 'Rock-cut habitat ribs, violet utility trunks, and white occupancy marks begin at the hidden threshold.',
    kit: ['thermal-cut-bore', 'concealment-shutters', 'transit-ledger-niches'],
    eventA: 'ORPHELINE ACCESS BORE // CONCEALED PRESSURE PATH IS VENTING THROUGH THE CUT',
    eventB: 'ORPHELINE TRANSIT MARK // INNER HABITAT ROUTE CONFIRMED',
  },
  {
    stage: 2,
    code: 'OR-02',
    name: 'Industrial Commons',
    purpose: 'Restore enough fabrication power to identify how the habitat supported itself off-registry.',
    continuity: 'The same violet utility trunk crosses improvised fabrication stalls and patched commons partitions.',
    kit: ['fabrication-stalls', 'salvage-gantries', 'commons-partitions'],
    eventA: 'ORPHELINE COMMONS // PATCHED POWER BUS IS BACKFEEDING THROUGH THE MARKET FLOOR',
    eventB: 'ORPHELINE FABRICATION KEY // COMMONS SERVICE ROUTE RECOVERED',
  },
  {
    stage: 3,
    code: 'OR-03',
    name: 'Residential Spin Ring',
    purpose: 'Stabilize the occupied-scale ring and recover evidence of who actually lived here.',
    continuity: 'White occupancy marks and violet service trunks repeat across stacked hab pods and pressure curtains.',
    kit: ['hab-pod-stacks', 'pressure-curtains', 'shelter-spokes'],
    eventA: 'ORPHELINE RESIDENTIAL RING // SPIN REFERENCE LOST ACROSS THE SHELTER SPOKES',
    eventB: 'ORPHELINE POPULATION TRACE // RESIDENTIAL REGISTRY ROUTE LOCKED',
  },
  {
    stage: 4,
    code: 'OR-04',
    name: 'Buried Control Vault',
    purpose: 'Breach the founding archive and defeat the Habitat Warden guarding Orpheline\'s charter.',
    continuity: 'The rock-cut spine terminates in archive walls, founder seals, and the same violet utility datum.',
    kit: ['charter-archive-walls', 'warden-pylons', 'founder-seal'],
    eventA: 'ORPHELINE CONTROL VAULT // WARDEN BUS HAS SEALED THE FOUNDING ARCHIVE',
    eventB: 'ORPHELINE FOUNDING CHARTER // VAULT AUTHORITY PATH EXPOSED',
  },
] as const;

export function orphelineStageIdentity(contract: Contract) {
  if (contract.megastructure !== 'hidden-habitat') return null;
  const stage = contract.megastructureStage ?? 1;
  return ORPHELINE_STAGES.find(item => item.stage === stage) ?? ORPHELINE_STAGES[0];
}

export function orphelineRenderProfile(detailScale: number, coarse: boolean): OrphelineRenderProfile {
  const safeDetail = Number.isFinite(detailScale) ? Math.max(0.35, Math.min(1, detailScale)) : 0.5;
  if (safeDetail < 0.58) return { name: 'performance', rockRibs: 3, utilityLights: 4, stageProps: 3, castStructuralShadows: false };
  if (coarse) return { name: 'mobile', rockRibs: 4, utilityLights: 6, stageProps: 5, castStructuralShadows: false };
  if (safeDetail < 0.88) return { name: 'balanced', rockRibs: 5, utilityLights: 8, stageProps: 6, castStructuralShadows: false };
  return { name: 'full', rockRibs: 7, utilityLights: 10, stageProps: 8, castStructuralShadows: true };
}
