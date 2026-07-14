import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  Layers,
  ShoppingBag,
  TrendingUp,
  Users
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

type PerStoreBreakdownItem = {
  storeId: string;
  storeName: string;
  ordersToday: number;
  revenueToday: number;
  pendingOrdersCount: number;
  storeType?: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
};

type WeeklyRevenueItem = {
  date: string;
  revenue: number;
};

type FeatureFlagItem = {
  key: string;
  value: boolean;
};

type AdminDashboardData = {
  totalOrdersToday: number;
  totalRevenueToday: number;
  perStoreBreakdown: PerStoreBreakdownItem[];
  weeklyRevenue: WeeklyRevenueItem[];
  lowStockAlertCount: number;
  totalActiveBuyers: number;
  totalProducts: number;
  pendingAdApprovalsCount: number;
  featureFlags: FeatureFlagItem[];
};

type AdminDashboardEnvelope = {
  success: boolean;
  data: AdminDashboardData;
};

type TrendItem = {
  date: string;
  count: number;
};

type TrendEnvelope = {
  success: boolean;
  data: TrendItem[];
};

type AdminStoreListItem = {
  id: string;
  name: string;
  storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
  isActive: boolean;
};

type StoresListResponse = {
  success: boolean;
  data: AdminStoreListItem[];
};

