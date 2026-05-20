import { render, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, act } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";

// ─── Stable disconnect stub ───────────────────────────────────────────────────
const disconnectStub = vi.fn();

// ─── Lenis mock state ─────────────────────────────────────────────────────────
const mockScrollTo = vi.fn();
const mockResize = vi.fn();
const mockDestroy = vi.fn();
const mockOn = vi.fn(() => vi.fn());
const mockRaf = vi.fn();

const mockLenisInstance = {
  scrollTo: mockScrollTo,
  resize: mockResize,
  destroy: mockDestroy,
  on: mockOn,
  raf: mockRaf,
};

let moduleLevenLenis: typeof mockLenisInstance | null = null;

vi.mock("@/lib/lenis", () => ({
  get lenis() {
    return moduleLevenLenis;
  },
  createGorolaLenis: vi.fn(() => {
    moduleLevenLenis = mockLenisInstance;
    return mockLenisInstance;
  }),
  destroyGorolaLenis: vi.fn(() => {
    moduleLevenLenis = null;
  }),
}));

vi.mock("@/lib/gsap", () => ({
  initGorolaGsapOnce: vi.fn(),
  linkLenisToGsapTicker: vi.fn(() => disconnectStub),
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useGorolaMotion", () => {
  beforeEach(() => {
    disconnectStub.mockReset();
    mockScrollTo.mockReset();
    mockResize.mockReset();
    mockDestroy.mockReset();
    mockOn.mockReset();
    mockOn.mockImplementation(() => vi.fn());
    mockRaf.mockReset();
    moduleLevenLenis = null;

    Object.defineProperty(window, "scrollTo", {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
  });

  // ── Integration: lifecycle via App ────────────────────────────────────────

  it("creates Lenis singleton on mount and clears it on unmount", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    await waitFor(() => expect(moduleLevenLenis).not.toBeNull());
    unmount();
    await waitFor(() => expect(moduleLevenLenis).toBeNull());
  });

  // ── Unit: synchronous scroll reset on route change ────────────────────────

  it("calls scrollTo(0, immediate) synchronously when pathname changes", async () => {
    const { useGorolaMotion } = await import("./useGorolaMotion");

    // Mount — Effect 1 runs (creates instance → singleton set),
    // Effect 2 runs (reads singleton via lenisLib.lenis → calls scrollTo)
    renderHook(() => useGorolaMotion(), { wrapper });

    expect(mockScrollTo).toHaveBeenCalledWith(0, { immediate: true });
    // window.scrollTo must NOT have been used as fallback
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("calls resize() via requestAnimationFrame after scroll reset", async () => {
    vi.useFakeTimers();
    const { useGorolaMotion } = await import("./useGorolaMotion");

    renderHook(() => useGorolaMotion(), { wrapper });

    // resize is in rAF — not yet called
    expect(mockResize).not.toHaveBeenCalled();

    // Flush rAF
    await act(async () => {
      vi.runAllTimers();
    });

    expect(mockResize).toHaveBeenCalled();
    vi.useRealTimers();
  });

  // ── Unit: unmount cleanup ─────────────────────────────────────────────────

  it("calls disconnect and destroyGorolaLenis on unmount", async () => {
    const { destroyGorolaLenis } = await import("@/lib/lenis");
    const { useGorolaMotion } = await import("./useGorolaMotion");

    const { unmount } = renderHook(() => useGorolaMotion(), { wrapper });
    unmount();

    expect(disconnectStub).toHaveBeenCalled();
    expect(destroyGorolaLenis).toHaveBeenCalled();
  });

  // ── Unit: fallback when lenis is null ─────────────────────────────────────

  it("falls back to window.scrollTo when lenis singleton is null", async () => {
    const { useGorolaMotion } = await import("./useGorolaMotion");

    // Force singleton to stay null by overriding createGorolaLenis
    const { createGorolaLenis } = await import("@/lib/lenis");
    vi.mocked(createGorolaLenis).mockImplementationOnce(() => {
      // Don't set moduleLevenLenis — keep it null so Effect 2 sees null
      return mockLenisInstance;
    });

    renderHook(() => useGorolaMotion(), { wrapper });

    // moduleLevenLenis is still null (we didn't set it), so fallback fires
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  /**
   * REGRESSION — the async dynamic import bug.
   *
   * My previous "fix" used `import("@/lib/lenis").then(...)` which is async.
   * This caused scroll reset to happen AFTER the page painted (Promise microtask),
   * making the page briefly visible at the old scroll position before snapping.
   * The current implementation calls scrollTo synchronously so there is no visual
   * delay — the snap happens in the same effect flush as the route render.
   *
   * This test verifies that scrollTo is called SYNCHRONOUSLY (not in a Promise):
   * if it were async, mockScrollTo would have 0 calls at assertion time.
   */
  it("REGRESSION: scrollTo fires synchronously, not after a Promise microtask", async () => {
    const { useGorolaMotion } = await import("./useGorolaMotion");
    let promiseFired = false;

    // If the implementation uses import().then(), this flag would be set BEFORE scrollTo
    const origScrollTo = mockScrollTo.getMockImplementation();
    mockScrollTo.mockImplementation((...args) => {
      // At the time scrollTo fires, any pending microtasks should NOT have run yet
      expect(promiseFired).toBe(false);
      origScrollTo?.(...args);
    });

    renderHook(() => useGorolaMotion(), { wrapper });

    // Schedule a microtask — if scrollTo was also async, it would race this
    await Promise.resolve().then(() => {
      promiseFired = true;
    });

    // scrollTo must have been called (not skipped)
    expect(mockScrollTo).toHaveBeenCalledWith(0, { immediate: true });
  });
});
