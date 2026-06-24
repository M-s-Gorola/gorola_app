import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBuyerLocation } from "./useBuyerLocation";

const mockFetch = vi.fn();

describe("useBuyerLocation hook", () => {
  let getCurrentPositionSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("VITE_OLA_MAPS_API_KEY", "test-api-key");
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();

    getCurrentPositionSpy = vi.fn();

    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: getCurrentPositionSpy,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("should transitions isLoading true -> false, calls reverse-geocode API, and constructs locality label on success", async () => {
    getCurrentPositionSpy.mockImplementation((success) => {
      success({
        coords: {
          latitude: 30.4593,
          longitude: 78.0677,
          accuracy: 0,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            address_components: [
              { long_name: "Kulri", types: ["sublocality"] },
              { long_name: "Mussoorie", types: ["locality"] },
            ],
          },
        ],
      }),
    });

    const { result } = renderHook(() => useBuyerLocation());

    await act(async () => {
      await Promise.resolve();
    });

    expect(getCurrentPositionSpy).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalled();
    const fetchUrl = mockFetch.mock.calls[0]![0] as string;
    expect(fetchUrl).toContain("https://api.olamaps.io/places/v1/reverse-geocode");

    expect(result.current.isLoading).toBe(false);
    expect(result.current.locationLabel).toBe("Kulri, Mussoorie");
    expect(result.current.coords).toEqual({ lat: 30.4593, lng: 78.0677 });
    expect(result.current.error).toBeNull();
  });

  it("should fallback to Mussoorie and set error to PERMISSION_DENIED when permission is denied", async () => {
    getCurrentPositionSpy.mockImplementation((_success, error) => {
      error({
        code: 1, // PERMISSION_DENIED
        message: "User denied Geolocation",
      });
    });

    const { result } = renderHook(() => useBuyerLocation());

    await act(async () => {
      await Promise.resolve();
    });

    expect(getCurrentPositionSpy).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.locationLabel).toBe("Mussoorie");
    expect(result.current.coords).toBeNull();
    expect(result.current.error).toBe("PERMISSION_DENIED");
  });

  it("should fallback to Mussoorie and set error to POSITION_UNAVAILABLE when position is unavailable", async () => {
    getCurrentPositionSpy.mockImplementation((_success, error) => {
      error({
        code: 2, // POSITION_UNAVAILABLE
        message: "Position unavailable",
      });
    });

    const { result } = renderHook(() => useBuyerLocation());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("POSITION_UNAVAILABLE");
  });

  it("should fallback to Mussoorie and set error to TIMEOUT when request times out", async () => {
    getCurrentPositionSpy.mockImplementation((_success, error) => {
      error({
        code: 3, // TIMEOUT
        message: "Request timed out",
      });
    });

    const { result } = renderHook(() => useBuyerLocation());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("TIMEOUT");
  });

  it("should set error to GEOCODE_ERROR and fallback to Mussoorie when API network fails", async () => {
    getCurrentPositionSpy.mockImplementation((success) => {
      success({
        coords: {
          latitude: 30.4593,
          longitude: 78.0677,
        },
      });
    });

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useBuyerLocation());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.locationLabel).toBe("Mussoorie");
    expect(result.current.error).toBe("GEOCODE_ERROR");
  });

  it("should re-trigger geolocation call when refetch is called", async () => {
    getCurrentPositionSpy.mockImplementation((success) => {
      success({
        coords: {
          latitude: 30.4593,
          longitude: 78.0677,
        },
      });
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            address_components: [{ long_name: "Kulri", types: ["sublocality"] }],
          },
        ],
      }),
    });

    const { result } = renderHook(() => useBuyerLocation());

    await act(async () => {
      await Promise.resolve();
    });

    expect(getCurrentPositionSpy).toHaveBeenCalledTimes(1);

    // Call refetch
    await act(async () => {
      result.current.refetch();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getCurrentPositionSpy).toHaveBeenCalledTimes(2);
  });
});
