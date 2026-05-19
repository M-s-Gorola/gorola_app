import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Megaphone,
  Percent,
  ShoppingBag,
  TrendingUp} from "lucide-react";
import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/lib/api";

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

  const { data: dashboard, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["store", "dashboard"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API helper not initialized");
      }
      const res = await api.get<DashboardEnvelope>("/api/v1/store/dashboard");
      return res.data.data;
    },
    staleTime: 60000 // 60 seconds
  });

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDateLabel = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
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

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Today's Orders */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Today's Orders
            </span>
            <div className="h-8 w-8 bg-gorola-pine/10 rounded-xl flex items-center justify-center text-gorola-pine">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gorola-charcoal">{dashboard.todayOrderCount}</h3>
            <p className="text-xs text-gorola-slate mt-1">Orders placed today</p>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Today's Revenue
            </span>
            <div className="h-8 w-8 bg-green-100 rounded-xl flex items-center justify-center text-green-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gorola-charcoal">
              {formatCurrency(dashboard.todayRevenue)}
            </h3>
            <p className="text-xs text-gorola-slate mt-1">Confirmed + placed today</p>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-gorola-slate/60">
              Pending Orders
            </span>
            <div className="h-8 w-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gorola-charcoal">{dashboard.pendingOrdersCount}</h3>
            <p className="text-xs text-gorola-slate mt-1">Requiring action</p>
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
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gorola-charcoal/10 p-6 shadow-sm flex flex-col">
          <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-6">
            Weekly Revenue Trend
          </h2>
          {/* Custom SVG Bar Chart */}
          <div className="relative flex-1 min-h-[260px] flex items-end gap-4 w-full pt-6">
            {dashboard.weeklyRevenue.map((item, index) => {
              const barHeightPct = (item.revenue / maxRevenue) * 85 + 5; // bounds 5%-90%
              const isToday = index === dashboard.weeklyRevenue.length - 1;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center group h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-[90%] bg-gorola-charcoal text-white text-xs py-1.5 px-3 rounded-lg font-bold transition-all duration-200 z-10 pointer-events-none shadow-md">
                    Revenue: {formatCurrency(item.revenue)}
                  </div>
                  {/* The bar */}
                  <div
                    style={{ height: `${barHeightPct}%` }}
                    className={`w-full max-w-[40px] rounded-t-xl transition-all duration-300 group-hover:opacity-90 ${
                      isToday
                        ? "bg-gorola-saffron shadow-lg shadow-gorola-saffron/10"
                        : "bg-gorola-pine"
                    }`}
                  />
                  {/* Date label */}
                  <span className="text-[10px] text-gorola-slate/60 mt-3 font-semibold whitespace-nowrap">
                    {formatDateLabel(item.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Products List */}
        <div className="bg-white rounded-2xl border border-gorola-charcoal/10 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-4">
              Top Products
            </h2>
            <div className="space-y-4">
              {dashboard.topProducts.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between py-2 border-b border-gorola-charcoal/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full bg-gorola-mint flex items-center justify-center font-bold text-gorola-charcoal text-xs">
                      #{index + 1}
                    </span>
                    <span className="text-sm font-semibold text-gorola-charcoal truncate max-w-[160px]">
                      {dashboard.lowStockItems.some((ls) => ls.productName === item.name)
                        ? `${item.name}\u200b`
                        : item.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gorola-pine bg-gorola-pine/5 px-2.5 py-1 rounded-full whitespace-nowrap">
                    {item.soldCount} sold
                  </span>
                </div>
              ))}
              {dashboard.topProducts.length === 0 && (
                <p className="text-sm text-gorola-slate/60 italic text-center py-6">
                  No products sold in the last 30 days.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Layout Grid: Low Stock Alert panel */}
      {dashboard.lowStockItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center animate-bounce">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-gorola-charcoal">Low Stock Alerts</h2>
              <p className="text-xs text-gorola-slate">Variants below safety threshold.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.lowStockItems.map((item) => (
              <div
                key={`${item.productName}-${item.variantLabel}`}
                className="flex items-center justify-between p-4 rounded-xl bg-red-50/50 border border-red-100 hover:bg-red-50 transition-colors"
              >
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-gorola-charcoal">{item.productName}</h4>
                  <p className="text-xs text-gorola-slate">{item.variantLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">
                    Stock: {item.stockQty}
                  </span>
                  <button
                    onClick={() => navigate("/store/catalog")}
                    className="p-1.5 rounded-lg bg-white border border-gorola-charcoal/5 hover:border-gorola-pine/20 hover:text-gorola-pine transition-all shadow-sm"
                    aria-label="Restock variant"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
