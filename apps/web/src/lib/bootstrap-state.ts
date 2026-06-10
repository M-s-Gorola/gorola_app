/**
 * Module-level bootstrap promise singletons.
 *
 * Extracted into a standalone file to avoid a circular dependency between
 * `api.ts` (which reads/writes them during bootstrap) and `auth.store.ts`
 * (which must reset them on logout via `clearSession`).
 */

export let bootstrapPromise: Promise<void> | null = null;
export let storeBootstrapPromise: Promise<void> | null = null;
export let adminBootstrapPromise: Promise<void> | null = null;
export let riderBootstrapPromise: Promise<void> | null = null;

export function setBootstrapPromise(p: Promise<void>): void {
  bootstrapPromise = p;
}

export function setStoreBootstrapPromise(p: Promise<void>): void {
  storeBootstrapPromise = p;
}

export function setAdminBootstrapPromise(p: Promise<void>): void {
  adminBootstrapPromise = p;
}

export function setRiderBootstrapPromise(p: Promise<void>): void {
  riderBootstrapPromise = p;
}

/**
 * Resets all promise singletons to null.
 * Call this on logout so the next login triggers a fresh bootstrap
 * instead of returning the stale already-resolved promise.
 */
export function resetBootstrapState(): void {
  bootstrapPromise = null;
  storeBootstrapPromise = null;
  adminBootstrapPromise = null;
  riderBootstrapPromise = null;
}
