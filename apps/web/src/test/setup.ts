import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock socket.io-client globally to prevent TransportErrors in unit tests
// when components try to connect to a non-existent local server.
vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  }),
}));

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

class IntersectionObserverMock {
  root = null;
  rootMargin = "";
  thresholds = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock
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
if (window.requestAnimationFrame === undefined) {
  window.requestAnimationFrame = globalThis.requestAnimationFrame;
}
if (window.cancelAnimationFrame === undefined) {
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
}

afterEach(() => {
  cleanup();
});
