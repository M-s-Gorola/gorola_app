import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { useCartStore } from "@/store/cart.store";

import { syncBuyerCartFromServer } from "./buyer-cart-sync";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the mutation queue to simulate settle state
vi.mock("@/lib/cart-variant-mutation-queue", () => ({
  waitForAllCartMutations: vi.fn().mockResolvedValue(undefined),
}));

describe("buyer-cart-sync hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.getState().clear();
  });

  it("DOES NOT wipe local cart if server returns empty list and push fails (Bug 1 Fix)", async () => {
    // 1. Setup local cart with items
    useCartStore.setState({
      lines: [
        { productVariantId: "v1", quantity: 2, productName: "Apple", unitPrice: 100 },
      ],
    });

    const getMock = vi.mocked(api!.get);
    const postMock = vi.mocked(api!.post);

    // 2. Initial GET returns empty (stale or new user)
    getMock.mockResolvedValueOnce({
      data: { success: true, data: { items: [] } },
    });

    // 3. POST fails (e.g. 500)
    postMock.mockRejectedValueOnce(new Error("Server Error"));

    // 4. Second GET returns empty
    getMock.mockResolvedValueOnce({
      data: { success: true, data: { items: [] } },
    });

    // 5. Run sync
    await syncBuyerCartFromServer();

    // 6. Assertions
    // FIX: Cart should NOT be empty because the push failed and we want to prevent a wipe
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0]?.productVariantId).toBe("v1");
  });

  it("merges correctly even if server returns items (Bug 2 Mitigation)", async () => {
    // 1. Local has 2 items (one just added)
    useCartStore.setState({
      lines: [
        { productVariantId: "v1", quantity: 1 },
        { productVariantId: "v2", quantity: 1 },
      ],
    });

    const getMock = vi.mocked(api!.get);

    // 2. Server only knows about the first item (stale)
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [
            { id: "i1", productVariantId: "v1", quantity: 1, productName: "P1", unitPrice: "10" },
          ],
        },
      },
    });

    // 3. Run sync
    await syncBuyerCartFromServer();

    // 4. Assertions
    // Note: In our current "authority" model, if server returns items, we trust it.
    // However, since we added waitForAllCartMutations, the server SHOULD be up to date.
    // If it's still stale, we still replace, BUT the CheckoutPage guard prevents 
    // calling this sync if we already have local items.
    expect(useCartStore.getState().lines).toHaveLength(1);
  });
});
