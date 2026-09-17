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

export type NetworkFailureKind = 'timeout' | 'aborted' | 'http' | 'network' | 'invalid-response';
export type NetworkRequestOptions = { signal?: AbortSignal; timeoutMs?: number };

export class NetworkRequestError extends Error {
  kind: NetworkFailureKind;
  status?: number;
  constructor(kind: NetworkFailureKind, message: string, status?: number) {
    super(message);
    this.name = 'NetworkRequestError';
    this.kind = kind;
    this.status = status;
  }
}

export function isNetworkRequestError(error: unknown): error is NetworkRequestError {
  return error instanceof NetworkRequestError;
}

export function networkFailureMessage(error: unknown, label = 'Network request') {
  if (!isNetworkRequestError(error)) return `${label} failed unexpectedly.`;
  if (error.kind === 'timeout') return `${label} timed out.`;
  if (error.kind === 'aborted') return `${label} was cancelled.`;
  if (error.kind === 'http') return `${label} was rejected by the service${error.status ? ` (HTTP ${error.status})` : ''}.`;
  if (error.kind === 'invalid-response') return `${label} returned unreadable data.`;
  return `${label} could not reach the service.`;
}

const OPERATIONS_TIMEOUT_MS = 8_000;
const TELEMETRY_TIMEOUT_MS = 10_000;
const TRACE_TIMEOUT_MS = 8_000;

async function requestJson<T>(path: string, init?: RequestInit, options: NetworkRequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const sourceSignal = options.signal ?? init?.signal ?? undefined;
  const timeoutMs = Math.max(1, options.timeoutMs ?? OPERATIONS_TIMEOUT_MS);
  let timedOut = false;
  const abortFromSource = () => controller.abort(sourceSignal?.reason);
  if (sourceSignal?.aborted) abortFromSource();
  else sourceSignal?.addEventListener('abort', abortFromSource, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(path, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch (error) {
      if (timedOut) throw new NetworkRequestError('timeout', `Request timed out after ${timeoutMs}ms.`);
      if (controller.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError') throw new NetworkRequestError('aborted', 'Request cancelled.');
      throw new NetworkRequestError('network', 'Network unavailable.');
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new NetworkRequestError('http', detail || `Operations request failed (${response.status})`, response.status);
    }
    try {
      return await response.json() as T;
    } catch {
      throw new NetworkRequestError('invalid-response', 'Operations service returned unreadable data.');
    }
  } finally {
    clearTimeout(timeout);
    sourceSignal?.removeEventListener('abort', abortFromSource);
  }
}

export async function loadOperationsSnapshot(options?: NetworkRequestOptions) {
  return requestJson<OperationsSnapshot>('/api/operations', undefined, { ...options, timeoutMs: options?.timeoutMs ?? OPERATIONS_TIMEOUT_MS });
}

// One mission submission keeps one opaque key so transport retries cannot double-bank telemetry.
export function createTelemetryRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `telemetry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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
  requestId?: string;
}, options?: NetworkRequestOptions) {
  const requestId = input.requestId ?? createTelemetryRequestId();
  return requestJson<{ id: string; metrics: RunMetrics }>('/api/runs', {
    method: 'POST',
    headers: { 'x-idempotency-key': requestId },
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
  }, { ...options, timeoutMs: options?.timeoutMs ?? TELEMETRY_TIMEOUT_MS });
}

export async function loadRunTrace(id: string, options?: NetworkRequestOptions) {
  return requestJson<RunTraceRecord>(`/api/runs/${encodeURIComponent(id)}`, undefined, { ...options, timeoutMs: options?.timeoutMs ?? TRACE_TIMEOUT_MS });
}