export function AdminDashboardPage(): ReactElement {
  const queryClient = useQueryClient();

  const [deliveryCharge, setDeliveryCharge] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [riderEarningRateGlobal, setRiderEarningRateGlobal] = useState("");
  const [hasSetDefaults, setHasSetDefaults] = useState(false);

  const { data: settings } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: Array<{ key: string; value: string }> }>("/api/v1/admin/settings");
      return res.data.data;
    }
  });

  useEffect(() => {
    if (Array.isArray(settings) && !hasSetDefaults) {
      const delivery = settings.find(s => s.key === "DELIVERY_CHARGE")?.value || "";
      const service = settings.find(s => s.key === "SERVICE_CHARGE")?.value || "";
      const rate = settings.find(s => s.key === "RIDER_EARNING_RATE_PCT")?.value || "";
      setDeliveryCharge(delivery);
      setServiceCharge(service);
      setRiderEarningRateGlobal(rate);
      setHasSetDefaults(true);
    }
  }, [settings, hasSetDefaults]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: { deliveryCharge: string; serviceCharge: string }) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put<{ success: boolean; data: Array<{ key: string; value: string }> }>("/api/v1/admin/settings", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Platform fees updated successfully");
      queryClient.setQueryData(["admin", "settings"], data.data);
    },
    onError: () => {
      toast.error("Failed to update platform fees");
    }
  });

  const updateGlobalRiderEarningRateMutation = useMutation({
    mutationFn: async (value: string) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put<{ success: boolean; data: unknown }>("/api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT", { value });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Global rider earning rate updated successfully");
      void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: () => {
      toast.error("Failed to update global rider earning rate");
    }
  });

  const [range, setRange] = useState<"TODAY" | "WEEK" | "MONTH" | "YEAR" | "ALL">("WEEK");
  const [groupBy, setGroupBy] = useState<"HOURLY" | "DAILY" | "MONTHLY" | "YEARLY">("DAILY");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [storeType, setStoreType] = useState<"QUICK_COMMERCE" | "BOOKING_COMMERCE" | undefined>(undefined);

  const [volumeRange, setVolumeRange] = useState<"TODAY" | "WEEK" | "MONTH" | "YEAR" | "ALL">("WEEK");
  const [volumeGroupBy, setVolumeGroupBy] = useState<"HOURLY" | "DAILY" | "MONTHLY" | "YEARLY">("DAILY");
  const [volumeSelectedStoreIds, setVolumeSelectedStoreIds] = useState<string[]>([]);
  const [volumeStorePickerOpen, setVolumeStorePickerOpen] = useState(false);
  const [volumeStoreType, setVolumeStoreType] = useState<"QUICK_COMMERCE" | "BOOKING_COMMERCE" | undefined>(undefined);

  const { data: storesList } = useQuery<AdminStoreListItem[]>({
    queryKey: ["admin", "stores"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<StoresListResponse>("/api/v1/admin/stores");
      return res.data.data;
    },
    staleTime: 60000
  });

  const allStores = Array.isArray(storesList) ? storesList : [];

  const { data: dashboard, isLoading, error } = useQuery<AdminDashboardData>({
    queryKey: ["admin", "dashboard", range, groupBy, selectedStoreIds, storeType],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const storeIdsParam = selectedStoreIds.length > 0 ? `&storeIds=${selectedStoreIds.join(",")}` : "";
      const storeTypeParam = storeType ? `&storeType=${storeType}` : "";
      const res = await api.get<AdminDashboardEnvelope>(
        `/api/v1/admin/dashboard?range=${range}&groupBy=${groupBy}${storeIdsParam}${storeTypeParam}`
      );
      return res.data.data;
    },
    staleTime: 30000,
    placeholderData: (prev) => prev
  });

  const { data: ordersTrend } = useQuery<TrendItem[]>({
    queryKey: ["admin", "orders-trend", volumeRange, volumeGroupBy, volumeSelectedStoreIds, volumeStoreType],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const storeIdsParam = volumeSelectedStoreIds.length > 0 ? `&storeIds=${volumeSelectedStoreIds.join(",")}` : "";
      const storeTypeParam = volumeStoreType ? `&storeType=${volumeStoreType}` : "";
      const res = await api.get<TrendEnvelope>(
        `/api/v1/admin/dashboard/orders-trend?range=${volumeRange}&groupBy=${volumeGroupBy}${storeIdsParam}${storeTypeParam}`
      );
      return res.data.data;
    },
    staleTime: 30000,
    placeholderData: (prev) => prev
  });

  const { data: bookingsTrend } = useQuery<TrendItem[]>({
    queryKey: ["admin", "bookings-trend", volumeRange, volumeGroupBy, volumeSelectedStoreIds, volumeStoreType],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const storeIdsParam = volumeSelectedStoreIds.length > 0 ? `&storeIds=${volumeSelectedStoreIds.join(",")}` : "";
      const storeTypeParam = volumeStoreType ? `&storeType=${volumeStoreType}` : "";
      const res = await api.get<TrendEnvelope>(
        `/api/v1/admin/dashboard/bookings-trend?range=${volumeRange}&groupBy=${volumeGroupBy}${storeIdsParam}${storeTypeParam}`
      );
      return res.data.data;
    },
    staleTime: 30000,
    placeholderData: (prev) => prev
  });

  const ordersTrendData = Array.isArray(ordersTrend) ? ordersTrend : [];
  const bookingsTrendData = Array.isArray(bookingsTrend) ? bookingsTrend : [];

  const revenueDropdownStores = allStores.filter(store => !storeType || store.storeType === storeType);
  const volumeDropdownStores = allStores.filter(store => {
    if (volumeStoreType && volumeStoreType !== store.storeType) {
      return false;
    }
    return true;
  });



  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDateLabel = (dateStr: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      try {
        const date = new Date(dateStr);
        const formatted = date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
        return formatted === "Invalid Date" ? dateStr : formatted;
      } catch {
        return dateStr;
      }
    }
    return dateStr;
  };

  if (isLoading && !dashboard) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* KPI Skeleton Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              data-testid={idx === 1 ? "kpi-skeleton-orders" : idx === 2 ? "kpi-skeleton-revenue" : undefined}
              className="h-32 bg-white rounded-2xl border border-gorola-charcoal/5 p-6 space-y-4 shadow-sm"
            >
              <div className="h-4 w-24 bg-gorola-charcoal/10 rounded" />
              <div className="h-8 w-16 bg-gorola-charcoal/10 rounded" />
            </div>
          ))}
        </div>

        {/* Chart Skeleton */}
        <div
          data-testid="chart-skeleton"
          className="bg-white rounded-2xl border border-gorola-charcoal/5 p-6 space-y-4 shadow-sm"
        >
          <div className="h-6 w-48 bg-gorola-charcoal/10 rounded" />
          <div className="h-64 w-full bg-gorola-charcoal/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gorola-charcoal">Failed to load dashboard</h2>
        <p className="text-sm text-gorola-slate max-w-xs">
          Please check your connection or try refreshing the dashboard again.
        </p>
      </div>
    );
  }

  const maxRevenue = Math.max(...dashboard.weeklyRevenue.map((d) => d.revenue), 10);

  const formatYAxisLabel = (val: number): string => {
    if (val >= 1000) {
      return `₹${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
    }
    return `₹${Math.round(val)}`;
  };

  const gapClass = dashboard.weeklyRevenue.length > 20
    ? "gap-1 sm:gap-1.5"
    : dashboard.weeklyRevenue.length > 10
    ? "gap-2"
    : "gap-4";

  const barMaxWidthClass = dashboard.weeklyRevenue.length > 20
    ? "max-w-[8px] sm:max-w-[12px]"
    : dashboard.weeklyRevenue.length > 10
    ? "max-w-[16px]"
    : "max-w-[40px]";

  const shouldShowLabel = (idx: number, total: number): boolean => {
    if (total <= 10) return true;
    if (total <= 15) return idx % 2 === 0;
    if (total <= 24) return idx % 4 === 0 || idx === total - 1;
    return idx % 5 === 0 || idx === total - 1;
  };

  const chartTitle =
    range === "TODAY" ? "Hourly Revenue Today"
    : range === "WEEK" ? "Weekly System Revenue Trend"
    : range === "MONTH" ? "Monthly System Revenue Trend"
    : range === "YEAR" ? "Yearly System Revenue Trend"
    : "All-Time System Revenue Trend";

  const volumeChartTitle =
    volumeStoreType === "QUICK_COMMERCE"
      ? volumeRange === "TODAY" ? "Hourly Orders Today"
        : volumeRange === "WEEK" ? "Weekly System Orders Volume Trend"
        : volumeRange === "MONTH" ? "Monthly System Orders Volume Trend"
        : volumeRange === "YEAR" ? "Yearly System Orders Volume Trend"
        : "All-Time System Orders Volume Trend"
      : volumeStoreType === "BOOKING_COMMERCE"
      ? volumeRange === "TODAY" ? "Hourly Bookings Today"
        : volumeRange === "WEEK" ? "Weekly System Bookings Volume Trend"
        : volumeRange === "MONTH" ? "Monthly System Bookings Volume Trend"
        : volumeRange === "YEAR" ? "Yearly System Bookings Volume Trend"
        : "All-Time System Bookings Volume Trend"
      : volumeRange === "TODAY" ? "Hourly System Volume Today"
        : volumeRange === "WEEK" ? "Weekly System Volume Trend"
        : volumeRange === "MONTH" ? "Monthly System Volume Trend"
        : volumeRange === "YEAR" ? "Yearly System Volume Trend"
        : "All-Time System Volume Trend";

  const formatCountYAxisLabel = (val: number): string => {
    if (val % 1 === 0) {
      return String(val);
    }
    return val.toFixed(1);
  };

  const volumeData = (() => {
    if (volumeStoreType === "QUICK_COMMERCE") {
      return ordersTrendData.map((d) => ({ date: d.date, count: d.count, label: `${d.count} orders` }));
    }
    if (volumeStoreType === "BOOKING_COMMERCE") {
      return bookingsTrendData.map((d) => ({ date: d.date, count: d.count, label: `${d.count} bookings` }));
    }
    const maxLen = Math.max(ordersTrendData.length, bookingsTrendData.length);
    const combined: { date: string; count: number; label: string }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const o = ordersTrendData[i];
      const b = bookingsTrendData[i];
      const date = o?.date || b?.date || "";
      const oCount = o?.count || 0;
      const bCount = b?.count || 0;
      combined.push({
        date,
        count: oCount + bCount,
        label: `${oCount + bCount} total`
      });
    }
    return combined;
  })();

  const rawVolumeMax = Math.max(...volumeData.map((d) => d.count), 4);
  const volumeMax = rawVolumeMax % 2 === 0 ? rawVolumeMax : rawVolumeMax + 1;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header>
        <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">System Dashboard</h1>
        <p className="text-sm text-gorola-slate font-dm-sans">
          Real-time aggregated view of system activity and controls across all stores.
        </p>
      </header>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Total Orders Today */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Orders Today
            </span>
            <div className="h-8 w-8 bg-gorola-pine/10 rounded-xl flex items-center justify-center text-gorola-pine">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 data-testid="total-orders-today" className="text-2xl font-black text-gorola-charcoal">
              {dashboard.totalOrdersToday}
            </h3>
            <p className="text-xs text-gorola-slate mt-1">Orders placed today</p>
          </div>
        </div>

        {/* Total Revenue Today */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Total Revenue
            </span>
            <div className="h-8 w-8 bg-green-100 rounded-xl flex items-center justify-center text-green-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 data-testid="total-revenue-today" className="text-2xl font-black text-gorola-charcoal">
              {formatCurrency(dashboard.totalRevenueToday)}
            </h3>
            <p className="text-xs text-gorola-slate mt-1">Aggregated store earnings</p>
          </div>
        </div>

        {/* Active Buyers */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Active Buyers
            </span>
            <div className="h-8 w-8 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 data-testid="active-buyers" className="text-2xl font-black text-gorola-charcoal">
              {dashboard.totalActiveBuyers}
            </h3>
            <p className="text-xs text-gorola-slate mt-1">Verified user profiles</p>
          </div>
        </div>

        {/* Total Products */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Total Products
            </span>
            <div className="h-8 w-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 data-testid="total-products" className="text-2xl font-black text-gorola-charcoal">
              {dashboard.totalProducts}
            </h3>
            <p className="text-xs text-gorola-slate mt-1">Active catalog items</p>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Pending Ads
            </span>
            <div className="h-8 w-8 bg-red-100 rounded-xl flex items-center justify-center text-red-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 data-testid="pending-approvals" className="text-2xl font-black text-gorola-charcoal">
              {dashboard.pendingAdApprovalsCount}
            </h3>
            <p className="text-xs text-gorola-slate mt-1">Ads awaiting review</p>
          </div>
        </div>
      </div>

      {/* Main Section Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gorola-charcoal/10 p-4 sm:p-6 shadow-sm flex flex-col overflow-hidden">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal">
              {chartTitle}
            </h2>

            {/* Range + GroupBy + Store Type + Store Multiselect controls */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
              {/* Store Type Filter */}
              <div className="relative">
                <select
                  data-testid="revenue-store-type-select"
                  value={storeType || "ALL"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStoreType(val === "ALL" ? undefined : val as "QUICK_COMMERCE" | "BOOKING_COMMERCE");
                    setSelectedStoreIds([]); // clear selection
                  }}
                  className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 pr-6 sm:pr-8 text-[11px] sm:text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300"
                >
                  <option value="ALL">All Store Types</option>
                  <option value="QUICK_COMMERCE">Quick Commerce</option>
                  <option value="BOOKING_COMMERCE">Booking Commerce</option>
                </select>
                <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gorola-slate/60 text-[8px] sm:text-[10px]">▼</div>
              </div>

              {/* Store Picker Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStorePickerOpen(!storePickerOpen)}
                  className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-gorola-charcoal hover:bg-gorola-charcoal/10 focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300 flex items-center gap-1 sm:gap-2"
                  aria-label="Filter by store"
                >
                  <span>Filter by store</span>
                  {selectedStoreIds.length > 0 && (
                    <span className="bg-gorola-pine text-white text-[10px] px-1.5 py-0.5 rounded-full font-sans font-bold">
                      {selectedStoreIds.length}
                    </span>
                  )}
                  <span className="text-[10px]">▼</span>
                </button>

                {storePickerOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gorola-charcoal/10 rounded-xl shadow-lg z-30 p-3 space-y-2 max-h-60 overflow-y-auto">
                    <div className="flex justify-between items-center pb-2 border-b border-gorola-charcoal/5">
                      <span className="text-xs font-bold text-gorola-charcoal">Select Stores</span>
                      {selectedStoreIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedStoreIds([])}
                          className="text-[10px] text-gorola-pine hover:underline font-bold"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {revenueDropdownStores.map((store) => {
                        const isChecked = selectedStoreIds.includes(store.id);
                        return (
                          <label
                            key={store.id}
                            className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-gorola-mint/10 rounded-lg cursor-pointer text-xs text-gorola-charcoal font-semibold transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedStoreIds(selectedStoreIds.filter((id) => id !== store.id));
                                } else {
                                  setSelectedStoreIds([...selectedStoreIds, store.id]);
                                }
                              }}
                              className="rounded text-gorola-pine focus:ring-gorola-pine/20 h-4 w-4 cursor-pointer"
                            />
                            <span className="truncate">{store.name}</span>
                          </label>
                        );
                      })}
                      {revenueDropdownStores.length === 0 && (
                        <p className="text-xs text-gorola-slate/60 italic text-center py-2">
                          No stores available
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Range Select */}
              <div className="relative">
                <select
                  data-testid="analytics-range-select"
                  value={range}
                  onChange={(e) => {
                    const nextRange = e.target.value as "TODAY" | "WEEK" | "MONTH" | "YEAR" | "ALL";
                    setRange(nextRange);
                    if (nextRange === "TODAY") {
                      setGroupBy("HOURLY");
                    } else if (nextRange === "WEEK" || nextRange === "MONTH") {
                      setGroupBy("DAILY");
                    } else if (nextRange === "YEAR") {
                      setGroupBy("MONTHLY");
                    } else {
                      setGroupBy("YEARLY");
                    }
                  }}
                  className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 pr-6 sm:pr-8 text-[11px] sm:text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300"
                >
                  <option value="TODAY">Today</option>
                  <option value="WEEK">Last 7 Days</option>
                  <option value="MONTH">Last 30 Days</option>
                  <option value="YEAR">Current Year</option>
                  <option value="ALL">All Time</option>
                </select>
                <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gorola-slate/60 text-[8px] sm:text-[10px]">▼</div>
              </div>

              {/* GroupBy Select */}
              <div className="relative">
                <select
                  data-testid="analytics-groupby-select"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as "HOURLY" | "DAILY" | "MONTHLY" | "YEARLY")}
                  disabled={range === "TODAY"}
                  className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 pr-6 sm:pr-8 text-[11px] sm:text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {range === "TODAY" ? (
                    <option value="HOURLY">Hourly</option>
                  ) : (
                    <>
                      <option value="HOURLY">Hourly (Pattern)</option>
                      <option value="DAILY">Daily</option>
                      <option value="MONTHLY" disabled={range === "WEEK" || range === "MONTH"}>Monthly</option>
                      <option value="YEARLY" disabled={range !== "ALL"}>Yearly</option>
                    </>
                  )}
                </select>
                <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gorola-slate/60 text-[8px] sm:text-[10px]">▼</div>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="h-72 w-full flex items-stretch select-none mt-4">
            {/* Y-Axis scale */}
            <div className="flex flex-col justify-between h-[calc(100%-24px)] text-[9px] font-bold text-gorola-charcoal/80 pr-1.5 sm:pr-2.5 pb-2 text-right min-w-[35px] sm:min-w-[50px] border-r border-gorola-charcoal/20">
              <span>{formatYAxisLabel(maxRevenue)}</span>
              <span>{formatYAxisLabel(maxRevenue * 0.5)}</span>
              <span>{formatYAxisLabel(0)}</span>
            </div>

            {/* Bars container */}
            <div className="flex-1 h-full relative ml-1.5 sm:ml-3">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none h-[calc(100%-24px)] pb-2 pr-4">
                <div className="w-full border-t border-dashed border-gorola-charcoal/10" />
                <div className="w-full border-t border-dashed border-gorola-charcoal/10" />
                <div className="w-full border-b border-gorola-charcoal/20" />
              </div>

              <div className={`relative h-[calc(100%-24px)] w-full flex items-end ${gapClass} pr-4 z-10`}>
                {dashboard.weeklyRevenue.map((item, index) => {
                  const heightPct = maxRevenue > 0 && item.revenue > 0 ? (item.revenue / maxRevenue) * 94 + 6 : 6;
                  const isLatest = index === dashboard.weeklyRevenue.length - 1;
                  return (
                    <div key={item.date} className="relative flex-1 min-w-0 h-full flex flex-col justify-end items-center group">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`relative w-full ${barMaxWidthClass} rounded-t-sm transition-all duration-300 group-hover:opacity-90 ${
                          isLatest
                            ? "bg-gorola-saffron shadow-lg shadow-gorola-saffron/10"
                            : "bg-gorola-pine"
                        }`}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-[105%] left-1/2 -translate-x-1/2 bg-gorola-charcoal text-white text-xs py-1.5 px-3 rounded-lg font-bold transition-all duration-200 z-20 pointer-events-none shadow-md whitespace-nowrap">
                          {formatDateLabel(item.date)} • {formatCurrency(item.revenue)}
                        </div>
                      </div>
                      <span className={`absolute bottom-0 translate-y-full text-[9px] sm:text-[10px] text-gorola-charcoal/80 font-semibold whitespace-nowrap mt-1 ${
                        shouldShowLabel(index, dashboard.weeklyRevenue.length) ? "" : "invisible"
                      }`}>
                        {formatDateLabel(item.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Volume Trend Chart */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-4 sm:p-6 shadow-sm flex flex-col overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal">
              {volumeChartTitle}
            </h2>
          </div>

          {/* Range + GroupBy + Store Picker controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
            {/* Store Type Filter */}
            <div className="relative">
              <select
                data-testid="volume-store-type-select"
                value={volumeStoreType || "ALL"}
                onChange={(e) => {
                  const val = e.target.value;
                  setVolumeStoreType(val === "ALL" ? undefined : val as "QUICK_COMMERCE" | "BOOKING_COMMERCE");
                  setVolumeSelectedStoreIds([]); // clear selection
                }}
                className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 pr-6 sm:pr-8 text-[11px] sm:text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300"
              >
                <option value="ALL">All Store Types</option>
                <option value="QUICK_COMMERCE">Quick Commerce</option>
                <option value="BOOKING_COMMERCE">Booking Commerce</option>
              </select>
              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gorola-slate/60 text-[8px] sm:text-[10px]">▼</div>
            </div>
            {/* Store Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setVolumeStorePickerOpen(!volumeStorePickerOpen)}
                className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-gorola-charcoal hover:bg-gorola-charcoal/10 focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300 flex items-center gap-1 sm:gap-2"
                aria-label="Filter by store"
              >
                <span>Filter by store</span>
                {volumeSelectedStoreIds.length > 0 && (
                  <span className="bg-gorola-pine text-white text-[10px] px-1.5 py-0.5 rounded-full font-sans font-bold">
                    {volumeSelectedStoreIds.length}
                  </span>
                )}
                <span className="text-[10px]">▼</span>
              </button>

              {volumeStorePickerOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gorola-charcoal/10 rounded-xl shadow-lg z-30 p-3 space-y-2 max-h-60 overflow-y-auto">
                  <div className="flex justify-between items-center pb-2 border-b border-gorola-charcoal/5">
                    <span className="text-xs font-bold text-gorola-charcoal">Select Stores</span>
                    {volumeSelectedStoreIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setVolumeSelectedStoreIds([])}
                        className="text-[10px] text-gorola-pine hover:underline font-bold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {volumeDropdownStores.map((store) => {
                      const isChecked = volumeSelectedStoreIds.includes(store.id);
                      return (
                        <label
                          key={store.id}
                          className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-gorola-mint/10 rounded-lg cursor-pointer text-xs text-gorola-charcoal font-semibold transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setVolumeSelectedStoreIds(volumeSelectedStoreIds.filter((id) => id !== store.id));
                              } else {
                                setVolumeSelectedStoreIds([...volumeSelectedStoreIds, store.id]);
                              }
                            }}
                            className="rounded text-gorola-pine focus:ring-gorola-pine/20 h-4 w-4 cursor-pointer"
                          />
                          <span className="truncate">{store.name}</span>
                        </label>
                      );
                    })}
                    {volumeDropdownStores.length === 0 && (
                      <p className="text-xs text-gorola-slate/60 italic text-center py-2">
                        No stores available
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Range Select */}
            <div className="relative">
              <select
                data-testid="volume-range-select"
                value={volumeRange}
                onChange={(e) => {
                  const nextRange = e.target.value as "TODAY" | "WEEK" | "MONTH" | "YEAR" | "ALL";
                  setVolumeRange(nextRange);
                  if (nextRange === "TODAY") {
                    setVolumeGroupBy("HOURLY");
                  } else if (nextRange === "WEEK" || nextRange === "MONTH") {
                    setVolumeGroupBy("DAILY");
                  } else if (nextRange === "YEAR") {
                    setVolumeGroupBy("MONTHLY");
                  } else {
                    setVolumeGroupBy("YEARLY");
                  }
                }}
                className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 pr-6 sm:pr-8 text-[11px] sm:text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300"
              >
                <option value="TODAY">Today</option>
                <option value="WEEK">Last 7 Days</option>
                <option value="MONTH">Last 30 Days</option>
                <option value="YEAR">Current Year</option>
                <option value="ALL">All Time</option>
              </select>
              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gorola-slate/60 text-[8px] sm:text-[10px]">▼</div>
            </div>

            {/* GroupBy Select */}
            <div className="relative">
              <select
                data-testid="volume-groupby-select"
                value={volumeGroupBy}
                onChange={(e) => setVolumeGroupBy(e.target.value as "HOURLY" | "DAILY" | "MONTHLY" | "YEARLY")}
                disabled={volumeRange === "TODAY"}
                className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 pr-6 sm:pr-8 text-[11px] sm:text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {volumeRange === "TODAY" ? (
                  <option value="HOURLY">Hourly</option>
                ) : (
                  <>
                    <option value="HOURLY">Hourly (Pattern)</option>
                    <option value="DAILY">Daily</option>
                    <option value="MONTHLY" disabled={volumeRange === "WEEK" || volumeRange === "MONTH"}>Monthly</option>
                    <option value="YEARLY" disabled={volumeRange !== "ALL"}>Yearly</option>
                  </>
                )}
              </select>
              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gorola-slate/60 text-[8px] sm:text-[10px]">▼</div>
            </div>
          </div>
        </div>

        <div className="h-72 w-full flex items-stretch select-none mt-4">
          {/* Y-Axis scale */}
          <div className="flex flex-col justify-between h-[calc(100%-24px)] text-[9px] font-bold text-gorola-charcoal/80 pr-1.5 sm:pr-2.5 pb-2 text-right min-w-[20px] sm:min-w-[30px] border-r border-gorola-charcoal/20">
            <span>{formatCountYAxisLabel(volumeMax)}</span>
            <span>{formatCountYAxisLabel(volumeMax * 0.5)}</span>
            <span>0</span>
          </div>

          {/* Bars container */}
          <div className="flex-1 h-full relative ml-1.5 sm:ml-3">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none h-[calc(100%-24px)] pb-2 pr-4">
              <div className="w-full border-t border-dashed border-gorola-charcoal/10" />
              <div className="w-full border-t border-dashed border-gorola-charcoal/10" />
              <div className="w-full border-b border-gorola-charcoal/20" />
            </div>

            <div className={`relative h-[calc(100%-24px)] w-full flex items-end ${
              volumeData.length > 20
                ? "gap-1 sm:gap-1.5"
                : volumeData.length > 10
                ? "gap-2"
                : "gap-4"
            } pr-4 z-10`}>
              {volumeData.map((item, index) => {
                const heightPct = volumeMax > 0 && item.count > 0 ? (item.count / volumeMax) * 94 + 6 : 6;
                const isLatest = index === volumeData.length - 1;
                return (
                  <div key={item.date} className="relative flex-1 min-w-0 h-full flex flex-col justify-end items-center group">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`relative w-full ${
                        volumeData.length > 20
                          ? "max-w-[8px] sm:max-w-[12px]"
                          : volumeData.length > 10
                          ? "max-w-[16px]"
                          : "max-w-[40px]"
                      } rounded-t-sm transition-all duration-300 group-hover:opacity-90 ${
                        isLatest
                          ? "bg-gorola-saffron shadow-lg shadow-gorola-saffron/10"
                          : "bg-gorola-pine"
                      }`}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-[105%] left-1/2 -translate-x-1/2 bg-gorola-charcoal text-white text-xs py-1.5 px-3 rounded-lg font-bold transition-all duration-200 z-20 pointer-events-none shadow-md whitespace-nowrap">
                        {formatDateLabel(item.date)} • {item.label}
                      </div>
                    </div>
                    <span className={`absolute bottom-0 translate-y-full text-[9px] sm:text-[10px] text-gorola-charcoal/80 font-semibold whitespace-nowrap mt-1 ${
                      shouldShowLabel(index, volumeData.length) ? "" : "invisible"
                    }`}>
                      {formatDateLabel(item.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Platform Fees Settings Card */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2">
          Platform Fees Settings
        </h2>
        <p className="text-xs text-gorola-slate mb-6 font-dm-sans">
          Configure the delivery fees for quick commerce and service charges for bookings.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateSettingsMutation.mutate({
              deliveryCharge,
              serviceCharge
            });
            updateGlobalRiderEarningRateMutation.mutate(riderEarningRateGlobal);
          }}
          className="space-y-4 max-w-sm font-dm-sans"
        >
          <div className="space-y-1.5">
            <label htmlFor="delivery-charge-input" className="text-xs font-bold text-gorola-charcoal block">
              Delivery Charge (₹)
            </label>
            <input
              id="delivery-charge-input"
              type="text"
              value={deliveryCharge}
              onChange={(e) => setDeliveryCharge(e.target.value)}
              className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-4 py-2 text-sm text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine transition-all duration-300"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="service-charge-input" className="text-xs font-bold text-gorola-charcoal block">
              Service Charge (₹)
            </label>
            <input
              id="service-charge-input"
              type="text"
              value={serviceCharge}
              onChange={(e) => setServiceCharge(e.target.value)}
              className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-4 py-2 text-sm text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine transition-all duration-300"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rider-earning-rate-global" className="text-xs font-bold text-gorola-charcoal block">
              Default Rider Earning Rate (%)
            </label>
            <input
              id="rider-earning-rate-global"
              data-testid="rider-earning-rate-global"
              type="text"
              value={riderEarningRateGlobal}
              onChange={(e) => setRiderEarningRateGlobal(e.target.value)}
              className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-4 py-2 text-sm text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine transition-all duration-300"
            />
          </div>

          <button
            type="submit"
            disabled={updateSettingsMutation.isPending || updateGlobalRiderEarningRateMutation.isPending}
            className="bg-gorola-pine hover:bg-gorola-pine/90 text-white font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer transition-all duration-300 disabled:opacity-50"
          >
            {updateSettingsMutation.isPending || updateGlobalRiderEarningRateMutation.isPending ? "Saving..." : "Save Platform Fees"}
          </button>
        </form>
      </div>

      {/* Stores performance breakdown table */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-4">
          Per-Store Performance Breakdown
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/5">
                <th className="pb-3 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider">Store</th>
                <th className="pb-3 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider text-center">Orders Today</th>
                <th className="pb-3 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider text-center">Pending Orders</th>
                <th className="pb-3 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider text-right">Revenue Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gorola-charcoal/[0.03]">
              {dashboard.perStoreBreakdown.map((item) => (
                <tr key={item.storeId} className="hover:bg-gorola-mint/5 transition-colors">
                  <td className="py-4 font-semibold text-gorola-charcoal text-sm">
                    {item.storeName}
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-xs font-bold text-gorola-charcoal bg-gorola-mint/30 px-2.5 py-1 rounded-lg">
                      {item.ordersToday}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      item.pendingOrdersCount > 0 ? "bg-amber-100 text-amber-800" : "bg-gorola-mint/10 text-gorola-slate"
                    }`}>
                      {item.pendingOrdersCount}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-xs font-bold text-gorola-pine bg-gorola-pine/10 px-3 py-1.5 rounded-full">
                      {formatCurrency(item.revenueToday)}
                    </span>
                  </td>
                </tr>
              ))}
              {dashboard.perStoreBreakdown.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-sm text-gorola-slate/60 italic text-center py-8">
                    No active stores found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
