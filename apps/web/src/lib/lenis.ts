import Lenis from "lenis";

/**
 * App-wide Lenis instance. `null` until `createGorolaLenis()` runs (e.g. from
 * `useGorolaMotion`). Destroy with `destroyGorolaLenis()` in effect cleanup.
 */
export let lenis: Lenis | null = null;
let refCount = 0;

/**
 * Create the singleton with `autoRaf: false` — RAF is driven by GSAP
 * ticker in `gsap.ts`. Uses reference counting to safely support multiple callers.
 */
export function createGorolaLenis(): Lenis {
  refCount++;
  if (lenis === null) {
    lenis = new Lenis({ autoRaf: false });
  }
  return lenis;
}

export function destroyGorolaLenis(): void {
  refCount--;
  if (refCount <= 0) {
    lenis?.destroy();
    lenis = null;
    refCount = 0;
  }
}
