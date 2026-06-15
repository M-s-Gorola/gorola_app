/* eslint-disable simple-import-sort/imports */
import type { MapAdapter, MapProvider } from "./map-provider";
import { LeafletMapAdapter } from "./adapters/leaflet-map-adapter";
import { OlaMapAdapter } from "./adapters/ola-map-adapter";

export function createMapAdapter(provider: MapProvider): MapAdapter {
  switch (provider) {
    case "leaflet":
      return new LeafletMapAdapter();
    case "ola":
      return new OlaMapAdapter();
    default:
      throw new TypeError(`Unknown map provider: ${provider as string}`);
  }
}
