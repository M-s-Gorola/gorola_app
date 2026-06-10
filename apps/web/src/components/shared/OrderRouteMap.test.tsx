import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderRouteMap } from "./OrderRouteMap";

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

describe("OrderRouteMap", () => {
  const buyerCoords = { lat: 30.4500, lng: 78.0700 };
  const riderCoords = { lat: 30.4550, lng: 78.0680 };

  beforeEach(() => {
    leafletMocks.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the leaflet map container region", async () => {
    render(
      <OrderRouteMap
        buyerCoords={buyerCoords}
      />
    );

    expect(
      screen.getByRole("region", { name: /order route map/i })
    ).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });

    expect(leafletMocks.Lmap).toHaveBeenCalled();
  });

  it("places marker for buyer coordinates", async () => {
    render(
      <OrderRouteMap
        buyerCoords={buyerCoords}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    // We expect exactly one call to L.marker (buyer)
    expect(leafletMocks.markerFactory).toHaveBeenCalledTimes(1);
    expect(leafletMocks.markerFactory).toHaveBeenLastCalledWith([buyerCoords.lat, buyerCoords.lng], expect.any(Object));
  });

  it("places marker for rider when riderCoords are provided", async () => {
    render(
      <OrderRouteMap
        buyerCoords={buyerCoords}
        riderCoords={riderCoords}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Buyer, Rider markers
    expect(leafletMocks.markerFactory).toHaveBeenCalledTimes(2);
    expect(leafletMocks.markerFactory).toHaveBeenLastCalledWith([riderCoords.lat, riderCoords.lng], expect.any(Object));
  });
});
