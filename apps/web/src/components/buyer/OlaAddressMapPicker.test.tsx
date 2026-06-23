import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OlaAddressMapPicker } from "./OlaAddressMapPicker";

// Set up globals and mocks for fetch and OlaMaps
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockMapInstance = {
  remove: vi.fn(),
  setCenter: vi.fn(),
  setZoom: vi.fn(),
  resize: vi.fn(),
  on: vi.fn()
};

const mockMarkerInstance = {
  setLngLat: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
  on: vi.fn()
};

const mockInit = vi.fn(() => mockMapInstance);
const mockOlaMapsInit = vi.fn().mockImplementation(function (this: { init: unknown }) {
  this.init = mockInit;
});
const mockMarkerConstructor = vi.fn().mockImplementation(function (this: unknown) {
  return mockMarkerInstance;
});

const mockOlaMaps = Object.assign(mockOlaMapsInit, {
  Marker: mockMarkerConstructor
}) as unknown as NonNullable<typeof window.OlaMaps>;

describe("OlaAddressMapPicker", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_OLA_MAPS_API_KEY", "test-api-key");
    vi.useFakeTimers();
    mockFetch.mockReset();
    mockMapInstance.remove.mockClear();
    mockMapInstance.setCenter.mockClear();
    mockMapInstance.setZoom.mockClear();
    mockMapInstance.resize.mockClear();
    mockMapInstance.on.mockClear();
    mockMarkerInstance.setLngLat.mockClear();
    mockMarkerInstance.addTo.mockClear();
    mockMarkerInstance.remove.mockClear();
    mockInit.mockClear();
    vi.mocked(mockOlaMapsInit).mockClear();
    vi.mocked(mockMarkerConstructor).mockClear();
    window.OlaMaps = mockOlaMaps;

    // Mock document.querySelector for script tracking
    vi.spyOn(document, "querySelector").mockReturnValue(null);
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLScriptElement && node.src.includes("olamaps-web-sdk")) {
        if (node.onload) {
          (node.onload as (ev: Event) => void)(new Event("load"));
        }
      }
      return node;
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete window.OlaMaps;
  });

  it("renders a search input and a map container", () => {
    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );
    expect(screen.getByTestId("location-search-input")).toBeInTheDocument();
    expect(screen.getByLabelText("Delivery location map")).toBeInTheDocument();
  });

  it("calls onCoordinatesChange on mount with the default center", () => {
    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );
    expect(onCoordinatesChange).toHaveBeenCalledWith({ lat: 30.4598, lng: 78.0664 });
  });

  it("calls autocomplete fetch API when user types in search input", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ predictions: [] })
    });

    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );

    const input = screen.getByTestId("location-search-input");
    fireEvent.change(input, { target: { value: "hotel pad" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockFetch).toHaveBeenCalled();
    const firstCallUrl = mockFetch.mock.calls[0]![0] as string;
    expect(firstCallUrl).toContain("https://api.olamaps.io/places/v1/autocomplete");
    expect(firstCallUrl).toContain("input=hotel%20pad");
  });

  it("renders suggestion dropdown list when autocomplete returns results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        predictions: [
          { description: "Hotel Padmini, Mussoorie", place_id: "abc123" }
        ]
      })
    });

    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );

    const input = screen.getByTestId("location-search-input");
    fireEvent.change(input, { target: { value: "hotel pad" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const suggestion = screen.getByTestId("suggestion-0");
    expect(suggestion).toHaveTextContent("Hotel Padmini, Mussoorie");
  });

  it("calls geocode fetch API on suggestion click and triggers onCoordinatesChange", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [
            { description: "Hotel Padmini, Mussoorie", place_id: "abc123" }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            geometry: {
              location: { lat: 30.4610, lng: 78.0690 }
            }
          }
        })
      });

    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );

    const input = screen.getByTestId("location-search-input");
    fireEvent.change(input, { target: { value: "hotel pad" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const suggestion = screen.getByTestId("suggestion-0");
    
    await act(async () => {
      fireEvent.click(suggestion);
    });

    // Flush geocode promise & React updates
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const lastCallUrl = mockFetch.mock.calls[1]![0] as string;
    expect(lastCallUrl).toContain("https://api.olamaps.io/places/v1/details");
    expect(lastCallUrl).toContain("place_id=abc123");

    expect(onCoordinatesChange).toHaveBeenLastCalledWith({
      lat: 30.4610,
      lng: 78.0690
    });

    expect(input).toHaveValue("Hotel Padmini, Mussoorie");
    expect(screen.queryByTestId("suggestion-0")).not.toBeInTheDocument();
  });

  it("renders map key missing error if VITE_OLA_MAPS_API_KEY is not set", () => {
    vi.stubEnv("VITE_OLA_MAPS_API_KEY", "");
    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );
    expect(screen.getByTestId("map-api-key-missing")).toBeInTheDocument();
    expect(screen.getByTestId("map-api-key-missing")).toHaveTextContent("Map could not be loaded — API key missing");
  });

  it("handles details API response without result wrapper", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [
            { description: "Hotel Padmini, Mussoorie", place_id: "abc123" }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          geometry: {
            location: { lat: 30.4610, lng: 78.0690 }
          }
        })
      });

    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );

    const input = screen.getByTestId("location-search-input");
    fireEvent.change(input, { target: { value: "hotel pad" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const suggestion = screen.getByTestId("suggestion-0");
    await act(async () => {
      fireEvent.click(suggestion);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(onCoordinatesChange).toHaveBeenLastCalledWith({
      lat: 30.4610,
      lng: 78.0690
    });

    expect(input).toHaveValue("Hotel Padmini, Mussoorie");
  });

  it("updates map and marker when center prop changes significantly", async () => {
    const onCoordinatesChange = vi.fn();
    const { rerender } = render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );

    // Flush map initialization promises
    await act(async () => {
      await Promise.resolve();
    });

    // Initial center is set on marker creation
    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledWith([78.0664, 30.4598]);
    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledTimes(1);

    // Rerender with a new center prop
    await act(async () => {
      rerender(
        <OlaAddressMapPicker
          center={{ lat: 30.5000, lng: 78.1000 }}
          onCoordinatesChange={onCoordinatesChange}
        />
      );
    });

    expect(mockMapInstance.setCenter).toHaveBeenCalledWith([78.1000, 30.5000]);
    expect(mockMarkerInstance.setLngLat).toHaveBeenLastCalledWith([78.1000, 30.5000]);
    expect(mockMarkerInstance.setLngLat).toHaveBeenCalledTimes(2);
  });

  it("prevents default behavior on wheel events when hovered", async () => {
    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );

    const mapContainer = screen.getByLabelText("Delivery location map");

    // Simulate mouseenter to hover
    fireEvent.mouseEnter(mapContainer);

    const wheelEvent = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(wheelEvent, "preventDefault");
    const stopPropagationSpy = vi.spyOn(wheelEvent, "stopPropagation");

    mapContainer.dispatchEvent(wheelEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it("initializes Ola Maps with attributionControl: false", async () => {
    const onCoordinatesChange = vi.fn();
    render(
      <OlaAddressMapPicker
        center={{ lat: 30.4598, lng: 78.0664 }}
        onCoordinatesChange={onCoordinatesChange}
      />
    );
    // Flush map initialization promises
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        attributionControl: true
      })
    );
  });
});
