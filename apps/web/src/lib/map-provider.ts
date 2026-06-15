export type MapProvider = "leaflet" | "ola";
export type MarkerIconType = "buyer" | "rider";

export interface MapAdapter {
  /** Mount and initialise the map into `container`. */
  init(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number
  ): Promise<void>;
  
  /** Place a named marker on the map. */
  addMarker(coords: { lat: number; lng: number }, icon: MarkerIconType): void;
  
  /** Destroy all map resources (markers, map instance, injected scripts). */
  destroy(): void;
}
