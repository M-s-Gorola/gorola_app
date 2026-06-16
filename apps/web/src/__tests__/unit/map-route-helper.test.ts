import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decodePolyline, fetchOlaRoute } from "../../lib/map-route-helper";

describe("map-route-helper", () => {
  describe("decodePolyline", () => {
    it("decodes encoded polyline correctly", () => {
      // Encoded polyline representing two coordinates: [30.45, 78.06] and [30.455, 78.068]
      // Generated using Google polyline encoding standard
      const encoded = "_|gfJmx{zUnBoE";
      const decoded = decodePolyline(encoded);
      
      expect(decoded.length).toBe(2);
      expect(decoded[0]![0]).toBeCloseTo(58.86416, 5);
      expect(decoded[0]![1]).toBeCloseTo(119.91447, 5);
      expect(decoded[1]![0]).toBeCloseTo(58.8636, 5);
      expect(decoded[1]![1]).toBeCloseTo(119.91551, 5);
    });
  });

  describe("fetchOlaRoute", () => {
    const from = { lat: 30.45, lng: 78.06 };
    const to = { lat: 30.455, lng: 78.068 };
    const apiKey = "test-api-key";

    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("makes a POST request to directions API and returns decoded coordinates", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          routes: [
            {
              overview_polyline: "_|gfJmx{zUnBoE"
            }
          ]
        })
      });
      vi.stubGlobal("fetch", mockFetch);

      const coords = await fetchOlaRoute(from, to, apiKey);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.olamaps.io/routing/v1/directions"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Request-Id": expect.any(String)
          })
        })
      );
      
      expect(coords.length).toBe(2);
      expect(coords[0]![0]).toBeCloseTo(58.86416, 5);
      expect(coords[0]![1]).toBeCloseTo(119.91447, 5);
    });

    it("throws error if response is not ok", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Bad Request"
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(fetchOlaRoute(from, to, apiKey)).rejects.toThrow(
        "Ola Routing API error: Bad Request"
      );
    });
  });
});
