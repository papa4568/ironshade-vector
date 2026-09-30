import { Capacitor } from '@capacitor/core';
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

export type NetworkFailureKind = 'configuration' | 'timeout' | 'aborted' | 'http' | 'network' | 'invalid-response';
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
  if (error.kind === 'configuration') return `${label} is not configured for this native build.`;
  if (error.kind === 'timeout') return `${label} timed out.`;
  if (error.kind === 'aborted') return `${label} was cancelled.`;
  if (error.kind === 'http') return `${label} was rejected by the service${error.status ? ` (HTTP ${error.status})` : ''}.`;
  if (error.kind === 'invalid-response') return `${label} returned unreadable data.`;
  return `${label} could not reach the service.`;
}

const OPERATIONS_TIMEOUT_MS = 8_000;
const TELEMETRY_TIMEOUT_MS = 10_000;
const TRACE_TIMEOUT_MS = 8_000;
const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export function normalizeOperationsApiBase(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

const configuredApiBaseUrl = normalizeOperationsApiBase(viteEnv?.VITE_API_BASE_URL);

export function resolveOperationsApiUrl(path: string, apiBaseUrl = configuredApiBaseUrl) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
}

export function operationsApiConfiguration() {
  return { native: Capacitor.isNativePlatform(), baseUrl: configuredApiBaseUrl };
}

function requestUrl(path: string) {
  if (Capacitor.isNativePlatform() && !configuredApiBaseUrl) {
    throw new NetworkRequestError('configuration', 'Native Operations API origin is missing. Set VITE_API_BASE_URL when building the app.');
  }
  return resolveOperationsApiUrl(path);
}

function abortFailure(timedOut: boolean, timeoutMs: number) {
  return timedOut
    ? new NetworkRequestError('timeout', `Request timed out after ${timeoutMs}ms.`)
    : new NetworkRequestError('aborted', 'Request cancelled.');
}

type JsonRecord = Record<string, unknown>;
type JsonParser<T> = (value: unknown) => T;

const operationSponsors = ['meridian', 'heliostat', 'longarc'] as const;
const operationArchetypes = ['salvage', 'boarding', 'stabilization'] as const;
const operationObjectiveModes = ['pressure-recovery', 'grid-isolation', 'gravity-stabilization', 'machinery-recovery', 'emergency-boarding', 'deep-salvage'] as const;
const operationLocations = ['orbital-station', 'damaged-vessel', 'asteroid-refinery', 'spin-habitat', 'jovian-harvester', 'ice-mine', 'solar-yard'] as const;
const operationConditions = ['unstable-pressure', 'failing-gravity', 'damaged-grid', 'automated-defense', 'limited-atmosphere', 'low-visibility'] as const;
const runOutcomes = ['safe', 'deep', 'failed'] as const;
const weaponIds = ['carbine', 'breacher', 'rail'] as const;

function invalidResponse(detail: string): never {
  throw new NetworkRequestError('invalid-response', `Operations service returned malformed data (${detail}).`);
}

function expectRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(label);
  return value as JsonRecord;
}

function expectString(record: JsonRecord, key: string, label: string, nonEmpty = false) {
  const value = record[key];
  if (typeof value !== 'string' || (nonEmpty && value.length === 0)) invalidResponse(`${label}.${key}`);
  return value;
}

function expectBoolean(record: JsonRecord, key: string, label: string) {
  const value = record[key];
  if (typeof value !== 'boolean') invalidResponse(`${label}.${key}`);
  return value;
}

function expectNumericValue(value: unknown, label: string, options: { integer?: boolean; minimum?: number; maximum?: number } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalidResponse(label);
  if (options.integer && !Number.isInteger(value)) invalidResponse(label);
  if (options.minimum !== undefined && value < options.minimum) invalidResponse(label);
  if (options.maximum !== undefined && value > options.maximum) invalidResponse(label);
  return value;
}

function expectNumber(record: JsonRecord, key: string, label: string, options: { integer?: boolean; minimum?: number; maximum?: number } = {}) {
  return expectNumericValue(record[key], `${label}.${key}`, options);
}

function expectLiteral<const T extends readonly string[]>(record: JsonRecord, key: string, choices: T, label: string): T[number] {
  const value = record[key];
  if (typeof value !== 'string' || !choices.includes(value as T[number])) invalidResponse(`${label}.${key}`);
  return value as T[number];
}

