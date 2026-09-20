import type { Contract } from './campaign';

export type K91StageNumber = 1 | 2 | 3 | 4;

export type K91StageIdentity = {
  stage: K91StageNumber;
  code: string;
  name: string;
  purpose: string;
  continuity: string;
  kit: readonly string[];
  eventA: string;
  eventB: string;
};

export type K91RenderProfileName = 'full' | 'balanced' | 'mobile' | 'performance';

export type K91RenderProfile = {
  name: K91RenderProfileName;
  railPairs: number;
  datumLights: number;
  stageProps: number;
  castStructuralShadows: boolean;
};

export const K91_STAGES: readonly K91StageIdentity[] = [
  {
    stage: 1,
    code: 'CW-01',
    name: 'Capture Collar',
    purpose: 'Arrest enough of K-91\'s tumble to cycle the capture locks and establish an interior route.',
    continuity: 'The load spine, paired countermass rails, and amber inertial datum remain visible.',
    kit: ['capture-jaws', 'tether-drums', 'inertial-datum'],
    eventA: 'K-91 TUMBLE SOLUTION // CAPTURE COLLAR LOAD VECTOR CROSSING THE HULL',
    eventB: 'K-91 CAPTURE DATUM // TETHER LOAD PATH STABLE',
  },
  {
    stage: 2,
    code: 'CW-02',
    name: 'Mass Transit Spine',
    purpose: 'Synchronize mass trims while crossing the counterweight transit spine.',
    continuity: 'The same load spine runs between opposed mass rails and derotation machinery.',
    kit: ['mass-carriages', 'countermass-rails', 'trim-derotors'],
    eventA: 'K-91 MASS TRANSIT // COUNTERMASS CARRIAGE PHASE DRIFT',
    eventB: 'K-91 INERTIAL DATUM // TRANSIT SPINE TRIM LOCKED',
  },
  {
    stage: 3,
    code: 'CW-03',
    name: 'Power Transfer Gallery',
    purpose: 'Isolate the damaged lift bus without losing the counterweight inertial reference.',
    continuity: 'Amber datum markers continue beside lift-bus bars and service trusses.',
    kit: ['lift-bus-bars', 'transfer-isolators', 'service-trusses'],
    eventA: 'K-91 POWER TRANSFER // LIFT BUS BACKFEED ACROSS THE SPINE',
    eventB: 'K-91 BUS DATUM // POWER TRANSFER ROUTE ISOLATED',
  },
  {
    stage: 4,
    code: 'CW-04',
    name: 'Ballast Vault',
    purpose: 'Survive the final ballast shift and recover the counterweight blackbox.',
    continuity: 'The load spine terminates inside dense ballast restraint frames and mass locks.',
    kit: ['ballast-blocks', 'mass-locks', 'vault-ribs'],
    eventA: 'K-91 BALLAST SHIFT // VAULT MASS PACKAGE BROKE RESTRAINT',
    eventB: 'K-91 FINAL DATUM // BALLAST VAULT TRAVERSE SECURE',
  },
] as const;

export function k91StageIdentity(contract: Contract) {
  if (contract.megastructure !== 'counterweight') return null;
  const stage = contract.megastructureStage ?? 1;
  return K91_STAGES.find(item => item.stage === stage) ?? K91_STAGES[0];
}

export function k91RenderProfile(detailScale: number, coarse: boolean): K91RenderProfile {
  const safeDetail = Number.isFinite(detailScale) ? Math.max(0.35, Math.min(1, detailScale)) : 0.5;
  if (safeDetail < 0.58) return { name: 'performance', railPairs: 3, datumLights: 4, stageProps: 3, castStructuralShadows: false };
  if (coarse) return { name: 'mobile', railPairs: 4, datumLights: 6, stageProps: 5, castStructuralShadows: false };
  if (safeDetail < 0.88) return { name: 'balanced', railPairs: 5, datumLights: 8, stageProps: 6, castStructuralShadows: false };
  return { name: 'full', railPairs: 6, datumLights: 10, stageProps: 8, castStructuralShadows: true };
}
