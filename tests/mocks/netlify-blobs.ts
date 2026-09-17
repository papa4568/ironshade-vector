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
}

export function setMockMetricsContention(enabled: boolean) {
  metricsContention = enabled;
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
      const entry = entries.get(key);
      return entry ? clone(entry.data) : null;
    },
    async getWithMetadata(key: string, options?: Record<string, unknown>) {
      calls.push({ store: name, method: 'getWithMetadata', key, options });
      const entry = entries.get(key);
      return entry ? { data: clone(entry.data), etag: entry.etag } : null;
    },
    async setJSON(key: string, value: unknown, options: WriteOptions = {}) {
      calls.push({ store: name, method: 'setJSON', key, options: clone(options) });
      const existing = entries.get(key);
      if (name === 'ironshade-metrics' && metricsContention && (options.onlyIfNew || options.onlyIfMatch)) return { modified: false };
      if (options.onlyIfNew && existing) return { modified: false };
      if (options.onlyIfMatch && existing?.etag !== options.onlyIfMatch) return { modified: false };
      const etag = `etag-${++etagSequence}`;
      entries.set(key, { data: clone(value), etag });
      return { modified: true, etag };
    },
    async list() {
      calls.push({ store: name, method: 'list' });
      return { blobs: [...entries.keys()].map(key => ({ key })) };
    },
  };
}