function expectArray(value: unknown, label: string) {
  if (!Array.isArray(value)) invalidResponse(label);
  return value;
}

function parseLiteralArray<const T extends readonly string[]>(value: unknown, choices: T, label: string): T[number][] {
  return expectArray(value, label).map((entry, index) => {
    if (typeof entry !== 'string' || !choices.includes(entry as T[number])) invalidResponse(`${label}[${index}]`);
    return entry as T[number];
  });
}

function parseIntegerArray(value: unknown, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return expectArray(value, label).map((entry, index) => expectNumericValue(entry, `${label}[${index}]`, { integer: true, minimum, maximum }));
}

function parseCountMap(value: unknown, label: string) {
  const record = expectRecord(value, label);
  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(record)) {
    result[key] = expectNumericValue(count, `${label}.${key}`, { integer: true, minimum: 0 });
  }
  return result;
}

function parseWeaponShots(value: unknown, label: string): Record<WeaponId, number> {
  const record = expectRecord(value, label);
  return {
    carbine: expectNumber(record, 'carbine', label, { integer: true, minimum: 0 }),
    breacher: expectNumber(record, 'breacher', label, { integer: true, minimum: 0 }),
    rail: expectNumber(record, 'rail', label, { integer: true, minimum: 0 }),
  };
}

function parseTierBalanceMetric(value: unknown, label: string): TierBalanceMetric {
  const record = expectRecord(value, label);
  return {
    attempts: expectNumber(record, 'attempts', label, { integer: true, minimum: 0 }),
    extractions: expectNumber(record, 'extractions', label, { integer: true, minimum: 0 }),
    safeRuns: expectNumber(record, 'safeRuns', label, { integer: true, minimum: 0 }),
    deepRuns: expectNumber(record, 'deepRuns', label, { integer: true, minimum: 0 }),
    failedRuns: expectNumber(record, 'failedRuns', label, { integer: true, minimum: 0 }),
    totalDamageTaken: expectNumber(record, 'totalDamageTaken', label, { minimum: 0 }),
    totalDuration: expectNumber(record, 'totalDuration', label, { minimum: 0 }),
    killIntervalTotal: expectNumber(record, 'killIntervalTotal', label, { minimum: 0 }),
    killIntervalSamples: expectNumber(record, 'killIntervalSamples', label, { integer: true, minimum: 0 }),
    lootQualityTotal: expectNumber(record, 'lootQualityTotal', label, { minimum: 0 }),
    lootItems: expectNumber(record, 'lootItems', label, { integer: true, minimum: 0 }),
    singulars: expectNumber(record, 'singulars', label, { integer: true, minimum: 0 }),
    modifierGrades: parseCountMap(record.modifierGrades, `${label}.modifierGrades`),
  };
}

function parseRunSummary(value: unknown, label: string, tracePointsOverride?: number): RunSummary {
  const record = expectRecord(value, label);
  return {
    id: expectString(record, 'id', label, true),
    contractTitle: expectString(record, 'contractTitle', label, true),
    location: expectString(record, 'location', label),
    outcome: expectLiteral(record, 'outcome', runOutcomes, label),
    operationTier: expectNumber(record, 'operationTier', label, { integer: true, minimum: 1, maximum: 12 }),
    directive: expectBoolean(record, 'directive', label),
    level: expectNumber(record, 'level', label, { integer: true, minimum: 1, maximum: 20 }),
    duration: expectNumber(record, 'duration', label, { minimum: 0 }),
    buildLabel: expectString(record, 'buildLabel', label),
    createdAt: expectString(record, 'createdAt', label),
    tracePoints: tracePointsOverride ?? expectNumber(record, 'tracePoints', label, { integer: true, minimum: 0 }),
    daily: expectBoolean(record, 'daily', label),
  };
}

