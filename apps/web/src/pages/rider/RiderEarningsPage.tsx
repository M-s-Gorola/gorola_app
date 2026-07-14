import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AlertCircle, IndianRupee, RefreshCw, TrendingUp } from "lucide-react";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";

import { api } from "@/lib/api";

type EarningItem = {
  id: string;
  orderId: string;
  amount: string;
  earningType: string;
  distanceKm: string | null;
  createdAt: string;
};

type SummaryData = {
  today: { count: number; total: string };
  thisWeek: { count: number; total: string };
  thisMonth: { count: number; total: string };
};

type EarningSummaryResponse = {
  success: boolean;
  data: SummaryData;
};

type FilterType = "today" | "yesterday" | "thisWeek" | "thisMonth" | "custom";

function getDateRange(filter: FilterType, customStart?: string, customEnd?: string): { startDate?: string; endDate?: string } {
  const now = new Date();

  if (filter === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (filter === "yesterday") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (filter === "thisWeek") {
    // Week starts on Monday
    const start = new Date(now);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }

  if (filter === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }

  if (filter === "custom") {
    const range: { startDate?: string; endDate?: string } = {};
    if (customStart) {
      range.startDate = new Date(customStart + "T00:00:00").toISOString();
    }
    if (customEnd) {
      range.endDate = new Date(customEnd + "T23:59:59").toISOString();
    }
    return range;
  }

  return {};
}

export function RiderEarningsPage(): ReactElement {
  const [filter, setFilter] = useState<FilterType>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Fetch Earning Summary (Overall default metrics card)
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary
  } = useQuery<EarningSummaryResponse>({
    queryKey: ["rider-earnings-summary"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<EarningSummaryResponse>("/api/v1/rider/earnings/summary");
      return res.data;
    }
  });

  const { startDate, endDate } = useMemo(() => getDateRange(filter, customStart, customEnd), [filter, customStart, customEnd]);

  // Fetch Earning History using Infinite Query with date filters
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch: refetchHistory
  } = useInfiniteQuery({
    queryKey: ["rider-earnings-history", filter, startDate, endDate],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!api) throw new Error("API helper not initialized");
      let url = "/api/v1/rider/earnings/history?limit=10";
      if (pageParam) {
        url += `&cursor=${pageParam}`;
      }
      if (startDate) {
        url += `&startDate=${encodeURIComponent(startDate)}`;
      }
      if (endDate) {
        url += `&endDate=${encodeURIComponent(endDate)}`;
      }
      const res = await api.get<{
        success: boolean;
        data: {
          items: EarningItem[];
          nextCursor: string | null;
          filterSummary: { count: number; total: string };
        };
      }>(url);
      return res.data.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  const historyItems = useMemo(
    () => historyData?.pages.flatMap((page) => page.items) ?? [],
    [historyData?.pages]
  );

  const filterSummary = historyData?.pages[0]?.filterSummary;

  const handleRetry = () => {
    void refetchSummary();
    void refetchHistory();
  };

  const isError = isSummaryError || isHistoryError;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center font-sans">
        <div className="h-12 w-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load earnings</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          An error occurred while retrieving your earnings dashboard. Please try again.
        </p>
        <button
          onClick={handleRetry}
          className="mt-6 inline-flex items-center gap-1.5 bg-gorola-pine hover:bg-gorola-pine/90 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow cursor-pointer transition-all duration-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  const summary = summaryData?.data;

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex flex-col gap-1.5 border-b border-gorola-fog pb-4">
        <h1 className="font-heading text-2xl font-bold text-gorola-charcoal">Earnings Dashboard</h1>
        <p className="text-muted-foreground text-xs">Track your completed payouts and delivery statistics</p>
      </div>

      {/* Summary Payout Cards or Skeletons */}
      {isSummaryLoading ? (
        <div className="grid grid-cols-3 gap-3" data-testid="earnings-skeletons">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gorola-fog/40 h-24 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {/* Today */}
          <div className="bg-white border border-gorola-fog rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today</span>
              <span className="text-base font-black text-gorola-charcoal flex items-center">
                <IndianRupee className="h-3.5 w-3.5 shrink-0" />
                {summary?.today.total ?? "0.00"}
              </span>
            </div>
            <span className="text-[10px] font-bold text-gorola-pine mt-2 bg-gorola-pine/10 w-fit px-1.5 py-0.5 rounded">
              {summary?.today.count ?? 0} {summary?.today.count === 1 ? "order" : "orders"}
            </span>
          </div>

          {/* This Week */}
          <div className="bg-white border border-gorola-fog rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">This Week</span>
              <span className="text-base font-black text-gorola-charcoal flex items-center">
                <IndianRupee className="h-3.5 w-3.5 shrink-0" />
                {summary?.thisWeek.total ?? "0.00"}
              </span>
            </div>
            <span className="text-[10px] font-bold text-gorola-pine mt-2 bg-gorola-pine/10 w-fit px-1.5 py-0.5 rounded">
              {summary?.thisWeek.count ?? 0} {summary?.thisWeek.count === 1 ? "order" : "orders"}
            </span>
          </div>

          {/* This Month */}
          <div className="bg-white border border-gorola-fog rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">This Month</span>
              <span className="text-base font-black text-gorola-charcoal flex items-center">
                <IndianRupee className="h-3.5 w-3.5 shrink-0" />
                {summary?.thisMonth.total ?? "0.00"}
              </span>
            </div>
            <span className="text-[10px] font-bold text-gorola-pine mt-2 bg-gorola-pine/10 w-fit px-1.5 py-0.5 rounded">
              {summary?.thisMonth.count ?? 0} {summary?.thisMonth.count === 1 ? "order" : "orders"}
            </span>
          </div>
        </div>
      )}

      {/* Payout History Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-gorola-fog pb-2">
          <h2 className="text-base font-bold text-gorola-charcoal">Payout History</h2>

          {/* Filter Dropdown */}
          <select
            data-testid="payout-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="bg-white border border-gorola-fog rounded-xl px-2.5 py-1 text-xs text-gorola-charcoal focus:outline-none focus:ring-1 focus:ring-gorola-pine"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="thisWeek">This Week</option>
            <option value="thisMonth">This Month</option>
            <option value="custom">Date Range</option>
          </select>
        </div>

        {/* Custom Date Inputs */}
        {filter === "custom" && (
          <div className="grid grid-cols-2 gap-3 bg-white border border-gorola-fog rounded-2xl p-4 shadow-sm" data-testid="custom-date-inputs">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground">Start Date</label>
              <input
                type="date"
                data-testid="custom-start-date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-gorola-fog rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gorola-pine"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground">End Date</label>
              <input
                type="date"
                data-testid="custom-end-date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-gorola-fog rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gorola-pine"
              />
            </div>
          </div>
        )}

        {/* Aggregate values and list loaders */}
        {isHistoryLoading ? (
          <div className="bg-gorola-fog/40 h-48 rounded-2xl animate-pulse" />
        ) : (
          <>
            {/* Aggregate values for the filtered result */}
            {filterSummary && (
              <div className="bg-gorola-pine/5 border border-gorola-pine/15 rounded-xl py-2 px-4 flex items-center justify-between shadow-sm" data-testid="filter-aggregate-box">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtered Total:</span>
                  <span className="text-sm font-black text-gorola-pine flex items-center">
                    <IndianRupee className="h-3.5 w-3.5 shrink-0" />
                    {filterSummary.total}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deliveries:</span>
                  <span className="text-xs font-bold text-gorola-charcoal">
                    {filterSummary.count} {filterSummary.count === 1 ? "order" : "orders"}
                  </span>
                </div>
              </div>
            )}

            {/* History List */}
            {historyItems.length === 0 ? (
              <div className="border border-dashed border-gorola-fog rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2 bg-white">
                <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-gorola-charcoal">No earnings recorded yet</p>
                <p className="text-xs text-muted-foreground">Completed deliveries for this filter will show up here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-gorola-fog rounded-2xl p-4 flex items-center justify-between shadow-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-gorola-charcoal">Order: {item.orderId}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-black text-gorola-pine">+ ₹{item.amount}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/85">
                        {item.earningType.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}

                {hasNextPage === true && (
                  <button
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="mt-2 w-full h-11 border border-gorola-fog bg-white hover:bg-gorola-fog/20 text-gorola-charcoal font-bold text-xs rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 disabled:opacity-50"
                  >
                    {isFetchingNextPage ? "Loading more..." : "Load More"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
