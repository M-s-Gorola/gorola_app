import { beforeEach, describe, expect, it } from "vitest";

import {
  bootstrapPromise,
  resetBootstrapState,
  setBootstrapPromise,
  setStoreBootstrapPromise,
  storeBootstrapPromise
} from "./bootstrap-state";

describe("bootstrap-state singletons", () => {
  beforeEach(() => {
    resetBootstrapState();
  });

  it("allows setting and resetting the promises", () => {
    const p1 = Promise.resolve();
    const p2 = Promise.resolve();

    setBootstrapPromise(p1);
    setStoreBootstrapPromise(p2);

    // ES module exports of let variables are live bindings, so they update in real-time
    expect(bootstrapPromise).toBe(p1);
    expect(storeBootstrapPromise).toBe(p2);

    resetBootstrapState();

    expect(bootstrapPromise).toBeNull();
    expect(storeBootstrapPromise).toBeNull();
  });
});