function parseRunMetrics(value: unknown): RunMetrics {
  const record = expectRecord(value, 'metrics');
  const byTierRecord = expectRecord(record.byTier, 'metrics.byTier');
  const byTier: Record<string, TierBalanceMetric> = {};
  for (const [tier, metric] of Object.entries(byTierRecord)) {
    byTier[tier] = parseTierBalanceMetric(metric, `metrics.byTier.${tier}`);
  }
  return {
    runs: expectNumber(record, 'runs', 'metrics', { integer: true, minimum: 0 }),
    attempts: expectNumber(record, 'attempts', 'metrics', { integer: true, minimum: 0 }),
    safeRuns: expectNumber(record, 'safeRuns', 'metrics', { integer: true, minimum: 0 }),
    deepRuns: expectNumber(record, 'deepRuns', 'metrics', { integer: true, minimum: 0 }),
    failedRuns: expectNumber(record, 'failedRuns', 'metrics', { integer: true, minimum: 0 }),
    totalDamageTaken: expectNumber(record, 'totalDamageTaken', 'metrics', { minimum: 0 }),
    totalDamageDealt: expectNumber(record, 'totalDamageDealt', 'metrics', { minimum: 0 }),
    totalDuration: expectNumber(record, 'totalDuration', 'metrics', { minimum: 0 }),
    weaponShots: parseWeaponShots(record.weaponShots, 'metrics.weaponShots'),
    byTier,
    protocolCombinations: parseCountMap(record.protocolCombinations, 'metrics.protocolCombinations'),
    recent: expectArray(record.recent, 'metrics.recent').map((entry, index) => parseRunSummary(entry, `metrics.recent[${index}]`)),
  };
}

function parseDailyOperation(value: unknown): DailyOperationSpec {
  const record = expectRecord(value, 'operation');
  return {
    date: expectString(record, 'date', 'operation', true),
    seed: expectNumber(record, 'seed', 'operation', { integer: true, minimum: 0, maximum: 0xffffffff }),
    codename: expectString(record, 'codename', 'operation', true),
    sponsor: expectLiteral(record, 'sponsor', operationSponsors, 'operation'),
    archetype: expectLiteral(record, 'archetype', operationArchetypes, 'operation'),
    objectiveMode: expectLiteral(record, 'objectiveMode', operationObjectiveModes, 'operation'),
    location: expectLiteral(record, 'location', operationLocations, 'operation'),
    conditions: parseLiteralArray(record.conditions, operationConditions, 'operation.conditions'),
    challenge: expectString(record, 'challenge', 'operation'),
    generatedAt: expectString(record, 'generatedAt', 'operation', true),
  };
}

function parseOperationsSnapshot(value: unknown): OperationsSnapshot {
  const record = expectRecord(value, 'operations snapshot');
  return { operation: parseDailyOperation(record.operation), metrics: parseRunMetrics(record.metrics) };
}

function parseTelemetrySession(value: unknown): { credential: string; expiresAt: string } {
  const record = expectRecord(value, 'telemetry session');
  const credential = expectString(record, 'credential', 'telemetry session', true);
  const expiresAt = expectString(record, 'expiresAt', 'telemetry session', true);
  if (!/^tsc_[0-9a-f]{64}$/.test(credential) || !Number.isFinite(Date.parse(expiresAt))) invalidResponse('telemetry session');
  return { credential, expiresAt };
}

function parseTelemetryResponse(value: unknown): { id: string; metrics: RunMetrics } {
  const record = expectRecord(value, 'telemetry response');
  return { id: expectString(record, 'id', 'telemetry response', true), metrics: parseRunMetrics(record.metrics) };
}

function parseTracePoint(value: unknown, label: string): RunTracePoint {
  const record = expectRecord(value, label);
  return {
    t: expectNumber(record, 't', label, { minimum: 0 }),
    x: expectNumber(record, 'x', label, { minimum: 0 }),
    y: expectNumber(record, 'y', label, { minimum: 0 }),
    hp: expectNumber(record, 'hp', label, { minimum: 0 }),
    armor: expectNumber(record, 'armor', label, { minimum: 0 }),
    weapon: expectLiteral(record, 'weapon', weaponIds, label),
  };
}

