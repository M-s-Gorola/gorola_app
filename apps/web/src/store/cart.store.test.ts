import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useCartStore } from "./cart.store";

describe("useCartStore", () => {
  beforeEach(() => {
    act(() => {
      useCartStore.getState().clear();
    });
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useCartStore());
    expect(result.current.lines).toEqual([]);
    expect(result.current.totalItemCount()).toBe(0);
  });

  it("addOrMergeLine merges quantity for same variant", () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addOrMergeLine({
        productVariantId: "v1",
        quantity: 1,
        productName: "Tea"
      });
      result.current.addOrMergeLine({
        productVariantId: "v1",
        quantity: 2,
        productName: "Tea"
      });
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]?.quantity).toBe(3);
    expect(result.current.totalItemCount()).toBe(3);
  });

  it("addOrMergeLine keeps latest optional metadata when merging", () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addOrMergeLine({
        productVariantId: "v1",
        quantity: 1,
        productName: "Tea"
      });
      result.current.addOrMergeLine({
        productVariantId: "v1",
        quantity: 1,
        variantLabel: "500g",
        unitPrice: 120
      });
    });
    expect(result.current.lines[0]).toEqual(
      expect.objectContaining({
        productName: "Tea",
        variantLabel: "500g",
        unitPrice: 120,
        quantity: 2
      })
    );
  });

  it("setQty removes line when quantity is 0", () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addOrMergeLine({ productVariantId: "v1", quantity: 2 });
      result.current.setQty("v1", 0);
    });
    expect(result.current.lines).toEqual([]);
  });

  it("removeLine drops a variant", () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addOrMergeLine({ productVariantId: "v1", quantity: 1 });
      result.current.addOrMergeLine({ productVariantId: "v2", quantity: 1 });
      result.current.removeLine("v1");
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]?.productVariantId).toBe("v2");
  });
});
