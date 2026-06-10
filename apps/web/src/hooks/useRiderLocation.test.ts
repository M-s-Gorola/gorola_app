import { act,renderHook } from "@testing-library/react";
import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { useRiderLocation } from "./useRiderLocation";

vi.mock("@/lib/api", () => ({
  api: {
    put: vi.fn()
  }
}));

describe("useRiderLocation hook", () => {
  let watchPositionSpy: ReturnType<typeof vi.fn>;
  let clearWatchSpy: ReturnType<typeof vi.fn>;
  let successCb: (position: Partial<GeolocationPosition>) => void;
  let errorCb: (error: Partial<GeolocationPositionError>) => void;

  beforeEach(() => {
    vi.resetAllMocks();

    watchPositionSpy = vi.fn((success, error) => {
      successCb = success;
      errorCb = error;
      return 12345; // watch ID
    });

    clearWatchSpy = vi.fn();

    // Mock navigator.geolocation
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: watchPositionSpy,
        clearWatch: clearWatchSpy
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should not watch position on mount if activeOrderId is not provided", () => {
    renderHook(() => useRiderLocation(undefined));
    expect(watchPositionSpy).not.toHaveBeenCalled();
  });

  it("should watch position on mount if activeOrderId is provided and clear watch on unmount", () => {
    const { unmount } = renderHook(() => useRiderLocation("order-1"));
    expect(watchPositionSpy).toHaveBeenCalled();
    expect(clearWatchSpy).not.toHaveBeenCalled();

    unmount();
    expect(clearWatchSpy).toHaveBeenCalledWith(12345);
  });

  it("should call api.put on watchPosition coordinates update", async () => {
    vi.mocked(api!.put).mockResolvedValue({ data: { success: true } });

    renderHook(() => useRiderLocation("order-1"));

    // Simulate coordinates change callback
    await act(async () => {
      successCb({
        coords: {
          latitude: 30.4593,
          longitude: 78.0677,
          accuracy: 0,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now()
      } as GeolocationPosition);
    });

    expect(api!.put).toHaveBeenCalledWith("/api/v1/rider/location", {
      lat: 30.4593,
      lng: 78.0677,
      orderId: "order-1"
    });
  });

  it("should handle geolocation permission denied and set error status", async () => {
    const { result } = renderHook(() => useRiderLocation("order-1"));

    await act(async () => {
      errorCb({
        code: 1, // PERMISSION_DENIED
        message: "User denied Geolocation"
      });
    });

    expect(result.current.error).toBe("LOCATION_DENIED");
  });
});
