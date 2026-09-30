type StoreInput = string | { name: string };
type WriteOptions = { onlyIfNew?: boolean; onlyIfMatch?: string };
type StoredEntry = { data: unknown; etag: string };

type MockCall = {
  store: string;
  method: 'get' | 'getWithMetadata' | 'setJSON' | 'list';
  key?: string;
  options?: Record<string, unknown>;
};

const stores = new Map<string, Map<string, StoredEntry>>();
const calls: MockCall[] = [];
let etagSequence = 0;
let metricsContention = false;
let metricsContentionFailures = 0;
let listPageSize = 1_000;
const activeGets = new Map<string, number>();
const maxConcurrentGets = new Map<string, number>();
const listPageYields = new Map<string, number>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function storeName(input: StoreInput) {
  return typeof input === 'string' ? input : input.name;
}

function entriesFor(name: string) {
  let entries = stores.get(name);
  if (!entries) {
    entries = new Map();
    stores.set(name, entries);
  }
  return entries;
}

export function resetMockBlobStores() {
  stores.clear();
  calls.length = 0;
  etagSequence = 0;
  metricsContention = false;
  metricsContentionFailures = 0;
  listPageSize = 1_000;
  activeGets.clear();
  maxConcurrentGets.clear();
  listPageYields.clear();
}

export function setMockMetricsContention(enabled: boolean) {
  metricsContention = enabled;
}

export function setMockMetricsContentionFailures(count: number) {
  metricsContentionFailures = Math.max(0, Math.floor(count));
}

export function setMockListPageSize(size: number) {
  listPageSize = Math.max(1, Math.floor(size));
}

export function getMockMaxConcurrentGets(store: string) {
  return maxConcurrentGets.get(store) ?? 0;
}

export function getMockListPageYields(store: string) {
  return listPageYields.get(store) ?? 0;
}

export function getMockBlobCalls(store?: string) {
  return calls.filter(call => !store || call.store === store).map(call => clone(call));
}

export function getMockStoreJson<T>(store: string, key: string): T | null {
  const entry = stores.get(store)?.get(key);
  return entry ? clone(entry.data) as T : null;
}

export function getMockStoreKeys(store: string) {
  return [...(stores.get(store)?.keys() ?? [])];
}

export function getStore(input: StoreInput) {
  const name = storeName(input);
  const entries = entriesFor(name);
  return {
    async get(key: string, options?: Record<string, unknown>) {
      calls.push({ store: name, method: 'get', key, options });
      const active = (activeGets.get(name) ?? 0) + 1;
      activeGets.set(name, active);
      maxConcurrentGets.set(name, Math.max(maxConcurrentGets.get(name) ?? 0, active));
      try {
        await Promise.resolve();
        const entry = entries.get(key);
        return entry ? clone(entry.data) : null;
      } finally {
        activeGets.set(name, Math.max(0, (activeGets.get(name) ?? 1) - 1));
      }
    },
    async getWithMetadata(key: string, options?: Record<string, unknown>) {
      calls.push({ store: name, method: 'getWithMetadata', key, options });
      const entry = entries.get(key);
      return entry ? { data: clone(entry.data), etag: entry.etag } : null;
    },
    async setJSON(key: string, value: unknown, options: WriteOptions = {}) {
      calls.push({ store: name, method: 'setJSON', key, options: clone(options) });
      const existing = entries.get(key);
      if (name === 'ironshade-metrics' && (options.onlyIfNew || options.onlyIfMatch)) {
        if (metricsContention) return { modified: false };
        if (metricsContentionFailures > 0) {
          metricsContentionFailures -= 1;
          return { modified: false };
        }
      }
      if (options.onlyIfNew && existing) return { modified: false };
      if (options.onlyIfMatch && existing?.etag !== options.onlyIfMatch) return { modified: false };
      const etag = `etag-${++etagSequence}`;
      entries.set(key, { data: clone(value), etag });
      return { modified: true, etag };
    },
    list(options: { paginate?: boolean } = {}) {
      calls.push({ store: name, method: 'list', options: clone(options) });
      const blobs = [...entries.entries()].map(([key, entry]) => ({ key, etag: entry.etag }));
      if (options.paginate) {
        return (async function* () {
          for (let start = 0; start < blobs.length; start += listPageSize) {
            listPageYields.set(name, (listPageYields.get(name) ?? 0) + 1);
            yield { blobs: blobs.slice(start, start + listPageSize), directories: [] as string[] };
          }
        })();
      }
      return Promise.resolve({ blobs, directories: [] as string[] });
    },
  };
}