function parseRunTraceRecord(value: unknown): RunTraceRecord {
  const record = expectRecord(value, 'run trace');
  const trace = expectArray(record.trace, 'run trace.trace').map((entry, index) => parseTracePoint(entry, `run trace.trace[${index}]`));
  const summary = parseRunSummary(record, 'run trace', trace.length);
  const abilityUses = expectArray(record.abilityUses, 'run trace.abilityUses');
  if (abilityUses.length !== 3) invalidResponse('run trace.abilityUses');
  return {
    ...summary,
    contractId: expectString(record, 'contractId', 'run trace', true),
    objectiveMode: expectString(record, 'objectiveMode', 'run trace', true),
    salvageTags: expectNumber(record, 'salvageTags', 'run trace', { integer: true, minimum: 0 }),
    damageDealt: expectNumber(record, 'damageDealt', 'run trace', { integer: true, minimum: 0 }),
    damageTaken: expectNumber(record, 'damageTaken', 'run trace', { integer: true, minimum: 0 }),
    weaponShots: parseWeaponShots(record.weaponShots, 'run trace.weaponShots'),
    abilityUses: [
      expectNumericValue(abilityUses[0], 'run trace.abilityUses[0]', { integer: true, minimum: 0 }),
      expectNumericValue(abilityUses[1], 'run trace.abilityUses[1]', { integer: true, minimum: 0 }),
      expectNumericValue(abilityUses[2], 'run trace.abilityUses[2]', { integer: true, minimum: 0 }),
    ],
    bossDefeated: expectBoolean(record, 'bossDefeated', 'run trace'),
    operationDate: expectString(record, 'operationDate', 'run trace'),
    kills: expectNumber(record, 'kills', 'run trace', { integer: true, minimum: 0 }),
    eliteProtocolValue: expectNumber(record, 'eliteProtocolValue', 'run trace', { integer: true, minimum: 0 }),
    killIntervalTotal: expectNumber(record, 'killIntervalTotal', 'run trace', { minimum: 0 }),
    killIntervalSamples: expectNumber(record, 'killIntervalSamples', 'run trace', { integer: true, minimum: 0 }),
    protocolCombinations: parseCountMap(record.protocolCombinations, 'run trace.protocolCombinations'),
    recoveryQualities: parseIntegerArray(record.recoveryQualities, 'run trace.recoveryQualities', 0, 5),
    modifierGrades: parseIntegerArray(record.modifierGrades, 'run trace.modifierGrades', 1, 5),
    singularCount: expectNumber(record, 'singularCount', 'run trace', { integer: true, minimum: 0 }),
    trace,
  };
}

async function requestJson<T>(path: string, parser: JsonParser<T>, init?: RequestInit, options: NetworkRequestOptions = {}): Promise<T> {
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
    const response = await fetch(requestUrl(path), {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch (error) {
        if (timedOut || controller.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError') {
          throw abortFailure(timedOut, timeoutMs);
        }
      }
      throw new NetworkRequestError('http', detail || `Operations request failed (${response.status})`, response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (timedOut || controller.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError') {
        throw abortFailure(timedOut, timeoutMs);
      }
      throw new NetworkRequestError('invalid-response', 'Operations service returned unreadable data.');
    }
    return parser(payload);
  } catch (error) {
    if (isNetworkRequestError(error)) throw error;
    if (timedOut || controller.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError') {
      throw abortFailure(timedOut, timeoutMs);
    }
    throw new NetworkRequestError('network', 'Network unavailable.');
  } finally {
    clearTimeout(timeout);
    sourceSignal?.removeEventListener('abort', abortFromSource);
  }
}

export async function loadOperationsSnapshot(options?: NetworkRequestOptions) {
  return requestJson('/api/operations', parseOperationsSnapshot, undefined, { ...options, timeoutMs: options?.timeoutMs ?? OPERATIONS_TIMEOUT_MS });
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
  const requestOptions = { ...options, timeoutMs: options?.timeoutMs ?? TELEMETRY_TIMEOUT_MS };
  const session = await requestJson('/api/telemetry/session', parseTelemetrySession, {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  }, requestOptions);
  return requestJson('/api/runs', parseTelemetryResponse, {
    method: 'POST',
    headers: { 'x-idempotency-key': requestId, 'x-telemetry-credential': session.credential },
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
  }, requestOptions);
}

export async function loadRunTrace(id: string, options?: NetworkRequestOptions) {
  return requestJson(`/api/runs/${encodeURIComponent(id)}`, parseRunTraceRecord, undefined, { ...options, timeoutMs: options?.timeoutMs ?? TRACE_TIMEOUT_MS });
}
