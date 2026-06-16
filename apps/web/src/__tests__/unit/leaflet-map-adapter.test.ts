import L from "leaflet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeafletMapAdapter } from "../../lib/adapters/leaflet-map-adapter";
import { fetchOlaRoute } from "../../lib/map-route-helper";

// Mock the route helper module
vi.mock("../../lib/map-route-helper", () => ({
  fetchOlaRoute: vi.fn().mockResolvedValue([
    [30.455, 78.068],
    [30.452, 78.064],
    [30.45, 78.06]
  ])
}));

const mockMarkerElement = {
  style: {
    filter: ""
  }
};

const leafletMocks = vi.hoisted(() => {
  const api = {
    TileLayerMock: vi.fn(() => ({
      addTo: vi.fn()
    })),
    Lmap: vi.fn(),
    mergeOptionsSpy: vi.fn(),
    mockMapRemove: vi.fn(),
    markerFactory: vi.fn(),
    polylineFactory: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn()
    })),
    reset() {
      api.mockMapRemove.mockClear();
      api.Lmap.mockClear();
      api.markerFactory.mockClear();
      api.mergeOptionsSpy.mockClear();
      api.polylineFactory.mockClear();
      mockMarkerElement.style.filter = "";
    }
  };

  api.Lmap.mockImplementation(() => ({
    off: vi.fn(),
    on: vi.fn(),
    remove: api.mockMapRemove,
    setView: vi.fn(function (this: unknown) {
      return this;
    }),
    fitBounds: vi.fn(function (this: unknown) {
      return this;
    })
  }));

  api.markerFactory.mockImplementation(() => ({
    addTo: vi.fn().mockReturnThis(),
    getLatLng: vi.fn(() => ({ lat: 30.454, lng: 78.066 })),
    off: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
    getElement: vi.fn(() => mockMarkerElement)
  }));

  return api;
});

vi.mock("leaflet", () => ({
  default: {
    Icon: {
      Default: {
        mergeOptions: leafletMocks.mergeOptionsSpy
      }
    },
    icon: vi.fn(() => ({ options: {} })),
    divIcon: vi.fn(() => ({ options: {} })),
    map: leafletMocks.Lmap,
    marker: leafletMocks.markerFactory,
    Marker: {
      prototype: {
        options: {
          icon: null
        }
      }
    },
    tileLayer: leafletMocks.TileLayerMock,
    polyline: leafletMocks.polylineFactory
  }
}));

describe("LeafletMapAdapter", () => {
  let container: HTMLDivElement;
  let adapter: LeafletMapAdapter;
  const buyerCoords = { lat: 30.45, lng: 78.06 };
  const riderCoords = { lat: 30.455, lng: 78.068 };

  beforeEach(() => {
    container = document.createElement("div");
    adapter = new LeafletMapAdapter();
    leafletMocks.reset();
    vi.clearAllMocks();
    vi.stubEnv("VITE_OLA_MAPS_API_KEY", "mock-api-key");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("initializes Leaflet map and tile layer", async () => {
    await adapter.init(container, buyerCoords, 14);

    expect(leafletMocks.Lmap).toHaveBeenCalledWith(container, expect.any(Object));
    expect(leafletMocks.TileLayerMock).toHaveBeenCalledWith(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      expect.any(Object)
    );
  });

  it("places buyer marker on the map with saturated filter styling", async () => {
    await adapter.init(container, buyerCoords, 14);
    adapter.addMarker(buyerCoords, "buyer");

    expect(leafletMocks.markerFactory).toHaveBeenCalledWith(
      [buyerCoords.lat, buyerCoords.lng],
      expect.any(Object)
    );
    expect(vi.mocked(L.icon)).toHaveBeenCalledWith(
      expect.objectContaining({
        iconUrl: "/buyer.png",
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      })
    );
    expect(mockMarkerElement.style.filter).toContain("saturate(2)");
    expect(mockMarkerElement.style.filter).toContain("contrast(1.2)");
  });

  it("places rider marker on the map with saturated filter styling", async () => {
    await adapter.init(container, buyerCoords, 14);
    adapter.addMarker(riderCoords, "rider");

    expect(leafletMocks.markerFactory).toHaveBeenCalledWith(
      [riderCoords.lat, riderCoords.lng],
      expect.any(Object)
    );
    expect(vi.mocked(L.icon)).toHaveBeenCalledWith(
      expect.objectContaining({
        iconUrl: "/rider.png",
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      })
    );
    expect(mockMarkerElement.style.filter).toContain("saturate(2)");
    expect(mockMarkerElement.style.filter).toContain("contrast(1.2)");
  });

  it("fetches and draws the road route when both buyer and rider markers are added", async () => {
    await adapter.init(container, buyerCoords, 14);
    adapter.addMarker(buyerCoords, "buyer");
    adapter.addMarker(riderCoords, "rider");

    // Wait for async _drawRoute to finish
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchOlaRoute).toHaveBeenCalledWith(riderCoords, buyerCoords, "mock-api-key");
    expect(leafletMocks.polylineFactory).toHaveBeenCalledWith(
      [
        [30.455, 78.068],
        [30.452, 78.064],
        [30.45, 78.06]
      ],
      expect.objectContaining({
        color: "#1d3d2f",
        weight: 4
      })
    );

    adapter.destroy();
    const mockPolylineInstance = leafletMocks.polylineFactory.mock.results[0]!.value;
    expect(mockPolylineInstance.remove).toHaveBeenCalled();
  });

  it("falls back to straight line route when directions API fails", async () => {
    vi.mocked(fetchOlaRoute).mockRejectedValueOnce(new Error("API Error"));

    await adapter.init(container, buyerCoords, 14);
    adapter.addMarker(buyerCoords, "buyer");
    adapter.addMarker(riderCoords, "rider");

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(leafletMocks.polylineFactory).toHaveBeenCalledWith(
      [
        [riderCoords.lat, riderCoords.lng],
        [buyerCoords.lat, buyerCoords.lng]
      ],
      expect.any(Object)
    );
  });

  it("destroys map instance and cleans up event listeners", async () => {
    await adapter.init(container, buyerCoords, 14);
    adapter.destroy();

    expect(leafletMocks.mockMapRemove).toHaveBeenCalled();
  });
});
