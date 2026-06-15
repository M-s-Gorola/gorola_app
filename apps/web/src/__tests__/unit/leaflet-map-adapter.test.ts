import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeafletMapAdapter } from "../../lib/adapters/leaflet-map-adapter";

const leafletMocks = vi.hoisted(() => {
  const api = {
    TileLayerMock: vi.fn(() => ({
      addTo: vi.fn()
    })),
    Lmap: vi.fn(),
    mergeOptionsSpy: vi.fn(),
    mockMapRemove: vi.fn(),
    markerFactory: vi.fn(),
    reset() {
      api.mockMapRemove.mockClear();
      api.Lmap.mockClear();
      api.markerFactory.mockClear();
      api.mergeOptionsSpy.mockClear();
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
    remove: vi.fn()
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
    tileLayer: leafletMocks.TileLayerMock
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes Leaflet map and tile layer", async () => {
    await adapter.init(container, buyerCoords, 14);

    expect(leafletMocks.Lmap).toHaveBeenCalledWith(container, expect.any(Object));
    expect(leafletMocks.TileLayerMock).toHaveBeenCalledWith(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      expect.any(Object)
    );
  });

  it("places buyer marker on the map", async () => {
    await adapter.init(container, buyerCoords, 14);
    adapter.addMarker(buyerCoords, "buyer");

    expect(leafletMocks.markerFactory).toHaveBeenCalledWith(
      [buyerCoords.lat, buyerCoords.lng],
      expect.any(Object)
    );
  });

  it("places rider marker on the map", async () => {
    await adapter.init(container, buyerCoords, 14);
    adapter.addMarker(riderCoords, "rider");

    expect(leafletMocks.markerFactory).toHaveBeenCalledWith(
      [riderCoords.lat, riderCoords.lng],
      expect.any(Object)
    );
  });

  it("destroys map instance and cleans up event listeners", async () => {
    await adapter.init(container, buyerCoords, 14);
    adapter.destroy();

    expect(leafletMocks.mockMapRemove).toHaveBeenCalled();
  });
});
