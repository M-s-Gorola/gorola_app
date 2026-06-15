import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { MockInstance } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { OrderHistoryPage } from "./OrderHistoryPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockCartOpen = vi.fn();
vi.mock("@/store/cart.store", () => ({
  useCartStore: {
    getState: () => ({ open: mockCartOpen })
  }
}));

vi.mock("@/lib/buyer-cart-sync", () => ({
  syncBuyerCartFromServer: vi.fn().mockResolvedValue(undefined)
}));

describe("OrderHistoryPage", () => {
  let apiGetSpy: MockInstance;
  let apiPostSpy: MockInstance;
  let apiPutSpy: MockInstance;

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();

    apiGetSpy = vi.spyOn(api!, "get").mockResolvedValue({
      data: {
        data: {
          orders: [
            {
              id: "order1",
              store: { name: "Test Store" },
              total: "120.00",
              status: "DELIVERED",
              createdAt: "2026-05-01T10:00:00Z",
              items: [
                { id: "i1", productName: "Apple", quantity: 2, variantLabel: "Red" }
              ],
              rating: null,
              ratingComment: null
            },
            {
              id: "order2",
              store: { name: "Test Store 2" },
              total: "230.00",
              status: "PLACED",
              createdAt: "2026-05-01T11:00:00Z",
              items: [
                { id: "i2", productName: "Banana", quantity: 5, variantLabel: "Yellow" }
              ],
              rating: null,
              ratingComment: null
            }
          ]
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    apiPostSpy = vi.spyOn(api!, "post").mockResolvedValue({
      data: { data: { warnings: [] } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    apiPutSpy = vi.spyOn(api!, "put").mockResolvedValue({
      data: { data: { id: "updated" } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OrderHistoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders a list of orders", async () => {
    renderComponent();

    expect(await screen.findByText("Order History")).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText("Test Store")).toBeInTheDocument();
      expect(screen.getByText("Test Store 2")).toBeInTheDocument();
    });
    
    expect(screen.getByText("₹120.00")).toBeInTheDocument();
    expect(screen.getByText("₹230.00")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Placed")).toBeInTheDocument();
  });

  it("triggers reorder and opens cart drawer", async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => screen.getByText("Test Store"));

    const reorderBtns = screen.getAllByRole("button", { name: /Reorder/i });
    await user.click(reorderBtns[0]!);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith("/api/v1/orders/order1/reorder");
      expect(mockCartOpen).toHaveBeenCalled();
    });
  });

  it("allows rating a delivered order", async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => screen.getByText("Delivered"));

    // Rate star rating
    const starBtn = screen.getAllByRole("button", { name: /Rate 4.5 stars/i })[0]!;
    await user.click(starBtn);

    const submitBtn = screen.getByRole("button", { name: /Submit Feedback/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(apiPutSpy).toHaveBeenCalledWith("/api/v1/orders/order1/rate", expect.objectContaining({
        rating: 4.5
      }));
    });
  });

  it("does not show rating buttons for non-delivered orders", async () => {
    renderComponent();

    await waitFor(() => screen.getByText("Placed"));
    
    const order2Container = screen.getByText("Test Store 2").closest("div");
    expect(order2Container).not.toContainElement(screen.queryByRole("button", { name: /Rate 5.0 stars/i }));
  });

  it("renders empty state when no orders exist", async () => {
    apiGetSpy.mockResolvedValue({
      data: { data: { orders: [] } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No orders yet")).toBeInTheDocument();
    });
  });

  it("only shows loading state on the specific reorder button being clicked", async () => {
    const user = userEvent.setup();
    
    // Mock a delayed response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvePost: (value: any) => void;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });
    apiPostSpy.mockReturnValue(postPromise);

    renderComponent();
    await waitFor(() => screen.getByText("Test Store"));

    const reorderBtns = screen.getAllByRole("button", { name: /Reorder/i });
    
    // Click reorder on the first order
    await user.click(reorderBtns[0]!);

    // Check that ONLY the first button's icon is spinning
    await waitFor(() => {
      const spinningIcons = document.querySelectorAll(".animate-spin");
      expect(spinningIcons.length).toBe(1);
    });

    // Cleanup
    resolvePost!({ data: { data: { warnings: [] } } });
  });

  it("only disables rating buttons on the specific order being rated", async () => {
    const user = userEvent.setup();
    
    // Mock a delayed response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvePut: (value: any) => void;
    const putPromise = new Promise((resolve) => {
      resolvePut = resolve;
    });
    apiPutSpy.mockReturnValue(putPromise);

    apiGetSpy.mockResolvedValue({
      data: {
        data: {
          orders: [
            { id: "o1", store: { name: "S1" }, total: "10", status: "DELIVERED", createdAt: "2026-05-01T10:00:00Z", items: [], rating: null, ratingComment: null },
            { id: "o2", store: { name: "S2" }, total: "20", status: "DELIVERED", createdAt: "2026-05-01T11:00:00Z", items: [], rating: null, ratingComment: null }
          ]
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    
    renderComponent();
    await waitFor(() => screen.getByText("S1"));
    
    const s1Star = screen.getAllByRole("button", { name: /Rate 4.5 stars/i })[0]!;
    const s2Star = screen.getAllByRole("button", { name: /Rate 4.5 stars/i })[1]!;
    
    await user.click(s1Star);
    await user.click(screen.getAllByRole("button", { name: /Submit Feedback/i })[0]!);
    
    expect(s1Star).toBeDisabled();
    expect(s2Star).not.toBeDisabled();

    // Cleanup
    resolvePut!({ data: { data: { id: "ok" } } });
  });

  it("renders scheduled slot, date, and fasting warning correctly for booking orders", async () => {
    apiGetSpy.mockResolvedValue({
      data: {
        data: {
          orders: [
            {
              id: "booking_order_id",
              store: { name: "Apollo Diagnostics", storeType: "BOOKING_COMMERCE" },
              total: "450.00",
              status: "PENDING_APPROVAL",
              orderType: "BOOKING",
              createdAt: "2026-05-25T10:00:00Z",
              items: [
                { id: "i1", productId: "p1", productVariantId: "v1", productName: "Thyroid Profile", quantity: 1, variantLabel: "Standard" }
              ],
              rating: null,
              ratingComment: null,
              bookingOrder: {
                id: "bo1",
                scheduledDate: "2026-05-28T00:00:00.000Z",
                timeslot: "12:00-15:00",
                requiresFasting: true,
                approvalStatus: "PENDING_APPROVAL",
                rejectionReason: null
              }
            }
          ]
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderComponent();

    expect(await screen.findByText("Apollo Diagnostics")).toBeInTheDocument();
    expect(screen.getByText("Scheduled: May 28, 2026")).toBeInTheDocument();
    expect(screen.getByText("Slot: 12:00-15:00")).toBeInTheDocument();
    expect(screen.getByText("⚠️ Fasting Required (min 8-10 hours)")).toBeInTheDocument();
  });

  it("renders correct color-coded badge for booking order approval statuses", async () => {
    apiGetSpy.mockResolvedValue({
      data: {
        data: {
          orders: [
            {
              id: "bo_pending",
              store: { name: "Diagnostic Hub", storeType: "BOOKING_COMMERCE" },
              total: "100.00",
              status: "PENDING_APPROVAL",
              orderType: "BOOKING",
              createdAt: "2026-05-25T10:00:00Z",
              items: [],
              rating: null,
              ratingComment: null,
              bookingOrder: {
                id: "bo1",
                scheduledDate: "2026-05-28T00:00:00.000Z",
                timeslot: "12:00-15:00",
                requiresFasting: false,
                approvalStatus: "PENDING_APPROVAL",
                rejectionReason: null
              }
            },
            {
              id: "bo_approved",
              store: { name: "Diagnostic Hub 2", storeType: "BOOKING_COMMERCE" },
              total: "200.00",
              status: "APPROVED",
              orderType: "BOOKING",
              createdAt: "2026-05-25T11:00:00Z",
              items: [],
              rating: null,
              ratingComment: null,
              bookingOrder: {
                id: "bo2",
                scheduledDate: "2026-05-28T00:00:00.000Z",
                timeslot: "12:00-15:00",
                requiresFasting: false,
                approvalStatus: "APPROVED",
                rejectionReason: null
              }
            }
          ]
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderComponent();

    expect(await screen.findByText("Diagnostic Hub")).toBeInTheDocument();
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("filters orders correctly using All, Instant Deliveries, and Booked Services tabs", async () => {
    const user = userEvent.setup();
    apiGetSpy.mockResolvedValue({
      data: {
        data: {
          orders: [
            {
              id: "retail1",
              store: { name: "Retail Store", storeType: "QUICK_COMMERCE" },
              total: "120.00",
              status: "DELIVERED",
              orderType: "QUICK",
              createdAt: "2026-05-01T10:00:00Z",
              items: [],
              rating: null,
              ratingComment: null
            },
            {
              id: "booking1",
              store: { name: "Service Centre", storeType: "BOOKING_COMMERCE" },
              total: "450.00",
              status: "APPROVED",
              orderType: "BOOKING",
              createdAt: "2026-05-01T11:00:00Z",
              items: [],
              rating: null,
              ratingComment: null,
              bookingOrder: {
                id: "bo1",
                scheduledDate: "2026-05-28T00:00:00.000Z",
                timeslot: "12:00-15:00",
                requiresFasting: false,
                approvalStatus: "APPROVED",
                rejectionReason: null
              }
            }
          ]
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderComponent();

    // Default "All" tab shows both
    expect(await screen.findByText("Retail Store")).toBeInTheDocument();
    expect(screen.getByText("Service Centre")).toBeInTheDocument();

    // Click "Instant Deliveries" tab
    const instantTab = screen.getByRole("button", { name: /Instant Deliveries/i });
    await user.click(instantTab);
    expect(screen.getByText("Retail Store")).toBeInTheDocument();
    expect(screen.queryByText("Service Centre")).not.toBeInTheDocument();

    // Click "Booked Services" tab
    const bookingTab = screen.getByRole("button", { name: /Booked Services/i });
    await user.click(bookingTab);
    expect(screen.queryByText("Retail Store")).not.toBeInTheDocument();
    expect(screen.getByText("Service Centre")).toBeInTheDocument();
  });

  it("replaces Reorder button with Book Again and navigates to the booking new schedule flow", async () => {
    const user = userEvent.setup();
    apiGetSpy.mockResolvedValue({
      data: {
        data: {
          orders: [
            {
              id: "booking_order_id",
              store: { name: "Apollo Diagnostics", storeType: "BOOKING_COMMERCE" },
              total: "450.00",
              status: "PENDING_APPROVAL",
              orderType: "BOOKING",
              createdAt: "2026-05-25T10:00:00Z",
              items: [
                { id: "i1", productId: "p1", productVariantId: "v1", productName: "Thyroid Profile", quantity: 1, variantLabel: "Standard" }
              ],
              rating: null,
              ratingComment: null,
              bookingOrder: {
                id: "bo1",
                scheduledDate: "2026-05-28T00:00:00.000Z",
                timeslot: "12:00-15:00",
                requiresFasting: false,
                approvalStatus: "PENDING_APPROVAL",
                rejectionReason: null
              }
            }
          ]
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderComponent();

    expect(await screen.findByText("Apollo Diagnostics")).toBeInTheDocument();
    
    // Should NOT have "Reorder" button, but "Book Again" button
    expect(screen.queryByRole("button", { name: /Reorder/i })).not.toBeInTheDocument();
    
    const bookAgainBtn = screen.getByRole("button", { name: /Book Again/i });
    await user.click(bookAgainBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/bookings/new?productId=p1&variantId=v1");
  });

  it("displays read-only rating badge and hides active buttons for already-rated orders", async () => {
    apiGetSpy.mockResolvedValue({
      data: {
        data: {
          orders: [
            {
              id: "order-rated",
              store: { name: "Test Store" },
              total: "100.00",
              status: "DELIVERED",
              createdAt: "2026-05-01T10:00:00Z",
              items: [],
              rating: 4.5,
              ratingComment: "Awesome honey!"
            }
          ]
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderComponent();

    expect(await screen.findByText("Test Store")).toBeInTheDocument();

    expect(screen.getByText("Rating submitted")).toBeInTheDocument();
    expect(screen.getByText("4.5 / 5")).toBeInTheDocument();
    expect(screen.getByText('"Awesome honey!"')).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Rate 5.0 stars/i })).not.toBeInTheDocument();
  });
});
