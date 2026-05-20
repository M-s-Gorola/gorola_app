/**
 * Module-level bootstrap promise singletons.
 *
 * Extracted into a standalone file to avoid a circular dependency between
 * `api.ts` (which reads/writes them during bootstrap) and `auth.store.ts`
 * (which must reset them on logout via `clearSession`).
 */

export let bootstrapPromise: Promise<void> | null = null;
export let storeBootstrapPromise: Promise<void> | null = null;

export function setBootstrapPromise(p: Promise<void>): void {
  bootstrapPromise = p;
}

export function setStoreBootstrapPromise(p: Promise<void>): void {
  storeBootstrapPromise = p;
}

/**
 * Resets both promise singletons to null.
 * Call this on logout so the next login triggers a fresh bootstrap
 * instead of returning the stale already-resolved promise.
 */
export function resetBootstrapState(): void {
  bootstrapPromise = null;
  storeBootstrapPromise = null;
}
