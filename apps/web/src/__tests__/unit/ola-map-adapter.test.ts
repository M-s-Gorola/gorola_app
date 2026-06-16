import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import buyerPng from "../../assets/buyer.png";
import riderPng from "../../assets/rider.png";
import {
  OlaMapAdapter,
  resetOlaScriptPromise
} from "../../lib/adapters/ola-map-adapter";
import { fetchOlaRoute } from "../../lib/map-route-helper";

// Mock the route helper module
vi.mock("../../lib/map-route-helper", () => ({
  fetchOlaRoute: vi.fn().mockResolvedValue([
    [30.455, 78.068],
    [30.452, 78.064],
    [30.45, 78.06]
  ])
}));

describe("OlaMapAdapter", () => {
  let container: HTMLDivElement;
  let adapter: OlaMapAdapter;
  const center = { lat: 30.45, lng: 78.06 };

  // Mock global objects and instances
  const mockMapInstance = {
    remove: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    resize: vi.fn(),
    fitBounds: vi.fn(),
    on: vi.fn(),
    isStyleLoaded: vi.fn(() => true),
    getSource: vi.fn(),
    addSource: vi.fn(),
    getLayer: vi.fn(),
    addLayer: vi.fn(),
    removeSource: vi.fn(),
    removeLayer: vi.fn()
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
    mockMapInstance.setZoom.mockClear();
    mockMapInstance.resize.mockClear();
    mockMapInstance.fitBounds.mockClear();
    mockMapInstance.on.mockClear();
    mockMapInstance.isStyleLoaded.mockClear();
    mockMapInstance.getSource.mockClear();
    mockMapInstance.addSource.mockClear();
    mockMapInstance.getLayer.mockClear();
    mockMapInstance.addLayer.mockClear();
    mockMapInstance.removeSource.mockClear();
    mockMapInstance.removeLayer.mockClear();
    mockMarkerInstance.setLngLat.mockClear();
    mockMarkerInstance.addTo.mockClear();
    mockMarkerInstance.remove.mockClear();
    vi.mocked(fetchOlaRoute).mockClear();

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
    expect(script.src).toBe("https://www.unpkg.com/olamaps-web-sdk@latest/dist/olamaps-web-sdk.umd.js");

    // Simulate script load completion
    script.onload?.(new Event("load"));

    await initPromise;

    expect(mockOlaMaps).toHaveBeenCalledWith({ apiKey: "test-api-key" });
  });

  it("adds a buyer marker to the map with saturated filter styling", async () => {
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
    const markerEl = (mockOlaMaps.Marker as unknown as { mock: { calls: Array<[{ element: HTMLDivElement }]>; }; }).mock.calls[0]![0]!.element!;
    expect(markerEl.style.width).toBe("40px");
    expect(markerEl.style.height).toBe("40px");
    expect(markerEl.style.backgroundImage).toBe(`url("${buyerPng}")`);
    expect(markerEl.style.filter).toContain("saturate(2)");
    expect(markerEl.style.filter).toContain("contrast(1.2)");

    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledWith([center.lng, center.lat]);
    expect(mockMarkerInstance.addTo).toHaveBeenCalledWith(mockMapInstance);
  });

  it("adds a rider marker to the map with saturated filter styling", async () => {
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
    const markerEl = (mockOlaMaps.Marker as unknown as { mock: { calls: Array<[{ element: HTMLDivElement }]>; }; }).mock.calls[0]![0]!.element!;
    expect(markerEl.style.width).toBe("40px");
    expect(markerEl.style.height).toBe("40px");
    expect(markerEl.style.backgroundImage).toBe(`url("${riderPng}")`);
    expect(markerEl.style.filter).toContain("saturate(2)");
    expect(markerEl.style.filter).toContain("contrast(1.2)");

    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledWith([riderCoords.lng, riderCoords.lat]);
    expect(mockMarkerInstance.addTo).toHaveBeenCalledWith(mockMapInstance);
  });

  it("draws and cleans up road route when both buyer and rider markers are added and style is loaded", async () => {
    const appendSpy = vi.spyOn(document.head, "appendChild");
    const initPromise = adapter.init(container, center, 14);
    const script = appendSpy.mock.calls[0]![0] as HTMLScriptElement;
    script.onload?.(new Event("load"));
    await initPromise;

    const loadCallback = mockMapInstance.on.mock.calls.find((c) => c[0] === "load")?.[1];
    expect(loadCallback).toBeDefined();

    adapter.addMarker(center, "buyer");
    const riderCoords = { lat: 30.455, lng: 78.068 };
    adapter.addMarker(riderCoords, "rider");

    loadCallback();

    // Wait for async _drawRoute
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchOlaRoute).toHaveBeenCalledWith(riderCoords, center, "test-api-key");
    expect(mockMapInstance.addSource).toHaveBeenCalledWith(
      "route-source",
      expect.objectContaining({
        type: "geojson",
        data: expect.objectContaining({
          geometry: expect.objectContaining({
            type: "LineString",
            // LngLat conversion check: [30.455, 78.068] -> [78.068, 30.455]
            coordinates: [
              [78.068, 30.455],
              [78.064, 30.452],
              [78.06, 30.45]
            ]
          })
        })
      })
    );
    expect(mockMapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "route-layer",
        type: "line",
        source: "route-source"
      })
    );

    mockMapInstance.getLayer.mockReturnValueOnce({});
    mockMapInstance.getSource.mockReturnValueOnce({});

    adapter.destroy();

    expect(mockMapInstance.removeLayer).toHaveBeenCalledWith("route-layer");
    expect(mockMapInstance.removeSource).toHaveBeenCalledWith("route-source");
  });

  it("falls back to straight line route in GeoJSON format when directions API fails", async () => {
    vi.mocked(fetchOlaRoute).mockRejectedValueOnce(new Error("API Error"));

    const appendSpy = vi.spyOn(document.head, "appendChild");
    const initPromise = adapter.init(container, center, 14);
    const script = appendSpy.mock.calls[0]![0] as HTMLScriptElement;
    script.onload?.(new Event("load"));
    await initPromise;

    const loadCallback = mockMapInstance.on.mock.calls.find((c) => c[0] === "load")?.[1];
    loadCallback();

    adapter.addMarker(center, "buyer");
    const riderCoords = { lat: 30.455, lng: 78.068 };
    adapter.addMarker(riderCoords, "rider");

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockMapInstance.addSource).toHaveBeenCalledWith(
      "route-source",
      expect.objectContaining({
        data: expect.objectContaining({
          geometry: expect.objectContaining({
            coordinates: [
              [riderCoords.lng, riderCoords.lat],
              [center.lng, center.lat]
            ]
          })
        })
      })
    );
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
