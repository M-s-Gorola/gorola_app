import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
});

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock
});

if (globalThis.requestAnimationFrame === undefined) {
  globalThis.requestAnimationFrame = function (callback: (timestamp: number) => void): number {
    return setTimeout(() => {
      callback(performance.now());
    }, 0) as unknown as number;
  };
}
if (globalThis.cancelAnimationFrame === undefined) {
  globalThis.cancelAnimationFrame = function (handle: number): void {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  };
}

afterEach(() => {
  cleanup();
});
