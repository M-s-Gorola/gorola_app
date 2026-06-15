import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BuyerLayout } from "@/components/buyer/BuyerLayout";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock
  },
  getFeatureFlag: vi.fn().mockResolvedValue(false)
}));

describe("BuyerCartHydration", () => {
  beforeEach(() => {
    getMock.mockReset();
    useCartStore.setState({ lines: [], isOpen: false });
    useAuthStore.setState({
      accessToken: "at",
      isBootstrapPending: false,
      name: null,
      phone: "+919900000000",
      refreshToken: "rt",
      role: "BUYER",
      userId: "u1"
    });
  });

  it("replaces local cart lines from GET /api/v1/cart", async () => {
    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/cart") {
        return Promise.resolve({
          data: {
            data: {
              items: [
                {
                  productName: "Alpha",
                  productVariantId: "v1",
                  quantity: 2,
                  unitPrice: "10.00",
                  variantLabel: "L",
                  variantUnit: "u"
                },
                {
                  productName: "Beta",
                  productVariantId: "v2",
                  quantity: 1,
                  unitPrice: "5",
                  variantLabel: "M",
                  variantUnit: "kg"
                }
              ]
            },
            success: true
          }
        });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    useCartStore.setState({
      lines: [{ productVariantId: "stale", quantity: 9 }],
      isOpen: false
    });

    render(
      <MemoryRouter>
        <BuyerLayout>
          <p>Page</p>
        </BuyerLayout>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(useCartStore.getState().lines).toHaveLength(2);
    });
    expect(useCartStore.getState().lines[0]?.productVariantId).toBe("v1");
    expect(useCartStore.getState().lines[1]?.productName).toBe("Beta");
  });
});
