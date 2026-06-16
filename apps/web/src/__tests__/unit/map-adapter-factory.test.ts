/* eslint-disable simple-import-sort/imports */
import { describe, expect, it } from "vitest";

import { createMapAdapter } from "../../lib/map-adapter-factory";
import { LeafletMapAdapter } from "../../lib/adapters/leaflet-map-adapter";
import { OlaMapAdapter } from "../../lib/adapters/ola-map-adapter";
import type { MapProvider } from "../../lib/map-provider";

describe("map-adapter-factory", () => {
  it("returns a LeafletMapAdapter for 'leaflet'", () => {
    const adapter = createMapAdapter("leaflet");
    expect(adapter).toBeInstanceOf(LeafletMapAdapter);
    expect(adapter.init).toBeTypeOf("function");
    expect(adapter.addMarker).toBeTypeOf("function");
    expect(adapter.destroy).toBeTypeOf("function");
  });

  it("returns an OlaMapAdapter for 'ola'", () => {
    const adapter = createMapAdapter("ola");
    expect(adapter).toBeInstanceOf(OlaMapAdapter);
    expect(adapter.init).toBeTypeOf("function");
    expect(adapter.addMarker).toBeTypeOf("function");
    expect(adapter.destroy).toBeTypeOf("function");
  });

  it("throws TypeError for unknown map provider", () => {
    expect(() => createMapAdapter("invalid" as unknown as MapProvider)).toThrow(
      new TypeError("Unknown map provider: invalid")
    );
  });
});
