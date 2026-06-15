import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OlaMapAdapter,
  resetOlaScriptPromise
} from "../../lib/adapters/ola-map-adapter";

describe("OlaMapAdapter", () => {
  let container: HTMLDivElement;
  let adapter: OlaMapAdapter;
  const center = { lat: 30.45, lng: 78.06 };

  // Mock global objects and instances
  const mockMapInstance = {
    remove: vi.fn(),
    setCenter: vi.fn(),
    fitBounds: vi.fn()
  };

  const mockMarkerInstance = {
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn()
  };

  const mockOlaMaps = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.init = vi.fn(() => mockMapInstance);
  }) as unknown as NonNullable<typeof window.OlaMaps> & {
    mockClear(): void;
    Marker: {
      mockClear(): void;
    };
  };

  mockOlaMaps.Marker = vi.fn().mockImplementation(function () {
    return mockMarkerInstance;
  }) as unknown as typeof mockOlaMaps.Marker & { mockClear(): void };

  beforeEach(() => {
    container = document.createElement("div");
    adapter = new OlaMapAdapter();
    resetOlaScriptPromise();

    vi.stubEnv("VITE_OLA_MAPS_API_KEY", "test-api-key");
    window.OlaMaps = mockOlaMaps as unknown as NonNullable<typeof window.OlaMaps>;
    mockOlaMaps.mockClear();
    mockOlaMaps.Marker.mockClear();
    mockMapInstance.remove.mockClear();
    mockMapInstance.setCenter.mockClear();
    mockMapInstance.fitBounds.mockClear();
    mockMarkerInstance.setLngLat.mockClear();
    mockMarkerInstance.addTo.mockClear();
    mockMarkerInstance.remove.mockClear();

    // Clean up document head scripts
    const scripts = document.head.querySelectorAll("script");
    scripts.forEach((s) => s.remove());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.OlaMaps;
    vi.restoreAllMocks();
  });

  it("throws error if VITE_OLA_MAPS_API_KEY is missing", async () => {
    vi.stubEnv("VITE_OLA_MAPS_API_KEY", "");
    await expect(adapter.init(container, center, 14)).rejects.toThrow(
      "VITE_OLA_MAPS_API_KEY is not configured"
    );
  });

  it("injects Ola Maps script dynamically and initializes the map", async () => {
    const appendSpy = vi.spyOn(document.head, "appendChild");
    
    const initPromise = adapter.init(container, center, 14);

    // Script should be appended to head
    expect(appendSpy).toHaveBeenCalled();
    const script = appendSpy.mock.calls[0]![0] as HTMLScriptElement;
    expect(script.src).toBe("https://api.olamaps.io/libs/latest/olamaps.js");

    // Simulate script load completion
    script.onload?.(new Event("load"));

    await initPromise;

    expect(mockOlaMaps).toHaveBeenCalledWith({ apiKey: "test-api-key" });
  });

  it("adds a buyer marker to the map", async () => {
    const appendSpy = vi.spyOn(document.head, "appendChild");
    const initPromise = adapter.init(container, center, 14);
    const script = appendSpy.mock.calls[0]![0] as HTMLScriptElement;
    script.onload?.(new Event("load"));
    await initPromise;

    adapter.addMarker(center, "buyer");

    expect(mockOlaMaps.Marker).toHaveBeenCalledWith(
      expect.objectContaining({
        element: expect.any(HTMLDivElement)
      })
    );
    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledWith([center.lng, center.lat]);
    expect(mockMarkerInstance.addTo).toHaveBeenCalledWith(mockMapInstance);
  });

  it("adds a rider marker to the map", async () => {
    const appendSpy = vi.spyOn(document.head, "appendChild");
    const initPromise = adapter.init(container, center, 14);
    const script = appendSpy.mock.calls[0]![0] as HTMLScriptElement;
    script.onload?.(new Event("load"));
    await initPromise;

    const riderCoords = { lat: 30.455, lng: 78.068 };
    adapter.addMarker(riderCoords, "rider");

    expect(mockOlaMaps.Marker).toHaveBeenCalledWith(
      expect.objectContaining({
        element: expect.any(HTMLDivElement)
      })
    );
    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledWith([riderCoords.lng, riderCoords.lat]);
    expect(mockMarkerInstance.addTo).toHaveBeenCalledWith(mockMapInstance);
  });

  it("destroys map instance and cleans up elements", async () => {
    const appendSpy = vi.spyOn(document.head, "appendChild");
    const initPromise = adapter.init(container, center, 14);
    const script = appendSpy.mock.calls[0]![0] as HTMLScriptElement;
    script.onload?.(new Event("load"));
    await initPromise;

    adapter.destroy();

    expect(mockMapInstance.remove).toHaveBeenCalled();
  });
});
