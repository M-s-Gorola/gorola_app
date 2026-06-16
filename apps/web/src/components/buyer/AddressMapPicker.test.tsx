import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddressMapPicker } from "./AddressMapPicker";

const leafletMocks = vi.hoisted(() => {
  const api = {
    TileLayerMock: vi.fn(() => ({
      addTo: vi.fn()
    })),
    dragHold: [] as Array<() => void>,
    Lmap: vi.fn(),
    mergeOptionsSpy: vi.fn(),
    mockMapRemove: vi.fn(),
    markerFactory: vi.fn(),
    reset() {
      api.dragHold.length = 0;
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
    })
  }));

  api.markerFactory.mockImplementation(() => ({
    addTo: vi.fn().mockReturnThis(),
    getLatLng: vi.fn(() => ({ lat: 30.454, lng: 78.066 })),
    off: vi.fn(),
    on(ev: string, fn: () => void) {
      if (ev === "dragend") {
        api.dragHold.push(fn);
      }
    },
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

describe("AddressMapPicker", () => {
  beforeEach(() => {
    leafletMocks.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates leaflet map container with labelled region", async () => {
    const onChange = vi.fn();
    render(
      <AddressMapPicker
        center={{ lat: 30.454, lng: 78.066 }}
        onCoordinatesChange={onChange}
      />
    );
    expect(
      screen.getByRole("region", { name: /delivery location map/i })
    ).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(leafletMocks.Lmap).toHaveBeenCalled();
  });

  it("fires onCoordinatesChange after dragend with marker coords", async () => {
    const onChange = vi.fn();
    render(
      <AddressMapPicker
        center={{ lat: 30.454, lng: 78.066 }}
        onCoordinatesChange={onChange}
      />
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      const fn = leafletMocks.dragHold[0];
      if (typeof fn === "function") {
        fn();
      }
    });
    expect(onChange).toHaveBeenCalledWith({ lat: 30.454, lng: 78.066 });
  });

  it("removes leaflet map instance on unmount", async () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <AddressMapPicker
        center={{ lat: 30.454, lng: 78.066 }}
        onCoordinatesChange={onChange}
      />
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      unmount();
    });
    expect(leafletMocks.mockMapRemove).toHaveBeenCalled();
  });

  it("prevents default behavior on wheel events inside map picker to block page scrolling", async () => {
    const onChange = vi.fn();
    render(
      <AddressMapPicker
        center={{ lat: 30.454, lng: 78.066 }}
        onCoordinatesChange={onChange}
      />
    );
    await act(async () => {
      await Promise.resolve();
    });

    const container = screen.getByRole("region", { name: /delivery location map/i });
    const wheelEvent = new WheelEvent("wheel", { bubbles: true, cancelable: true });

    const preventDefaultSpy = vi.spyOn(wheelEvent, "preventDefault");
    container.dispatchEvent(wheelEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
