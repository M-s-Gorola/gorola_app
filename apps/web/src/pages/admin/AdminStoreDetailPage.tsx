import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Layers,
  MapPin,
  Phone,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
  User,
  X,
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type StoreOwnerItem = {
  id: string;
  email: string;
  createdAt: string;
};

type StoreDetail = {
  id: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
  isActive: boolean;
  createdAt: string;
  revenue: number;
  productCount: number;
  orderCount: number;
  owners: StoreOwnerItem[];
  riderEarningRatePct?: number | null;
};

type StoreDetailResponse = {
  success: boolean;
  data: StoreDetail;
};

type StoreOrder = {
  id: string;
  orderNumber: string;
  status: string;
  orderType: "QUICK" | "BOOKING";
  createdAt: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  paymentMethod: string;
  storeName: string;
  storeId: string;
  userName: string;
  userMaskedPhone: string;
  riderName?: string | null;
  itemCount: number;
};

type PaginatedStoreOrdersResponse = {
  items: StoreOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type OrderDetailResponse = {
  id: string;
  status: string;
  orderType: "QUICK" | "BOOKING";
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  landmarkDescription: string;
  flatRoom?: string | null;
  createdAt: string;
  buyerMaskedPhone: string;
  user?: { name?: string | null; phone?: string | null };
  store: { name: string; phone?: string };
  discountSavingAmount?: string | number | null;
  offerSavingAmount?: string | number | null;
  appliedDiscountCode?: string | null;
  appliedOfferTitle?: string | null;
  discount?: {
    amount: string;
    code: string | null;
    appliedDiscountAmount?: string;
    appliedOfferAmount?: string;
  } | null;
  items: {
    id: string;
    productName: string;
    variantLabel: string;
    price: number;
    quantity: number;
  }[];
  statusHistory?: {
    id: string;
    status: string;
    note?: string | null;
    changedBy: string;
    changedAt: string;
  }[];
  riderName?: string | null;
};

export function AdminStoreDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSubdomainMode } = resolveSubdomain(typeof window !== "undefined" ? window.location.hostname : "");

  const [riderEarningRate, setRiderEarningRate] = useState<string>("");

  // Orders Pagination & Filter State
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string>("");

  // Modal State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: store, isLoading, isError, isFetching, refetch } = useQuery<StoreDetail>({
    queryKey: ["admin", "store-detail", id],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<StoreDetailResponse>(`/api/v1/admin/stores/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  // Fetch Paginated Store Orders
  const {
    data: ordersData,
    isLoading: isOrdersLoading,
    isFetching: isOrdersFetching,
    refetch: refetchOrders
  } = useQuery<PaginatedStoreOrdersResponse>({
    queryKey: ["admin", "store-orders", id, ordersPage, ordersStatusFilter],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const params = new URLSearchParams({
        page: String(ordersPage),
        limit: "10"
      });
      if (ordersStatusFilter) {
        params.append("status", ordersStatusFilter);
      }
      const res = await api.get<{ success: boolean; data: PaginatedStoreOrdersResponse }>(
        `/api/v1/admin/stores/${id}/orders?${params.toString()}`
      );
      return res.data.data;
    },
    enabled: Boolean(id),
    staleTime: 5000
  });

  // Fetch Specific Order Details for Modal Breakdown
  const {
    data: orderDetail,
    isLoading: isOrderDetailLoading
  } = useQuery<OrderDetailResponse>({
    queryKey: ["admin", "order-detail", selectedOrderId],
    queryFn: async () => {
      if (!api || !selectedOrderId) throw new Error("API or Order ID not set");
      const res = await api.get<{ success: boolean; data: OrderDetailResponse }>(
        `/api/v1/admin/orders/${selectedOrderId}`
      );
      return res.data.data;
    },
    enabled: Boolean(selectedOrderId),
    staleTime: 10000
  });

  useEffect(() => {
    if (store) {
      setRiderEarningRate(store.riderEarningRatePct !== null && store.riderEarningRatePct !== undefined ? String(store.riderEarningRatePct) : "");
    }
  }, [store]);

  const updateRiderRateMutation = useMutation({
    mutationFn: async (rate: number | null) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put<{ success: boolean; data: unknown }>(`/api/v1/admin/stores/${id}/rider-earning-rate`, {
        riderEarningRatePct: rate
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Rider earning rate override updated successfully");
      void queryClient.invalidateQueries({ queryKey: ["admin", "store-detail", id] });
    },
    onError: () => {
      toast.error("Failed to update store rider earning rate");
    }
  });

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR"
    }).format(val);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gorola-charcoal/10 rounded-xl w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
          <div className="h-28 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
          <div className="h-28 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
        </div>
        <div className="h-96 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
      </div>
    );
  }

  if (isError || !store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load store details</h2>
        <div className="flex gap-3">
          <button onClick={() => navigate(getScopedPath("/admin/stores", "admin", isSubdomainMode))} className="px-4 py-2 border border-gorola-charcoal/10 rounded-xl text-sm font-bold text-gorola-slate">
            Back to List
          </button>
          <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Breadcrumb */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate(getScopedPath("/admin/stores", "admin", isSubdomainMode))}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gorola-pine hover:text-gorola-pine-dark uppercase tracking-wider transition-all mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Stores
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">{store.name}</h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                store.isActive
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                  : "bg-rose-100 text-rose-800 border-rose-200/50"
              }`}
            >
              {store.isActive ? "Active" : "Suspended"}
            </span>
          </div>
          <p className="text-sm text-gorola-slate font-dm-sans">{store.description || "No description provided."}</p>
        </div>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
          Refresh Details
        </button>
      </header>

      {/* Metrics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gorola-pine/10 border border-gorola-pine/20 flex items-center justify-center text-gorola-pine">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-2xl font-bold text-gorola-charcoal mt-1">{formatCurrency(store.revenue)}</h3>
          </div>
        </div>

        <div className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100/60 border border-amber-200/50 flex items-center justify-center text-amber-700">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wider">Completed Orders</p>
            <h3 className="text-2xl font-bold text-gorola-charcoal mt-1">{store.orderCount}</h3>
          </div>
        </div>

        <div className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wider">Total Products</p>
            <h3 className="text-2xl font-bold text-gorola-charcoal mt-1">{store.productCount}</h3>
          </div>
        </div>
      </section>

      {/* Detail Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unified Store Information (Profile + Owners) */}
        <section className="lg:col-span-2 bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal border-b border-gorola-charcoal/5 pb-3">
              Store Information
            </h2>

            {/* Profile Attributes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gorola-slate shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Registered On</p>
                  <p className="text-sm font-semibold text-gorola-charcoal mt-0.5">
                    {new Date(store.createdAt).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Layers className="h-5 w-5 text-gorola-slate shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Commerce Type</p>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border mt-1 ${
                      store.storeType === "QUICK_COMMERCE"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                        : "bg-amber-100 text-amber-800 border-amber-200/50"
                    }`}
                  >
                    {store.storeType === "QUICK_COMMERCE" ? "Quick Commerce" : "Booking Commerce"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gorola-slate shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Phone Number</p>
                  <p className="text-sm font-semibold text-gorola-charcoal mt-0.5">{store.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gorola-slate shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Landmark Address</p>
                  <p className="text-sm font-semibold text-gorola-charcoal mt-0.5">{store.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Store Owners Sub-section */}
          <div className="border-t border-gorola-charcoal/5 pt-5 space-y-3">
            <h3 className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
              Store Owners
            </h3>

            {store.owners.length === 0 ? (
              <p className="text-xs text-gorola-slate italic">No store owners registered.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {store.owners.map((owner) => (
                  <div
                    key={owner.id}
                    className="flex items-center gap-3 bg-gorola-charcoal/[0.02] border border-gorola-charcoal/5 rounded-xl p-3"
                  >
                    <div className="h-8 w-8 rounded-full bg-gorola-pine/10 flex items-center justify-center text-gorola-pine shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gorola-charcoal truncate">{owner.email}</p>
                      <p className="text-[10px] text-gorola-slate mt-0.5">
                        Created: {new Date(owner.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Rider Earning Rate Override */}
        <section className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal border-b border-gorola-charcoal/5 pb-3">
              Rider Earning Rate Override
            </h2>
            <p className="text-xs text-gorola-slate font-dm-sans leading-relaxed pt-3">
              Specify a custom percentage rate of the delivery charge that riders for this store will receive. Leave blank to inherit the global rate.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = riderEarningRate.trim() === "" ? null : Number(riderEarningRate);
              if (value !== null && (isNaN(value) || value < 0)) {
                toast.error("Please enter a valid percentage rate");
                return;
              }
              updateRiderRateMutation.mutate(value);
            }}
            className="space-y-4 font-dm-sans pt-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="store-rider-earning-rate-input" className="text-xs font-bold text-gorola-charcoal block">
                Store Earning Rate (%)
              </label>
              <input
                id="store-rider-earning-rate-input"
                data-testid="store-rider-earning-rate-input"
                type="text"
                value={riderEarningRate}
                onChange={(e) => setRiderEarningRate(e.target.value)}
                className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-4 py-2 text-sm text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine transition-all duration-300"
                placeholder="e.g. 90"
              />
            </div>

            <button
              type="submit"
              disabled={updateRiderRateMutation.isPending}
              className="w-full bg-gorola-pine hover:bg-gorola-pine/90 text-white font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer transition-all duration-300 disabled:opacity-50"
            >
              {updateRiderRateMutation.isPending ? "Saving..." : "Save Earning Rate"}
            </button>
          </form>
        </section>
      </div>

      {/* Paginated Store Orders Section */}
      <div className="bg-white border border-gorola-charcoal/10 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gorola-charcoal/10 pb-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-gorola-pine" />
            <h2 className="text-lg font-black text-gorola-charcoal">Store Orders & Transactions</h2>
            {ordersData && (
              <span className="px-2.5 py-0.5 bg-gorola-charcoal/5 rounded-full text-xs font-bold text-gorola-slate ml-2">
                {ordersData.total}
              </span>
            )}
          </div>

          {/* Status Filter & Refresh */}
          <div className="flex items-center gap-3">
            <select
              value={ordersStatusFilter}
              onChange={(e) => {
                setOrdersStatusFilter(e.target.value);
                setOrdersPage(1);
              }}
              data-testid="store-orders-status-filter"
              aria-label="Filter store orders by status"
              className="px-3 py-1.5 bg-white border border-gorola-charcoal/10 rounded-xl text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
            >
              <option value="">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="PREPARING">Preparing</option>
              <option value="PLACED">Placed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <button
              type="button"
              onClick={() => void refetchOrders()}
              disabled={isOrdersFetching}
              className="p-2 border border-gorola-charcoal/10 hover:border-gorola-pine/20 rounded-xl text-gorola-slate transition-all disabled:opacity-50"
              aria-label="Refresh store orders"
            >
              <RefreshCw className={`h-4 w-4 text-gorola-pine ${isOrdersFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Store Orders Table */}
        <div className="overflow-x-auto" data-testid="store-orders-table">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/10 bg-gorola-charcoal/[0.02]">
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Order ID</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Customer</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Status</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Rider</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Items</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Total</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Date</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gorola-charcoal/5">
              {isOrdersLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-gorola-slate">
                    Loading store orders...
                  </td>
                </tr>
              ) : !ordersData || ordersData.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-gorola-slate">
                    No order records found for this store.
                  </td>
                </tr>
              ) : (
                ordersData.items.map((order) => (
                  <tr key={order.id} className="hover:bg-gorola-charcoal/[0.01] transition-colors">
                    <td className="p-3 font-mono font-bold text-xs text-gorola-charcoal whitespace-nowrap">
                      #{order.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <p className="text-xs font-bold text-gorola-charcoal">{order.userName}</p>
                      <p className="text-[10px] font-mono text-gorola-slate">{order.userMaskedPhone}</p>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          order.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                            : order.status === "CANCELLED"
                            ? "bg-rose-100 text-rose-800 border-rose-200/50"
                            : "bg-amber-100 text-amber-800 border-amber-200/50"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gorola-charcoal whitespace-nowrap font-medium">
                      {order.riderName || "—"}
                    </td>
                    <td className="p-3 text-xs text-gorola-slate whitespace-nowrap font-medium">
                      {order.itemCount} items
                    </td>
                    <td className="p-3 text-xs font-black text-gorola-charcoal whitespace-nowrap">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="p-3 text-xs text-gorola-slate whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        data-testid={`view-store-order-${order.id}`}
                        onClick={() => setSelectedOrderId(order.id)}
                        className="px-2.5 py-1 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-lg text-xs font-bold text-gorola-pine shadow-sm transition-all"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {ordersData && ordersData.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gorola-charcoal/10">
            <p className="text-xs text-gorola-slate">
              Showing page <span className="font-bold">{ordersData.page}</span> of{" "}
              <span className="font-bold">{ordersData.totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={ordersPage <= 1}
                onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-gorola-charcoal/10 rounded-lg text-gorola-slate hover:text-gorola-charcoal disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={ordersPage >= ordersData.totalPages}
                onClick={() => setOrdersPage((p) => Math.min(ordersData.totalPages, p + 1))}
                className="p-1.5 border border-gorola-charcoal/10 rounded-lg text-gorola-slate hover:text-gorola-charcoal disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Breakdown Modal */}
      {selectedOrderId && (
        <div
          data-testid="store-order-details-modal"
          className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gorola-charcoal/10 pb-4">
              <div className="space-y-1">
                <span
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full ${
                    orderDetail?.status === "DELIVERED"
                      ? "bg-emerald-100 text-emerald-800"
                      : orderDetail?.status === "CANCELLED"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {orderDetail?.status || "LOADING..."}
                </span>
                <h2 className="text-xl font-black text-gorola-charcoal font-mono">
                  #{selectedOrderId}
                </h2>
                {orderDetail && (
                  <p className="text-xs text-gorola-slate">
                    Placed on: {new Date(orderDetail.createdAt).toLocaleString("en-IN")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="p-2 rounded-full hover:bg-gorola-charcoal/5 text-gorola-slate hover:text-gorola-charcoal transition-colors"
                aria-label="Close order details modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isOrderDetailLoading || !orderDetail ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-4">
                <RefreshCw className="h-8 w-8 text-gorola-pine animate-spin" />
                <span className="text-sm text-gorola-slate">Retrieving detailed records...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Information & Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                      Information
                    </h3>
                    <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="h-4 w-4 text-gorola-slate" />
                        <div>
                          <p className="text-[10px] text-gorola-slate font-bold">Store</p>
                          <p className="text-xs font-black text-gorola-charcoal">{orderDetail.store.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-gorola-slate" />
                        <div>
                          <p className="text-[10px] text-gorola-slate font-bold">Buyer Profile</p>
                          <p className="text-xs font-black text-gorola-charcoal">
                            {orderDetail.user?.name?.trim() || "Registered User"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gorola-slate" />
                        <div>
                          <p className="text-[10px] text-gorola-slate font-bold">Buyer Contact</p>
                          <p className="text-xs font-black text-gorola-charcoal">{orderDetail.buyerMaskedPhone}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-gorola-slate mt-0.5" />
                        <div>
                          <p className="text-[10px] text-gorola-slate font-bold">Delivery Address</p>
                          <p className="text-xs font-black text-gorola-charcoal">
                            {orderDetail.flatRoom ? `${orderDetail.flatRoom}, ` : ""}
                            {orderDetail.landmarkDescription}
                          </p>
                        </div>
                      </div>

                      {orderDetail.riderName && (
                        <div className="flex items-center gap-3">
                          <Truck className="h-4 w-4 text-gorola-slate" />
                          <div>
                            <p className="text-[10px] text-gorola-slate font-bold">Assigned Rider</p>
                            <p className="text-xs font-black text-gorola-charcoal">{orderDetail.riderName}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Audit Timeline */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                      Audit Timeline
                    </h3>
                    <div className="relative pl-6 space-y-4 border-l border-gorola-mint/15">
                      {orderDetail.statusHistory?.map((hist, idx) => (
                        <div key={hist.id} className="relative">
                          <span
                            className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ${
                              idx === orderDetail.statusHistory!.length - 1
                                ? "bg-gorola-pine scale-125"
                                : "bg-gorola-mint"
                            }`}
                          />
                          <p className="text-xs font-black text-gorola-charcoal">
                            {hist.note?.toLowerCase().includes("accepted by")
                              ? (orderDetail.orderType === "BOOKING" ? "Booking Accepted" : "Order Accepted")
                              : hist.status}
                          </p>
                          <p className="text-[10px] text-gorola-slate mt-0.5">
                            By {hist.changedBy} at {new Date(hist.changedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                            {hist.note && !hist.note.toLowerCase().includes("accepted by") && !hist.note.toLowerCase().startsWith("order placed") && ` - ${hist.note}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Items Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                    Items Breakdown
                  </h3>
                  <div className="border border-gorola-charcoal/10 rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15 text-xs font-black text-gorola-charcoal uppercase">
                          <th className="p-3">Product</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Price</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {orderDetail.items.map((item) => (
                          <tr key={item.id} className="border-b border-gorola-charcoal/5 last:border-0">
                            <td className="p-3">
                              <p className="font-black text-gorola-charcoal">{item.productName}</p>
                              <p className="text-[10px] text-gorola-slate">{item.variantLabel}</p>
                            </td>
                            <td className="p-3 text-center font-bold text-gorola-charcoal">{item.quantity}</td>
                            <td className="p-3 text-right text-gorola-slate">{formatCurrency(item.price)}</td>
                            <td className="p-3 text-right font-black text-gorola-charcoal">
                              {formatCurrency(item.price * item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Calculations */}
                <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs text-gorola-slate">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatCurrency(orderDetail.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gorola-slate">
                    <span>{orderDetail.orderType === "BOOKING" ? "Service Fee" : "Delivery Fee"}</span>
                    <span className="font-semibold">{formatCurrency(orderDetail.deliveryFee)}</span>
                  </div>
                  {(() => {
                    const discountSaving = Number(orderDetail.discountSavingAmount || 0);
                    const offerSaving = Number(orderDetail.offerSavingAmount || 0);
                    const fallbackDiscount = Number(orderDetail.discount?.amount || 0);
                    const hasStored =
                      (orderDetail.discountSavingAmount !== undefined && orderDetail.discountSavingAmount !== null) ||
                      (orderDetail.offerSavingAmount !== undefined && orderDetail.offerSavingAmount !== null);

                    if (hasStored) {
                      if (discountSaving <= 0 && offerSaving <= 0) return null;
                      return (
                        <div className="space-y-1" data-testid="store-order-discount">
                          {offerSaving > 0 && (
                            <div className="flex justify-between items-center text-xs text-rose-600 font-bold">
                              <span>Offer {orderDetail.appliedOfferTitle ? `(${orderDetail.appliedOfferTitle})` : ""}</span>
                              <span>-{formatCurrency(offerSaving)}</span>
                            </div>
                          )}
                          {discountSaving > 0 && (
                            <div className="flex justify-between items-center text-xs text-rose-600 font-bold">
                              <span>Discount {orderDetail.appliedDiscountCode ? `(${orderDetail.appliedDiscountCode})` : ""}</span>
                              <span>-{formatCurrency(discountSaving)}</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (fallbackDiscount > 0) {
                      return (
                        <div className="space-y-1" data-testid="store-order-discount">
                          <div className="flex justify-between items-center text-xs text-rose-600 font-bold">
                            <span>Discount {orderDetail.discount?.code ? `(${orderDetail.discount.code})` : ""}</span>
                            <span>-{formatCurrency(fallbackDiscount)}</span>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()}
                  <div className="flex justify-between items-center text-sm font-black text-gorola-charcoal border-t border-gorola-charcoal/5 pt-2">
                    <span>Grand Total</span>
                    <span>{formatCurrency(orderDetail.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
