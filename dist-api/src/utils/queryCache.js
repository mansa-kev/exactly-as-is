const cache = new Map();
const inflight = new Map();
export async function getOrSetCache(key, ttlMs, fetcher) {
    const now = Date.now();
    const existing = cache.get(key);
    if (existing && existing.expiresAt > now) {
        return existing.data;
    }
    const pending = inflight.get(key);
    if (pending) {
        return pending;
    }
    const promise = fetcher()
        .then((data) => {
        cache.set(key, { data, expiresAt: Date.now() + ttlMs });
        inflight.delete(key);
        return data;
    })
        .catch((error) => {
        inflight.delete(key);
        throw error;
    });
    inflight.set(key, promise);
    return promise;
}
export function invalidateCache(key) {
    cache.delete(key);
    inflight.delete(key);
}
export function invalidateCachePrefix(prefix) {
    for (const key of Array.from(cache.keys())) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
    for (const key of Array.from(inflight.keys())) {
        if (key.startsWith(prefix)) {
            inflight.delete(key);
        }
    }
}
