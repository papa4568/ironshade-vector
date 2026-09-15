import type { Contract, DailyOperationSpec } from './campaign';
import type { RunTracePoint, Telemetry, WeaponId } from './sim';

export type RunOutcome = 'safe' | 'deep' | 'failed';
export type TierBalanceMetric = {
  attempts: number;
  extractions: number;
  safeRuns: number;
  deepRuns: number;
  failedRuns: number;
  totalDamageTaken: number;
  totalDuration: number;
  killIntervalTotal: number;
  killIntervalSamples: number;
  lootQualityTotal: number;
  lootItems: number;
  singulars: number;
  modifierGrades: Record<string, number>;
};

export type RunSummary = {
  id: string;
  contractTitle: string;
  location: string;
  outcome: RunOutcome;
  operationTier: number;
  directive: boolean;
  level: number;
  duration: number;
  buildLabel: string;
  createdAt: string;
  tracePoints: number;
  daily: boolean;
};

export type RunMetrics = {
  runs: number;
  attempts: number;
  safeRuns: number;
  deepRuns: number;
  failedRuns: number;
  totalDamageTaken: number;
  totalDamageDealt: number;
  totalDuration: number;
  weaponShots: Record<WeaponId, number>;
  byTier: Record<string, TierBalanceMetric>;
  protocolCombinations: Record<string, number>;
  recent: RunSummary[];
};

export type OperationsSnapshot = {
  operation: DailyOperationSpec;
  metrics: RunMetrics;
};

export type RunTraceRecord = RunSummary & {
  contractId: string;
  objectiveMode: string;
  salvageTags: number;
  damageDealt: number;
  damageTaken: number;
  weaponShots: Record<WeaponId, number>;
  abilityUses: [number, number, number];
  bossDefeated: boolean;
  operationDate: string;
  kills: number;
  eliteProtocolValue: number;
  killIntervalTotal: number;
  killIntervalSamples: number;
  protocolCombinations: Record<string, number>;
  recoveryQualities: number[];
  modifierGrades: number[];
  singularCount: number;
  trace: RunTracePoint[];
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Operations request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function loadOperationsSnapshot() {
  return requestJson<OperationsSnapshot>('/api/operations');
}

export async function uploadRunTelemetry(input: {
  contract: Contract;
  telemetry: Telemetry;
  outcome: RunOutcome;
  salvageTags: number;
  level: number;
  buildLabel: string;
  recoveryQualities?: number[];
  modifierGrades?: number[];
  singularCount?: number;
}) {
  return requestJson<{ id: string; metrics: RunMetrics }>('/api/runs', {
    method: 'POST',
    body: JSON.stringify({
      contractId: input.contract.id,
      contractTitle: input.contract.title,
      location: input.contract.locationName,
      objectiveMode: input.contract.objectiveMode,
      outcome: input.outcome,
      operationTier: input.contract.operationTier ?? 1,
      directive: Boolean(input.contract.directiveId),
      level: input.level,
      duration: input.telemetry.duration,
      buildLabel: input.buildLabel,
      salvageTags: input.salvageTags,
      damageDealt: input.telemetry.damageDealt,
      damageTaken: input.telemetry.damageTaken,
      kills: input.telemetry.kills,
      eliteProtocolValue: input.telemetry.eliteProtocolsDefeated,
      killIntervalTotal: input.telemetry.killIntervalTotal,
      killIntervalSamples: input.telemetry.killIntervalSamples,
      protocolCombinations: input.telemetry.protocolCombinations,
      recoveryQualities: input.recoveryQualities ?? [],
      modifierGrades: input.modifierGrades ?? [],
      singularCount: input.singularCount ?? 0,
      weaponShots: input.telemetry.weaponShots,
      abilityUses: input.telemetry.abilityUses,
      bossDefeated: input.outcome === 'deep',
      daily: Boolean(input.contract.daily),
      operationDate: input.contract.operationDate ?? '',
      trace: input.telemetry.trace,
    }),
  });
}

export async function loadRunTrace(id: string) {
  return requestJson<RunTraceRecord>(`/api/runs/${encodeURIComponent(id)}`);
}
