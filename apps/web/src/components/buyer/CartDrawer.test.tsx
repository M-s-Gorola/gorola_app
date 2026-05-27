import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BuyerLayout } from "@/components/buyer/BuyerLayout";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useFeatureFlagsStore } from "@/store/feature-flags.store";

const { postMock, putMock, deleteMock, syncCartMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  syncCartMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/lib/buyer-cart-sync", () => ({
  syncBuyerCartFromServer: syncCartMock
}));

vi.mock("@/lib/api", () => ({
  api: {
    delete: deleteMock,
    post: postMock,
    put: putMock
  }
}));

describe("CartDrawer", () => {
  beforeEach(() => {
    syncCartMock.mockReset();
    syncCartMock.mockResolvedValue(undefined);
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    useCartStore.setState({
      lines: [],
      isOpen: false
    });
    useAuthStore.setState({
      accessToken: "access",
      name: "Buyer",
      phone: "+919999999999",
      refreshToken: "refresh",
      role: "BUYER",
      userId: "buyer-u1"
    });
    useFeatureFlagsStore.getState().reset();
  });

  function renderShell(): void {
    render(
      <MemoryRouter>
        <BuyerLayout>
          <p>Page</p>
        </BuyerLayout>
      </MemoryRouter>
    );
  }

  it("opens from nav cart button and shows empty state", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Cart" }));
    expect(await screen.findByText("Your cart is empty - go find something good")).toBeInTheDocument();
  });

  it("renders cart items and subtotal/total", async () => {
    useCartStore.setState({
      lines: [
        {
          productVariantId: "v1",
          quantity: 2,
          productName: "Apple",
          variantLabel: "1kg",
          unitPrice: 120
        }
      ],
      isOpen: true
    });

    renderShell();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("1kg")).toBeInTheDocument();
    // Price appears twice: line item subtotal and cart subtotal
    expect(screen.getAllByText("Rs 240.00")).toHaveLength(2);
    expect(screen.getByText("Rs 30.00")).toBeInTheDocument();
    expect(screen.getByText("Rs 270.00")).toBeInTheDocument();
  });

  it("updates quantity with +/- controls and calls cart API", async () => {
    useCartStore.setState({
      lines: [
        {
          productVariantId: "v1",
          quantity: 1,
          productName: "Apple",
          variantLabel: "1kg",
          unitPrice: 120
        }
      ],
      isOpen: true
    });
    putMock.mockResolvedValue({ data: { success: true } });

    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Increase Apple quantity" }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/cart/items/v1", expect.objectContaining({ quantity: 2 }));
    });
  });

  it("syncs qty mutation when userId is null but access token exists", async () => {
    useAuthStore.setState({
      accessToken: "at-only",
      name: null,
      phone: null,
      refreshToken: "rt-only",
      role: "BUYER",
      userId: null
    });
    useCartStore.setState({
      lines: [
        {
          productVariantId: "v1",
          quantity: 1,
          productName: "Apple",
          variantLabel: "1kg",
          unitPrice: 120
        }
      ],
      isOpen: true
    });
    putMock.mockResolvedValue({ data: { success: true } });

    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Increase Apple quantity" }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/cart/items/v1", expect.objectContaining({ quantity: 2 }));
    });
  });

  it("supports payment method selection with COD preselected", () => {
    useFeatureFlagsStore.getState().setFlag("PAYMENT_UPI_ENABLED", true);
    useFeatureFlagsStore.getState().setFlag("PAYMENT_CARD_ENABLED", true);
    useCartStore.setState({ isOpen: true });
    renderShell();
    const cod = screen.getByRole("radio", { name: "Cash on Delivery" });
    const upi = screen.getByRole("radio", { name: "UPI" });
    const card = screen.getByRole("radio", { name: "Card" });
    expect(cod).toBeChecked();
    fireEvent.click(upi);
    expect(upi).toBeChecked();
    fireEvent.click(card);
    expect(card).toBeChecked();
  });

  it("keeps UPI/Card disabled when feature flags are off", () => {
    useCartStore.setState({ isOpen: true });
    renderShell();
    expect(screen.getByRole("radio", { name: "UPI" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Card" })).toBeDisabled();
  });

  it("applies discount code via API", async () => {
    useCartStore.setState({
      lines: [
        {
          productVariantId: "v1",
          quantity: 1,
          productName: "Apple",
          variantLabel: "1kg",
          unitPrice: 120
        }
      ],
      isOpen: true
    });
    postMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          amountSaved: 20
        }
      }
    });

    renderShell();
    fireEvent.change(screen.getByPlaceholderText("Discount code"), { target: { value: "SAVE20" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/api/v1/promotions/discounts/validate",
        expect.objectContaining({ code: "SAVE20" })
      );
    });
    expect(screen.getByTestId("cart-discount-summary")).toBeInTheDocument();
    expect(screen.getByTestId("cart-discount-summary")).toHaveTextContent("Total Discount");
    expect(screen.getByTestId("cart-discount-summary")).toHaveTextContent("-Rs 20.00");

    const chevron = screen.getByTestId("cart-discount-toggle-chevron");
    fireEvent.click(chevron);
    const breakdownItem = await screen.findByTestId("cart-discount-breakdown-item");
    expect(breakdownItem).toBeInTheDocument();
    expect(breakdownItem.textContent).toContain("SAVE20");
    expect(breakdownItem.textContent).toContain("-Rs 20.00");
  });

  it("shows discount error when code is invalid or expired", async () => {
    useCartStore.setState({
      lines: [
        {
          productVariantId: "v1",
          quantity: 1,
          productName: "Apple",
          variantLabel: "1kg",
          unitPrice: 120
        }
      ],
      isOpen: true
    });
    postMock.mockResolvedValue({
      data: {
        success: false
      }
    });

    renderShell();
    fireEvent.change(screen.getByPlaceholderText("Discount code"), { target: { value: "BADCODE" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Invalid or expired discount code")).toBeInTheDocument();
  });

  it("shows service error when discount validation request fails", async () => {
    useCartStore.setState({
      lines: [
        {
          productVariantId: "v1",
          quantity: 1,
          productName: "Apple",
          variantLabel: "1kg",
          unitPrice: 120
        }
      ],
      isOpen: true
    });
    postMock.mockRejectedValue(new Error("network"));

    renderShell();
    fireEvent.change(screen.getByPlaceholderText("Discount code"), { target: { value: "SAVE20" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Could not validate discount code")).toBeInTheDocument();
  });

  it("removes line item and calls cart delete API", async () => {
    useCartStore.setState({
      lines: [
        {
          productVariantId: "v1",
          quantity: 1,
          productName: "Apple",
          variantLabel: "1kg",
          unitPrice: 120
        }
      ],
      isOpen: true
    });
    deleteMock.mockResolvedValue({ data: { success: true } });

    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Remove Apple" }));
    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("/api/v1/cart/items/v1");
    });
  });

  it("disables proceed to checkout when cart is empty", () => {
    useCartStore.setState({ isOpen: true, lines: [] });
    renderShell();
    expect(screen.getByRole("button", { name: "Proceed to Checkout" })).toBeDisabled();
  });

  it("enables proceed to checkout when cart has items", () => {
    useCartStore.setState({
      isOpen: true,
      lines: [
        {
          productVariantId: "v1",
          quantity: 1,
          productName: "Apple",
          variantLabel: "1kg",
          unitPrice: 120
        }
      ]
    });
    renderShell();
    expect(screen.getByRole("button", { name: "Proceed to Checkout" })).toBeEnabled();
  });

  describe("Cart Offer Pills & Collapsible Discount Dropdown", () => {
    it("Test A (Locked pill)", () => {
      useCartStore.setState({
        lines: [
          {
            productVariantId: "v1",
            quantity: 1,
            productName: "Apple",
            variantLabel: "1kg",
            unitPrice: 120
          }
        ],
        activeOffers: [
          {
            id: 'o1',
            title: 'Early Bird',
            discountType: 'FLAT',
            discountValue: 100,
            minOrderAmount: 200,
            maxDiscount: null
          }
        ],
        isOpen: true
      });

      renderShell();

      const pill = screen.getByTestId("offer-pill-o1");
      expect(pill).toBeInTheDocument();
      expect(pill.textContent).toContain("Early Bird");
      expect(pill.textContent).toContain("Minimum purchase: Rs 200");
      expect(pill.textContent).not.toContain("✅");
      expect(pill.textContent).not.toContain("Applied");
      expect(pill.textContent).not.toContain("100");

      expect(screen.queryByText(/Add Rs/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId("cart-discount-summary")).not.toBeInTheDocument();
      expect(screen.getByTestId("cart-total")).toHaveTextContent("Rs 150.00");
    });

    it("Test B (Locked pill with maxDiscount)", () => {
      useCartStore.setState({
        lines: [
          {
            productVariantId: "v1",
            quantity: 1,
            productName: "Apple",
            variantLabel: "1kg",
            unitPrice: 120
          }
        ],
        activeOffers: [
          {
            id: 'o1',
            title: 'Early Bird',
            discountType: 'FLAT',
            discountValue: 100,
            minOrderAmount: 200,
            maxDiscount: 30
          }
        ],
        isOpen: true
      });

      renderShell();

      const pill = screen.getByTestId("offer-pill-o1");
      expect(pill.textContent).toContain("Discount up to: Rs 30");
      expect(pill.textContent).toContain("Minimum purchase: Rs 200");
    });

    it("Test C (Applied pill)", async () => {
      useCartStore.setState({
        lines: [
          {
            productVariantId: "v1",
            quantity: 2,
            productName: "Apple",
            variantLabel: "1kg",
            unitPrice: 110
          }
        ],
        activeOffers: [
          {
            id: 'o1',
            title: 'Early Bird',
            discountType: 'FLAT',
            discountValue: 100,
            minOrderAmount: 200,
            maxDiscount: null
          }
        ],
        isOpen: true
      });

      renderShell();

      const pill = screen.getByTestId("offer-pill-o1");
      expect(pill).toBeInTheDocument();
      expect(pill.textContent).toContain("✅");
      expect(pill.textContent).toContain("Early Bird");
      expect(pill.textContent).not.toContain("Minimum purchase");
      expect(pill.textContent).not.toContain("Discount up to");
      expect(pill.textContent).not.toContain("-Rs");
      expect(pill.textContent).not.toContain("100");
      expect(pill.textContent).not.toContain("Saved");

      const summary = screen.getByTestId("cart-discount-summary");
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent("Total Discount");
      expect(summary).toHaveTextContent("-Rs 100.00");

      expect(screen.queryByTestId("cart-discount-breakdown-item")).not.toBeInTheDocument();

      const chevron = screen.getByTestId("cart-discount-toggle-chevron");
      fireEvent.click(chevron);

      const breakdownItem = await screen.findByTestId("cart-discount-breakdown-item");
      expect(breakdownItem).toBeInTheDocument();
      expect(breakdownItem.textContent).toContain("Early Bird");
      expect(breakdownItem.textContent).toContain("-Rs 100.00");
      expect(breakdownItem).toHaveClass("text-xs");

      expect(screen.getByTestId("cart-total")).toHaveTextContent("Rs 150.00");
      expect(screen.queryByText("Store Offer")).not.toBeInTheDocument();
    });

    it("Test D (PERCENTAGE offer with maxDiscount cap)", () => {
      useCartStore.setState({
        lines: [
          {
            productVariantId: "v1",
            quantity: 1,
            productName: "Apple",
            variantLabel: "1kg",
            unitPrice: 200
          }
        ],
        activeOffers: [
          {
            id: 'o2',
            title: 'Summer 10%',
            discountType: 'PERCENTAGE',
            discountValue: 10,
            minOrderAmount: null,
            maxDiscount: 15
          }
        ],
        isOpen: true
      });

      renderShell();

      const pill = screen.getByTestId("offer-pill-o2");
      expect(pill).toBeInTheDocument();
      expect(pill.textContent).toContain("✅");
      expect(pill.textContent).toContain("Summer 10%");
      expect(pill.textContent).toContain("Maximum discount: Rs 15");

      const summary = screen.getByTestId("cart-discount-summary");
      expect(summary).toHaveTextContent("-Rs 15.00");

      expect(screen.getByTestId("cart-total")).toHaveTextContent("Rs 215.00");
    });

    it("Test E (Applied reverts to locked when subtotal drops)", async () => {
      useCartStore.setState({
        lines: [
          {
            productVariantId: "v1",
            quantity: 2,
            productName: "Apple",
            variantLabel: "1kg",
            unitPrice: 110
          }
        ],
        activeOffers: [
          {
            id: 'o1',
            title: 'Early Bird',
            discountType: 'FLAT',
            discountValue: 100,
            minOrderAmount: 200,
            maxDiscount: null
          }
        ],
        isOpen: true
      });

      putMock.mockResolvedValue({ data: { success: true } });

      renderShell();

      // Starts as applied
      const pill = screen.getByTestId("offer-pill-o1");
      expect(pill.textContent).toContain("✅");
      expect(screen.getByTestId("cart-discount-summary")).toBeInTheDocument();

      // Subtotal drops
      useCartStore.setState({
        lines: [
          {
            productVariantId: "v1",
            quantity: 1,
            productName: "Apple",
            variantLabel: "1kg",
            unitPrice: 110
          }
        ]
      });

      // Rerender or wait
      await waitFor(() => {
        expect(pill.textContent).toContain("Minimum purchase: Rs 200");
        expect(pill.textContent).not.toContain("✅");
        expect(screen.queryByTestId("cart-discount-summary")).not.toBeInTheDocument();
        expect(screen.getByTestId("cart-total")).toHaveTextContent("Rs 140.00");
      });
    });

    it("Test F (No offers)", () => {
      useCartStore.setState({
        lines: [
          {
            productVariantId: "v1",
            quantity: 1,
            productName: "Apple",
            variantLabel: "1kg",
            unitPrice: 100
          }
        ],
        activeOffers: [],
        isOpen: true
      });

      renderShell();

      expect(screen.queryByTestId(/offer-pill-/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Active offers and discounts may apply/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Add Rs/i)).not.toBeInTheDocument();
    });
  });
});
