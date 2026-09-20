import type { Contract } from './campaign';

export type PerseidStageNumber = 1 | 2 | 3 | 4;

export type PerseidStageIdentity = {
  stage: PerseidStageNumber;
  code: string;
  name: string;
  purpose: string;
  continuity: string;
  kit: readonly string[];
  eventA: string;
  eventB: string;
};

export type PerseidRenderProfileName = 'full' | 'balanced' | 'mobile' | 'performance';

export type PerseidRenderProfile = {
  name: PerseidRenderProfileName;
  ribPairs: number;
  guideLights: number;
  stageProps: number;
  castStructuralShadows: boolean;
};

export const PERSEID_STAGES: readonly PerseidStageIdentity[] = [
  {
    stage: 1,
    code: 'PS-01',
    name: 'Docking Spine',
    purpose: 'Recover pressure control and establish a stable route into the ship.',
    continuity: 'Keel spine, pressure ribs, and green transit datum remain visible.',
    kit: ['docking-collar', 'pressure-ribs', 'keel-conduit'],
    eventA: 'PERSEID HULL FLEX // OUTER DOCK LOAD MOVING THROUGH THE KEEL',
    eventB: 'PERSEID TRANSIT DATUM // INNER AIRLOCK ROUTE CONFIRMED',
  },
  {
    stage: 2,
    code: 'PS-02',
    name: 'Agricultural Drum',
    purpose: 'Stabilize the agricultural drum while recovering the seed-vault control core.',
    continuity: 'The same keel datum crosses a rotating farm ring and seed-service lattice.',
    kit: ['grow-light-banks', 'seed-troughs', 'rotation-datum'],
    eventA: 'PERSEID DRUM LOAD // AGRICULTURAL RING PHASE DRIFT DETECTED',
    eventB: 'PERSEID SEED ROUTE // SERVICE DATUM LOCKED TO INNER TRANSIT',
  },
  {
    stage: 3,
    code: 'PS-03',
    name: 'Cryogenic Service Deck',
    purpose: 'Isolate the service grid and recover the cryobank registry.',
    continuity: 'Keel markers continue through frost-dark service galleries and cryobank stacks.',
    kit: ['cryobank-stacks', 'service-pipe-banks', 'cold-bus-trunks'],
    eventA: 'PERSEID CRYOBANK // SERVICE BOILOFF CROSSING THE DECK',
    eventB: 'PERSEID REGISTRY ROUTE // COLD BUS ISOLATION CONFIRMED',
  },
  {
    stage: 4,
    code: 'PS-04',
    name: 'Reactor Choir',
    purpose: 'Recover reactor harmonics and decide whether to breach the Steward Core.',
    continuity: 'The keel terminates in harmonic bus arches around the sealed steward apse.',
    kit: ['harmonic-pylons', 'reactor-bus-arches', 'steward-seal'],
    eventA: 'PERSEID REACTOR CHOIR // HARMONIC BUS PHASE IS SLIPPING',
    eventB: 'PERSEID STEWARD APSE // COMMAND SEAL HAS A LIVE RESPONSE',
  },
] as const;

export function perseidStageIdentity(contract: Contract) {
  if (contract.megastructure !== 'generation-ship') return null;
  const stage = contract.megastructureStage ?? 1;
  return PERSEID_STAGES.find(item => item.stage === stage) ?? PERSEID_STAGES[0];
}

export function perseidRenderProfile(detailScale: number, coarse: boolean): PerseidRenderProfile {
  const safeDetail = Number.isFinite(detailScale) ? Math.max(0.35, Math.min(1, detailScale)) : 0.5;
  if (safeDetail < 0.58) return { name: 'performance', ribPairs: 3, guideLights: 4, stageProps: 3, castStructuralShadows: false };
  if (coarse) return { name: 'mobile', ribPairs: 4, guideLights: 6, stageProps: 4, castStructuralShadows: false };
  if (safeDetail < 0.88) return { name: 'balanced', ribPairs: 5, guideLights: 8, stageProps: 5, castStructuralShadows: false };
  return { name: 'full', ribPairs: 7, guideLights: 10, stageProps: 7, castStructuralShadows: true };
}
