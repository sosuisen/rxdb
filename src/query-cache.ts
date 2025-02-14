/**
 * the query-cache makes sure that on every query-state, exactly one instance can exist
 * if you use the same mango-query more then once, it will reuse the first RxQuery
 */
import type {
    RxQuery,
    RxCacheReplacementPolicy,
    RxCollection
} from './types';
import { now } from './util';

export class QueryCache {
    public _map: Map<string, RxQuery> = new Map();

    /**
     * check if an equal query is in the cache,
     * if true, return the cached one,
     * if false, save the given one and return it
     */
    getByQuery(rxQuery: RxQuery): RxQuery {
        const stringRep = rxQuery.toString();
        if (!this._map.has(stringRep)) {
            this._map.set(stringRep, rxQuery);
        }
        return this._map.get(stringRep) as RxQuery;
    }
}

export function createQueryCache() {
    return new QueryCache();
}


export function uncacheRxQuery(queryCache: QueryCache, rxQuery: RxQuery) {
    rxQuery.uncached = true;
    const stringRep = rxQuery.toString();
    queryCache._map.delete(stringRep);

}


export function countRxQuerySubscribers(rxQuery: RxQuery): number {
    return rxQuery.refCount$.observers.length;
}


export const DEFAULT_TRY_TO_KEEP_MAX = 100;
export const DEFAULT_UNEXECUTED_LIFETME = 30 * 1000;
export const DEFAULT_CACHE_REPLACEMENT_WAIT_TIME = 20 * 1000;

/**
 * The default cache replacement policy
 * See docs-src/query-cache.md to learn how it should work.
 * Notice that this runs often and should block the cpu as less as possible
 * This is a monad which makes it easier to unit test
 */
export const defaultCacheReplacementPolicyMonad: (
    tryToKeepMax: number,
    unExecutedLifetime: number
) => RxCacheReplacementPolicy = (
    tryToKeepMax,
    unExecutedLifetime
) => (
    _collection: RxCollection,
    queryCache: QueryCache
) => {
            if (queryCache._map.size < tryToKeepMax) {
                return;
            }

            const minUnExecutedLifetime = now() - unExecutedLifetime;
            const maybeUncash: RxQuery[] = [];

            for (const rxQuery of queryCache._map.values()) {
                // filter out queries with subscribers
                if (countRxQuerySubscribers(rxQuery) > 0) {
                    continue;
                }
                // directly uncache queries that never executed and are older then unExecutedLifetime
                if (rxQuery._lastEnsureEqual === 0 && rxQuery._creationTime < minUnExecutedLifetime) {
                    uncacheRxQuery(queryCache, rxQuery);
                    continue;
                }
                maybeUncash.push(rxQuery);
            }

            const mustUncache = maybeUncash.length - tryToKeepMax;
            if (mustUncache <= 0) {
                return;
            }

            const sortedByLastUsage = maybeUncash.sort((a, b) => a._lastEnsureEqual - b._lastEnsureEqual);
            const toRemove = sortedByLastUsage.slice(0, mustUncache);
            toRemove.forEach(rxQuery => uncacheRxQuery(queryCache, rxQuery));
        };


export const defaultCacheReplacementPolicy: RxCacheReplacementPolicy = defaultCacheReplacementPolicyMonad(
    DEFAULT_TRY_TO_KEEP_MAX,
    DEFAULT_UNEXECUTED_LIFETME
);


// @link https://stackoverflow.com/a/56239226/3443137
declare type TimeoutType = ReturnType<typeof setTimeout>;

export const CACHE_REPLACEMENT_STATE_BY_COLLECTION: WeakMap<RxCollection, TimeoutType> = new WeakMap();
export const COLLECTIONS_WITH_DESTROY_HOOK: WeakSet<RxCollection> = new WeakSet();

/**
 * Triggers the cache replacement policy after waitTime has passed.
 * We do not run this directly because at exactly the time a query is created,
 * we need all CPU to minimize latency.
 * Also this should not be triggered multiple times when waitTime is still waiting.
 */
export function triggerCacheReplacement(
    rxCollection: RxCollection,
    waitTime: number = DEFAULT_CACHE_REPLACEMENT_WAIT_TIME
) {
    if (CACHE_REPLACEMENT_STATE_BY_COLLECTION.has(rxCollection)) {
        // already started
        return;
    }

    // ensure we clean up the runnung timeouts when the collection is destroyed
    if (!COLLECTIONS_WITH_DESTROY_HOOK.has(rxCollection)) {
        rxCollection.onDestroy.then(() => {
            const timeout: TimeoutType | undefined = CACHE_REPLACEMENT_STATE_BY_COLLECTION.get(rxCollection);
            if (timeout) {
                clearTimeout(timeout);
            }
        });
        COLLECTIONS_WITH_DESTROY_HOOK.add(rxCollection);
    }

    const val: TimeoutType = setTimeout(() => {
        CACHE_REPLACEMENT_STATE_BY_COLLECTION.delete(rxCollection);
        rxCollection.cacheReplacementPolicy(rxCollection, rxCollection._queryCache);
    }, waitTime);
    CACHE_REPLACEMENT_STATE_BY_COLLECTION.set(rxCollection, val);
}
