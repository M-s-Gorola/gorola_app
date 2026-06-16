import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMapAdapter } from "../../lib/map-adapter-factory";
import { OrderRouteMap } from "./OrderRouteMap";

const mockAdapterInstance = {
  init: vi.fn().mockResolvedValue(undefined),
  addMarker: vi.fn(),
  destroy: vi.fn(),
  enableScrollZoom: vi.fn(),
  disableScrollZoom: vi.fn(),
  setRouteStatusCallback: vi.fn()
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

    const newBuyerCoords = { lat: 30.4510, lng: 78.0710 };
    rerender(<OrderRouteMap buyerCoords={newBuyerCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAdapterInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockAdapterInstance.init).toHaveBeenCalledTimes(2);
  });

  it("updates existing marker without recreating map when only riderCoords change", async () => {
    const { rerender } = render(<OrderRouteMap buyerCoords={buyerCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    const newRiderCoords = { lat: 30.4560, lng: 78.0690 };
    rerender(<OrderRouteMap buyerCoords={buyerCoords} riderCoords={newRiderCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAdapterInstance.destroy).not.toHaveBeenCalled();
    expect(mockAdapterInstance.init).toHaveBeenCalledTimes(1);
    expect(mockAdapterInstance.addMarker).toHaveBeenCalledWith(newRiderCoords, "rider");
  });

  it("allows page scroll (no preventDefault) before mouseenter and after mouseleave, but prevents it when mouse is over container", async () => {
    render(<OrderRouteMap buyerCoords={buyerCoords} />);
    
    const container = screen.getByRole("region", { name: /order route map/i });
    
    // 1. Before mouseenter, wheel should not call preventDefault
    const wheelEventBefore = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    const preventDefaultSpyBefore = vi.spyOn(wheelEventBefore, "preventDefault");
    container.dispatchEvent(wheelEventBefore);
    expect(preventDefaultSpyBefore).not.toHaveBeenCalled();
    expect(mockAdapterInstance.enableScrollZoom).not.toHaveBeenCalled();

    // 2. Dispatch mouseenter: should call enableScrollZoom
    act(() => {
      container.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });
    expect(mockAdapterInstance.enableScrollZoom).toHaveBeenCalledTimes(1);

    // 3. During hover, wheel event should call preventDefault
    const wheelEventDuring = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    const preventDefaultSpyDuring = vi.spyOn(wheelEventDuring, "preventDefault");
    container.dispatchEvent(wheelEventDuring);
    expect(preventDefaultSpyDuring).toHaveBeenCalled();

    // 4. Dispatch mouseleave: should call disableScrollZoom
    act(() => {
      container.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    });
    expect(mockAdapterInstance.disableScrollZoom).toHaveBeenCalledTimes(1);

    // 5. After mouseleave, wheel should not call preventDefault
    const wheelEventAfter = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    const preventDefaultSpyAfter = vi.spyOn(wheelEventAfter, "preventDefault");
    container.dispatchEvent(wheelEventAfter);
    expect(preventDefaultSpyAfter).not.toHaveBeenCalled();
  });

  it("renders calculating note while routing is in-flight, and hides it when done", async () => {
    let cb: (calculating: boolean) => void = () => {};
    mockAdapterInstance.setRouteStatusCallback.mockImplementationOnce((callback) => {
      cb = callback;
    });

    render(<OrderRouteMap buyerCoords={buyerCoords} riderCoords={riderCoords} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAdapterInstance.setRouteStatusCallback).toHaveBeenCalled();

    // Trigger callback with true
    act(() => {
      cb(true);
    });
    expect(screen.getByTestId("route-calculating-note")).toBeInTheDocument();
    expect(screen.getByTestId("route-calculating-note")).toHaveTextContent("Calculating route…");

    // Trigger callback with false
    act(() => {
      cb(false);
    });
    expect(screen.queryByTestId("route-calculating-note")).not.toBeInTheDocument();
  });
});
