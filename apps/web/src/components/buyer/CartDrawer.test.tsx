import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BuyerLayout } from "@/components/buyer/BuyerLayout";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useFeatureFlagsStore } from "@/store/feature-flags.store";

const { postMock, putMock, deleteMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: postMock,
    put: putMock,
    delete: deleteMock
  }
}));

describe("CartDrawer", () => {
  beforeEach(() => {
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
    fireEvent.click(screen.getByRole("button", { name: "Open cart" }));
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
    expect(screen.getByText("Subtotal: Rs 240.00")).toBeInTheDocument();
    expect(screen.getByText("Delivery fee: Rs 30.00")).toBeInTheDocument();
    expect(screen.getByText("Total: Rs 270.00")).toBeInTheDocument();
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
    expect(screen.getByText("Saved: Rs 20.00")).toBeInTheDocument();
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
    expect(await screen.findByText("Could not validate discount code right now")).toBeInTheDocument();
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
});
