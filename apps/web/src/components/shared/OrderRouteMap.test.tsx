import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMapAdapter } from "../../lib/map-adapter-factory";
import { OrderRouteMap } from "./OrderRouteMap";

const mockAdapterInstance = {
  init: vi.fn().mockResolvedValue(undefined),
  addMarker: vi.fn(),
  destroy: vi.fn()
};

vi.mock("../../lib/map-adapter-factory", () => ({
  createMapAdapter: vi.fn(() => mockAdapterInstance)
}));

describe("OrderRouteMap", () => {
  const buyerCoords = { lat: 30.4500, lng: 78.0700 };
  const riderCoords = { lat: 30.4550, lng: 78.0680 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the map container region and calls createMapAdapter", async () => {
    render(<OrderRouteMap buyerCoords={buyerCoords} />);

    expect(
      screen.getByRole("region", { name: /order route map/i })
    ).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });

    expect(createMapAdapter).toHaveBeenCalled();
    expect(mockAdapterInstance.init).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      buyerCoords,
      14
    );
  });

  it("places marker for buyer coordinates only", async () => {
    render(<OrderRouteMap buyerCoords={buyerCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAdapterInstance.addMarker).toHaveBeenCalledTimes(1);
    expect(mockAdapterInstance.addMarker).toHaveBeenCalledWith(buyerCoords, "buyer");
  });

  it("places marker for buyer and rider when riderCoords are provided", async () => {
    render(<OrderRouteMap buyerCoords={buyerCoords} riderCoords={riderCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAdapterInstance.addMarker).toHaveBeenCalledTimes(2);
    expect(mockAdapterInstance.addMarker).toHaveBeenCalledWith(buyerCoords, "buyer");
    expect(mockAdapterInstance.addMarker).toHaveBeenCalledWith(riderCoords, "rider");
  });

  it("destroys map instance on unmount", async () => {
    const { unmount } = render(<OrderRouteMap buyerCoords={buyerCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(mockAdapterInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys old map and initializes new map when coordinates change", async () => {
    const { rerender } = render(<OrderRouteMap buyerCoords={buyerCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    const newRiderCoords = { lat: 30.4560, lng: 78.0690 };
    rerender(<OrderRouteMap buyerCoords={buyerCoords} riderCoords={newRiderCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAdapterInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockAdapterInstance.init).toHaveBeenCalledTimes(2);
  });
});
