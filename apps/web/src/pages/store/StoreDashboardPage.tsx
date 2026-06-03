import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Megaphone,
  Percent,
  ShoppingBag,
  TrendingUp} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
import { useAuthStore } from "@/store/auth.store";

type WeeklyRevenueItem = {
  date: string;
  revenue: number;
};

type TopProductItem = {
  name: string;
  soldCount: number;
};

type LowStockItem = {
  productName: string;
  variantLabel: string;
  stockQty: number;
};

type DashboardData = {
  todayOrderCount: number;
  todayRevenue: number;
  pendingOrdersCount: number;
  weeklyRevenue: WeeklyRevenueItem[];
  topProducts: TopProductItem[];
  lowStockItems: LowStockItem[];
  activeAdvertisementsCount: number;
  activeOffersCount: number;
};

type DashboardEnvelope = {
  success: boolean;
  data: DashboardData;
};

export function StoreDashboardPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);
  const storeId = useAuthStore((s) => s.storeId);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [range, setRange] = useState<"TODAY" | "WEEK" | "MONTH" | "YEAR" | "ALL">("WEEK");
  const [groupBy, setGroupBy] = useState<"HOURLY" | "DAILY" | "MONTHLY" | "YEARLY">("DAILY");

  useEffect(() => {
    if (!storeId || !accessToken) return;

    const host = window.location.hostname;
    const baseURL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${host}:3001`;
    
    const socket = io(baseURL, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("join_store", storeId);
    });

    const triggerRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] });
    };

    socket.on("store:new_order", () => {
      triggerRefresh();
    });

    socket.on("store:order_updated", () => {
      triggerRefresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [storeId, accessToken, queryClient]);

  const { data: storeProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["store", "profile"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: { storeType: string; isAcceptingOrders: boolean } }>("/api/v1/store/profile");
      return res.data.data;
    },
    enabled: !!storeId
  });

  const isBooking = storeProfile?.storeType === "BOOKING_COMMERCE";

  const handleToggleAvailability = async (newValue: boolean) => {
    if (!newValue) {
      setShowConfirmModal(true);
    } else {
      await updateAvailability(true);
    }
  };

  const updateAvailability = async (value: boolean) => {
    setIsUpdating(true);
    try {
      if (!api) throw new Error("API helper not initialized");
      await api.put("/api/v1/store/availability", { isAcceptingOrders: value });
      await queryClient.invalidateQueries({ queryKey: ["store", "profile"] });
    } catch (err) {
      console.error("Failed to update store availability", err);
    } finally {
      setIsUpdating(false);
      setShowConfirmModal(false);
    }
  };

  const { data: dashboard, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["store", "dashboard", range, groupBy],
    queryFn: async () => {
      if (!api) {
        throw new Error("API helper not initialized");
      }
      const res = await api.get<DashboardEnvelope>(`/api/v1/store/dashboard?range=${range}&groupBy=${groupBy}`);
      return res.data.data;
    },
    staleTime: 60000, // 60 seconds
    placeholderData: (prev) => prev
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div
            data-testid="kpi-skeleton-orders"
            className="h-32 bg-white rounded-2xl border border-gorola-charcoal/5 p-6 space-y-4"
          >
            <div className="h-4 w-24 bg-gorola-charcoal/10 rounded" />
            <div className="h-8 w-16 bg-gorola-charcoal/10 rounded" />
          </div>
          <div
            data-testid="kpi-skeleton-revenue"
            className="h-32 bg-white rounded-2xl border border-gorola-charcoal/5 p-6 space-y-4"
          >
            <div className="h-4 w-24 bg-gorola-charcoal/10 rounded" />
            <div className="h-8 w-32 bg-gorola-charcoal/10 rounded" />
          </div>
          <div className="h-32 bg-white rounded-2xl border border-gorola-charcoal/5 p-6 space-y-4">
            <div className="h-4 w-32 bg-gorola-charcoal/10 rounded" />
            <div className="h-8 w-12 bg-gorola-charcoal/10 rounded" />
          </div>
        </div>

        {/* Weekly Trend Skeleton */}
        <div
          data-testid="chart-skeleton"
          className="bg-white rounded-2xl border border-gorola-charcoal/5 p-6 space-y-4"
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

  // Calculate chart metrics
  const maxRevenue = Math.max(...dashboard.weeklyRevenue.map((d) => d.revenue), 1);

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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Dashboard</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Real-time insights and business metrics for your location.
          </p>
        </div>
      </header>

      {/* Store Availability Toggle Card */}
      {isLoadingProfile || !storeProfile ? (
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-4 w-full">
            <div className="h-12 w-12 bg-gorola-mint/10 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-gorola-mint/10 rounded w-1/3" />
              <div className="h-3 bg-gorola-mint/10 rounded w-2/3" />
            </div>
          </div>
          <div className="h-6 w-11 bg-gorola-mint/10 rounded-full shrink-0" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
              storeProfile?.isAcceptingOrders ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
            }`}>
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-gorola-charcoal flex items-center gap-2">
                Store Status:{" "}
                <span className={`text-sm px-2.5 py-0.5 rounded-full font-sans font-bold ${
                  storeProfile?.isAcceptingOrders ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                }`}>
                  {storeProfile?.isAcceptingOrders ? "Accepting Orders" : "Closed"}
                </span>
              </h2>
              <p className="text-xs text-gorola-slate font-dm-sans mt-0.5">
                {storeProfile?.isAcceptingOrders
                  ? "Your store is active, and products/services are visible to buyers on the app."
                  : "Your store is hidden. Buyers cannot browse or book your products/services."}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <button
              role="switch"
              aria-checked={storeProfile?.isAcceptingOrders ?? false}
              aria-label="Toggle store status"
              disabled={isUpdating || storeProfile === undefined}
              onClick={() => handleToggleAvailability(!storeProfile?.isAcceptingOrders)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                storeProfile?.isAcceptingOrders ? "bg-gorola-pine" : "bg-gorola-charcoal/20"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  storeProfile?.isAcceptingOrders ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Today's Orders / Bookings */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              {isBooking ? "Today's Bookings" : "Today's Orders"}
            </span>
            <div className="h-8 w-8 bg-gorola-pine/10 rounded-xl flex items-center justify-center text-gorola-pine">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gorola-charcoal">{dashboard.todayOrderCount}</h3>
            <p className="text-xs text-gorola-slate mt-1">
              {isBooking ? "Appointments today" : "Orders placed today"}
            </p>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              {isBooking ? "Today's Booking Revenue" : "Today's Revenue"}
            </span>
            <div className="h-8 w-8 bg-green-100 rounded-xl flex items-center justify-center text-green-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gorola-charcoal">
              {formatCurrency(dashboard.todayRevenue)}
            </h3>
            <p className="text-xs text-gorola-slate mt-1">
              {isBooking ? "Confirmed today" : "Confirmed + placed today"}
            </p>
          </div>
        </div>

        {/* Pending Orders / Approvals */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              {isBooking ? "Pending Approvals" : "Pending Orders"}
            </span>
            <div className="h-8 w-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gorola-charcoal">{dashboard.pendingOrdersCount}</h3>
            <p className="text-xs text-gorola-slate mt-1">
              {isBooking ? "Requiring approval" : "Requiring action"}
            </p>
          </div>
        </div>

        {/* Active Ads */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Active Ads
            </span>
            <div className="h-8 w-8 bg-gorola-pine/10 rounded-xl flex items-center justify-center text-gorola-pine">
              <Megaphone className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gorola-charcoal">
              {dashboard.activeAdvertisementsCount}
            </h3>
            <p className="text-xs text-gorola-slate mt-1">Promotional campaigns</p>
          </div>
        </div>

        {/* Active Offers */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Active Offers
            </span>
            <div className="h-8 w-8 bg-gorola-saffron/10 rounded-xl flex items-center justify-center text-gorola-saffron">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gorola-charcoal">{dashboard.activeOffersCount}</h3>
            <p className="text-xs text-gorola-slate mt-1">Discounts & campaigns</p>
          </div>
        </div>
      </div>

      {/* Main Panel layout Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Revenue Trend Chart */}
        <div className={`${isBooking ? "lg:col-span-3" : "lg:col-span-2"} bg-white rounded-2xl border border-gorola-charcoal/10 p-6 shadow-sm flex flex-col overflow-hidden`}>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal">
              {range === "TODAY"
                ? "Hourly Revenue Today"
                : range === "WEEK"
                ? "Weekly Revenue Trend"
                : range === "MONTH"
                ? "Monthly Revenue Trend"
                : range === "YEAR"
                ? "Yearly Revenue Trend"
                : "All-Time Revenue Trend"}
            </h2>
            
            {/* Elegant control panel */}
            <div className="flex items-center gap-3">
              {/* Range Select */}
              <div className="relative">
                <select
                  data-testid="analytics-range-select"
                  value={range}
                  onChange={(e) => {
                    const nextRange = e.target.value as "TODAY" | "WEEK" | "MONTH" | "YEAR" | "ALL";
                    setRange(nextRange);
                    // Guardrail: today forces Hourly. Other ranges default logically.
                    if (nextRange === "TODAY") {
                      setGroupBy("HOURLY");
                    } else if (nextRange === "WEEK" || nextRange === "MONTH") {
                      setGroupBy("DAILY");
                    } else if (nextRange === "YEAR") {
                      setGroupBy("MONTHLY");
                    } else if (nextRange === "ALL") {
                      setGroupBy("YEARLY");
                    }
                  }}
                  className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-4 py-2 pr-8 text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300"
                >
                  <option value="TODAY">Today</option>
                  <option value="WEEK">Last 7 Days</option>
                  <option value="MONTH">Last 30 Days</option>
                  <option value="YEAR">Current Year</option>
                  <option value="ALL">All Time</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gorola-slate/60 text-[10px]">▼</div>
              </div>

              {/* GroupBy Select */}
              <div className="relative">
                <select
                  data-testid="analytics-groupby-select"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as "HOURLY" | "DAILY" | "MONTHLY" | "YEARLY")}
                  disabled={range === "TODAY"}
                  className="appearance-none bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-4 py-2 pr-8 text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gorola-slate/60 text-[10px]">▼</div>
              </div>
            </div>
          </div>
          {/* Custom SVG Bar Chart */}
          <div className="flex-1 min-h-[260px] w-full select-none flex items-stretch mt-4">
            {/* Y-Axis Scale Labels */}
            <div className="flex flex-col justify-between h-[calc(100%-24px)] text-[9px] font-bold text-gorola-slate/40 pr-2.5 pb-2 select-none text-right min-w-[50px] border-r border-gorola-charcoal/5">
              <span>{formatYAxisLabel(maxRevenue)}</span>
              <span>{formatYAxisLabel(maxRevenue * 0.5)}</span>
              <span>{formatYAxisLabel(0)}</span>
            </div>

            {/* Chart Area with Gridlines & Bars */}
            <div className="flex-1 h-full relative ml-3">
              {/* Gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none h-[calc(100%-24px)] pb-2 pr-4">
                <div className="w-full border-t border-dashed border-gorola-charcoal/5" />
                <div className="w-full border-t border-dashed border-gorola-charcoal/5" />
                <div className="w-full border-b border-gorola-charcoal/10" />
              </div>

              {/* Bars container */}
              <div className={`relative h-[calc(100%-24px)] w-full flex items-end ${gapClass} pr-4 z-10`}>
                {dashboard.weeklyRevenue.map((item, index) => {
                  const barHeightPct = maxRevenue > 0 && item.revenue > 0 ? (item.revenue / maxRevenue) * 94 + 6 : 6;
                  const isToday = index === dashboard.weeklyRevenue.length - 1;
                  return (
                    <div key={item.date} className="relative flex-1 min-w-0 h-full flex flex-col justify-end items-center group">
                      {/* The bar */}
                      <div
                        style={{ height: `${barHeightPct}%` }}
                        className={`relative w-full ${barMaxWidthClass} rounded-t-sm transition-all duration-300 group-hover:opacity-90 ${
                          isToday
                            ? "bg-gorola-saffron shadow-lg shadow-gorola-saffron/10"
                            : "bg-gorola-pine"
                        }`}
                      >
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-[105%] left-1/2 -translate-x-1/2 bg-gorola-charcoal text-white text-xs py-1.5 px-3 rounded-lg font-bold transition-all duration-200 z-20 pointer-events-none shadow-md whitespace-nowrap">
                          {formatDateLabel(item.date)} • {formatCurrency(item.revenue)}
                        </div>
                      </div>

                      {/* Date label (absolutely positioned below baseline) */}
                      <span className={`absolute bottom-0 translate-y-full text-[9px] sm:text-[10px] text-gorola-slate/60 font-semibold whitespace-nowrap mt-1 select-none ${
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

        {/* Low Stock Alerts */}
        {!isBooking && (
          <div className={`bg-white rounded-2xl p-6 shadow-sm border flex flex-col justify-between ${
            dashboard.lowStockItems.length > 0 ? "border-red-200" : "border-gorola-charcoal/10"
          }`}>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  dashboard.lowStockItems.length > 0 ? "bg-red-50 text-red-500 animate-bounce" : "bg-emerald-50 text-emerald-600"
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold text-gorola-charcoal">Low Stock Alerts</h2>
                  <p className="text-xs text-gorola-slate font-dm-sans">Variants below safety threshold.</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
                {dashboard.lowStockItems.slice(0, 3).map((item) => (
                  <div
                    key={`${item.productName}-${item.variantLabel}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 border border-red-100 hover:bg-red-50 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                      <h4 className="text-sm font-bold text-gorola-charcoal truncate" title={item.productName}>
                        {item.productName}
                      </h4>
                      <p className="text-xs text-gorola-slate truncate" title={item.variantLabel}>
                        {item.variantLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Stock: {item.stockQty}
                      </span>
                      <button
                        onClick={() => navigate(`${getScopedPath("/store/products", "store", isSubdomainMode)}?search=${encodeURIComponent(item.productName)}`)}
                        className="p-1.5 rounded-lg bg-white border border-gorola-charcoal/5 hover:border-gorola-pine/20 hover:text-gorola-pine transition-all shadow-sm shrink-0"
                        aria-label="Restock variant"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {dashboard.lowStockItems.length > 0 && (
                  <button
                    onClick={() => navigate(`${getScopedPath("/store/products", "store", isSubdomainMode)}?lowStock=true`)}
                    className="w-full mt-2 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition-all border border-red-200/50 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    View All Alerts ({dashboard.lowStockItems.length})
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}

                {dashboard.lowStockItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                    <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-sm">
                      ✓
                    </div>
                    <p className="text-sm font-bold text-gorola-charcoal">All variants stocked!</p>
                    <p className="text-xs text-gorola-slate">No current alerts found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Selling Products / Services List */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-4">
          {isBooking ? "Top Performing Services" : "Top Performing Products"}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/5">
                <th className="pb-3 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider w-16">Rank</th>
                <th className="pb-3 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider">
                  {isBooking ? "Service Name" : "Product Name"}
                </th>
                <th className="pb-3 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider text-right">
                  {isBooking ? "Times Booked" : "Items Sold"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gorola-charcoal/[0.03]">
              {dashboard.topProducts.map((item, index) => (
                <tr key={item.name} className="hover:bg-gorola-mint/5 transition-colors">
                  <td className="py-4">
                    <span className="h-6 w-6 rounded-full bg-gorola-mint/50 border border-gorola-mint flex items-center justify-center font-bold text-gorola-charcoal text-xs">
                      #{index + 1}
                    </span>
                  </td>
                  <td className="py-4 font-semibold text-gorola-charcoal text-sm">
                    {dashboard.lowStockItems.some((ls) => ls.productName === item.name)
                      ? `${item.name}\u200b`
                      : item.name}
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-xs font-bold text-gorola-pine bg-gorola-pine/10 px-3 py-1.5 rounded-full">
                      {item.soldCount} {isBooking ? "booked" : "sold"}
                    </span>
                  </td>
                </tr>
              ))}
              {dashboard.topProducts.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-sm text-gorola-slate/60 italic text-center py-8">
                    {isBooking
                      ? "No services booked in the last 30 days."
                      : "No products sold in the last 30 days."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gorola-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl border border-gorola-charcoal/10 transform animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gorola-charcoal flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Store Closure
            </h3>
            <p className="text-sm text-gorola-slate font-dm-sans mt-3">
              Hiding your store will remove all your products from the buyer app. Are you sure?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={isUpdating}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 rounded-xl font-bold text-sm text-gorola-slate transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isUpdating}
                onClick={() => updateAvailability(false)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
              >
                {isUpdating ? "Confirming..." : "Yes, Hide Store"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
