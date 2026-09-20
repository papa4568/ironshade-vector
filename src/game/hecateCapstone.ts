import type { Contract } from './campaign';

export type HecateStageNumber = 1 | 2 | 3 | 4;

export type HecateStageIdentity = {
  stage: HecateStageNumber;
  code: string;
  name: string;
  purpose: string;
  continuity: string;
  kit: readonly string[];
  eventA: string;
  eventB: string;
};

export type HecateRenderProfileName = 'full' | 'balanced' | 'mobile' | 'performance';

export type HecateRenderProfile = {
  name: HecateRenderProfileName;
  trussPairs: number;
  cutterDatums: number;
  stageProps: number;
  castStructuralShadows: boolean;
};

export const HECATE_STAGES: readonly HecateStageIdentity[] = [
  {
    stage: 1,
    code: 'HY-01',
    name: 'Sunward Clamp Field',
    purpose: 'Stabilize the autonomous hull clamps and recover the clamp-control spindle.',
    continuity: 'A black salvage truss spine, red clamp arms, and yellow cutter datum begin at the sunward work face.',
    kit: ['sunward-clamps', 'hull-cradles', 'thermal-cutter-datum'],
    eventA: 'HECATE CLAMP FIELD // AUTONOMOUS HULL CRADLE SWEEP CROSSING THE DECK',
    eventB: 'HECATE CLAMP DATUM // SUNWARD SALVAGE ROUTE LOCKED',
  },
  {
    stage: 2,
    code: 'HY-02',
    name: 'Crusher Causeway',
    purpose: 'Cross the live scrap press line and recover a high-grade cutter head.',
    continuity: 'The same truss spine passes crusher jaws, scrap conveyors, and red safety clamps.',
    kit: ['crusher-jaws', 'scrap-conveyors', 'cutter-gantries'],
    eventA: 'HECATE CRUSHER CAUSEWAY // SCRAP PRESS CYCLE OUT OF PHASE',
    eventB: 'HECATE CUTTER LINE // CRUSHER ROUTE ISOLATED',
  },
  {
    stage: 3,
    code: 'HY-03',
    name: 'Wreck Transit',
    purpose: 'Restore a survivable pressure route through stripped hulls and recover the vessel registry.',
    continuity: 'Yellow cutter datum and red clamp marks continue across open pressure bridges between stripped hulls.',
    kit: ['stripped-hulls', 'pressure-bridges', 'registry-frames'],
    eventA: 'HECATE WRECK TRANSIT // OPEN HULL PRESSURE PATH IS VENTING',
    eventB: 'HECATE WRECK REGISTRY // TRANSIT HULL CHAIN CONFIRMED',
  },
  {
    stage: 4,
    code: 'HY-04',
    name: 'Yard Control Crown',
    purpose: 'Breach yard control and defeat Hecate Yardmaster Null before the cutter grid reclaims the route.',
    continuity: 'The salvage truss terminates beneath the control crown, master clamps, and final cutter datum.',
    kit: ['control-crown', 'master-clamps', 'salvage-ledger'],
    eventA: 'HECATE CONTROL CROWN // YARDMASTER HAS RECLAIMED THE CUTTER GRID',
    eventB: 'HECATE MASTER LEDGER // YARD AUTHORITY PATH EXPOSED',
  },
] as const;

export function hecateStageIdentity(contract: Contract) {
  if (contract.megastructure !== 'shipbreaking-yard') return null;
  const stage = contract.megastructureStage ?? 1;
  return HECATE_STAGES.find(item => item.stage === stage) ?? HECATE_STAGES[0];
}

export function hecateRenderProfile(detailScale: number, coarse: boolean): HecateRenderProfile {
  const safeDetail = Number.isFinite(detailScale) ? Math.max(0.35, Math.min(1, detailScale)) : 0.5;
  if (safeDetail < 0.58) return { name: 'performance', trussPairs: 3, cutterDatums: 4, stageProps: 3, castStructuralShadows: false };
  if (coarse) return { name: 'mobile', trussPairs: 4, cutterDatums: 6, stageProps: 5, castStructuralShadows: false };
  if (safeDetail < 0.88) return { name: 'balanced', trussPairs: 5, cutterDatums: 8, stageProps: 6, castStructuralShadows: false };
  return { name: 'full', trussPairs: 7, cutterDatums: 10, stageProps: 8, castStructuralShadows: true };
}
