import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent,render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RiderEarningsPage } from "./RiderEarningsPage";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock
  }
}));

function renderRiderEarningsPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <RiderEarningsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("RiderEarningsPage Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
  });

  it("renders loading skeletons initially", () => {
    getMock.mockReturnValue(new Promise(() => {}));
    renderRiderEarningsPage();
    expect(screen.getByTestId("earnings-skeletons")).toBeInTheDocument();
  });

  it("renders summary totals and list of history items when loaded", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/summary")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              today: { count: 3, total: "120.00" },
              thisWeek: { count: 5, total: "200.00" },
              thisMonth: { count: 12, total: "480.00" }
            }
          }
        });
      }
      if (url.includes("/history")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [
                {
                  id: "earn-1",
                  orderId: "ord-101",
                  amount: "40.00",
                  earningType: "PER_ORDER",
                  distanceKm: null,
                  createdAt: "2026-07-14T12:00:00Z"
                },
                {
                  id: "earn-2",
                  orderId: "ord-102",
                  amount: "40.00",
                  earningType: "PER_ORDER",
                  distanceKm: null,
                  createdAt: "2026-07-13T12:00:00Z"
                }
              ],
              nextCursor: null,
              filterSummary: { count: 2, total: "80.00" }
            }
          }
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderRiderEarningsPage();

    // Verify summary values
    expect(await screen.findByText("120.00")).toBeInTheDocument();
    expect(screen.getByText("200.00")).toBeInTheDocument();
    expect(screen.getByText("480.00")).toBeInTheDocument();

    expect(screen.getByText("3 orders")).toBeInTheDocument();
    expect(screen.getByText("5 orders")).toBeInTheDocument();
    expect(screen.getByText("12 orders")).toBeInTheDocument();

    // Verify filter summary aggregate card
    expect(screen.getByText("80.00")).toBeInTheDocument();
    expect(screen.getByText("2 orders")).toBeInTheDocument();

    // Verify history list items
    expect(screen.getByText("Order: ord-101")).toBeInTheDocument();
    expect(screen.getByText("Order: ord-102")).toBeInTheDocument();
    expect(screen.getAllByText("+ ₹40.00")).toHaveLength(2);
  });

  it("supports infinite scroll pagination via 'Load More' button", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/summary")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              today: { count: 3, total: "120.00" },
              thisWeek: { count: 3, total: "120.00" },
              thisMonth: { count: 3, total: "120.00" }
            }
          }
        });
      }
      if (url.includes("/history")) {
        if (url.includes("cursor=earn-2")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                items: [
                  {
                    id: "earn-3",
                    orderId: "ord-103",
                    amount: "40.00",
                    earningType: "PER_ORDER",
                    distanceKm: null,
                    createdAt: "2026-07-12T12:00:00Z"
                  }
                ],
                nextCursor: null,
                filterSummary: { count: 3, total: "120.00" }
              }
            }
          });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [
                {
                  id: "earn-1",
                  orderId: "ord-101",
                  amount: "40.00",
                  earningType: "PER_ORDER",
                  distanceKm: null,
                  createdAt: "2026-07-14T12:00:00Z"
                },
                {
                  id: "earn-2",
                  orderId: "ord-102",
                  amount: "40.00",
                  earningType: "PER_ORDER",
                  distanceKm: null,
                  createdAt: "2026-07-13T12:00:00Z"
                }
              ],
              nextCursor: "earn-2",
              filterSummary: { count: 3, total: "120.00" }
            }
          }
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderRiderEarningsPage();

    // Verify first chunk loaded
    expect(await screen.findByText("Order: ord-101")).toBeInTheDocument();
    expect(screen.getByText("Order: ord-102")).toBeInTheDocument();
    expect(screen.queryByText("Order: ord-103")).not.toBeInTheDocument();

    // Click load more
    const loadMoreBtn = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreBtn);

    // Verify next chunk loaded and appended
    expect(await screen.findByText("Order: ord-103")).toBeInTheDocument();
    expect(screen.getByText("Order: ord-101")).toBeInTheDocument();
    expect(screen.getByText("Order: ord-102")).toBeInTheDocument();
  });

  it("filters payout history when selecting date ranges", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/summary")) {
        return Promise.resolve({
          data: { success: true, data: { today: { count: 1, total: "40.0" }, thisWeek: { count: 1, total: "40.0" }, thisMonth: { count: 1, total: "40.0" } } }
        });
      }
      if (url.includes("/history")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [],
              nextCursor: null,
              filterSummary: { count: 0, total: "0.00" }
            }
          }
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderRiderEarningsPage();

    const select = await screen.findByTestId("payout-filter");
    expect(select).toBeInTheDocument();

    // Switch to Custom Date Range
    fireEvent.change(select, { target: { value: "custom" } });

    // Custom date inputs should now be visible
    expect(screen.getByTestId("custom-date-inputs")).toBeInTheDocument();

    const startInput = screen.getByTestId("custom-start-date");
    const endInput = screen.getByTestId("custom-end-date");

    fireEvent.change(startInput, { target: { value: "2026-07-01" } });
    fireEvent.change(endInput, { target: { value: "2026-07-10" } });

    expect(getMock).toHaveBeenCalledWith(expect.stringContaining("startDate="));
    expect(getMock).toHaveBeenCalledWith(expect.stringContaining("endDate="));
  });

  it("renders empty state if there are no earnings", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/summary")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              today: { count: 0, total: "0.00" },
              thisWeek: { count: 0, total: "0.00" },
              thisMonth: { count: 0, total: "0.00" }
            }
          }
        });
      }
      if (url.includes("/history")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [],
              nextCursor: null,
              filterSummary: { count: 0, total: "0.00" }
            }
          }
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderRiderEarningsPage();

    expect(await screen.findByText(/no earnings recorded yet/i)).toBeInTheDocument();
  });

  it("renders error state when API fails", async () => {
    getMock.mockRejectedValue(new Error("Failed to fetch"));
    renderRiderEarningsPage();
    expect(await screen.findByText(/failed to load earnings/i)).toBeInTheDocument();
  });
});
