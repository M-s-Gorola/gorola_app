import gsap from "gsap";
import { expect, it } from "vitest";

import { initGorolaGsapOnce } from "./gsap";

/**
 * Same cleanup model as @gsap/react’s `useGSAP()` (gsap.context under the hood).
 * Asserts `revert()` drops active tweens so work in `gsap.context()` / `useGSAP`
 * does not leak across mount cycles.
 */
it("gsap.context revert leaves no active tweens on a node", () => {
  const el = document.createElement("div");
  const ctx = gsap.context(() => {
    gsap.to(el, { x: 1, duration: 100, overwrite: "auto" });
  });
  expect(gsap.getTweensOf(el).length).toBeGreaterThan(0);
  ctx.revert();
  expect(gsap.getTweensOf(el).length).toBe(0);
});

it("repeated revert does not accumulate orphan tweens", () => {
  const el = document.createElement("div");
  for (let i = 0; i < 3; i++) {
    const ctx = gsap.context(() => {
      gsap.to(el, { x: i, duration: 100, overwrite: "auto" });
    });
    expect(gsap.getTweensOf(el).length).toBeGreaterThan(0);
    ctx.revert();
    expect(gsap.getTweensOf(el).length).toBe(0);
  }
});

it("initGorolaGsapOnce does not set E2E timescale in standard jsdom", () => {
  // Clear any previous configuration if possible (configured is local to gsap.ts)
  // But since we just want to verify the current state:
  initGorolaGsapOnce();
  expect(gsap.globalTimeline.timeScale()).toBe(1);
});
