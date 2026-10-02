import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
  User,
  X
} from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type RiderStoreRelation = {
  storeId: string;
  isPrimary: boolean;
  storeName: string;
  storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
};

type RiderDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  maskedPhone: string;
  riderType: "DELIVERY" | "FIELD_TECHNICIAN";
  isActive: boolean;
  primaryStoreId: string | null;
  primaryStoreName: string | null;
  stores: RiderStoreRelation[];
  totalDeliveries: number;
  totalEarnings: number;
  createdAt: string;
  updatedAt: string;
};

type RiderOrder = {
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
  itemCount: number;
};

type PaginatedOrdersResponse = {
  items: RiderOrder[];
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

export function AdminRiderDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSubdomainMode } = resolveSubdomain(typeof window !== "undefined" ? window.location.hostname : "");

  // Orders Pagination & Filter State
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string>("");

  // Modal states
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [confirmStatusModalOpen, setConfirmStatusModalOpen] = useState(false);

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR"
    }).format(val);
  };

  // 1. Fetch Rider Profile Detail
  const {
    data: rider,
    isLoading: isRiderLoading,
    isError: isRiderError
  } = useQuery<RiderDetail>({
    queryKey: ["admin", "rider-detail", id],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: RiderDetail }>(
        `/api/v1/admin/riders/${id}`
      );
      return res.data.data;
    },
    enabled: Boolean(id),
    staleTime: 10000
  });

  // 2. Fetch Paginated Rider Orders
  const {
    data: ordersData,
    isLoading: isOrdersLoading,
    isFetching: isOrdersFetching,
    refetch: refetchOrders
  } = useQuery<PaginatedOrdersResponse>({
    queryKey: ["admin", "rider-orders", id, ordersPage, ordersStatusFilter],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const params = new URLSearchParams({
        page: String(ordersPage),
        limit: "10"
      });
      if (ordersStatusFilter) {
        params.append("status", ordersStatusFilter);
      }
      const res = await api.get<{ success: boolean; data: PaginatedOrdersResponse }>(
        `/api/v1/admin/riders/${id}/orders?${params.toString()}`
      );
      return res.data.data;
    },
    enabled: Boolean(id),
    staleTime: 5000
  });

  // 3. Fetch Specific Order Details for Modal Breakdown
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

  // 4. Mutation to Toggle Rider Active Status
  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!api || !id || !rider) throw new Error("Missing dependencies");
      const res = await api.put<{ success: boolean; data: unknown }>(
        `/api/v1/admin/riders/${id}`,
        {
          isActive: !rider.isActive
        }
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success(
        rider?.isActive
          ? "Rider partner account suspended successfully"
          : "Rider partner account activated successfully"
      );
      setConfirmStatusModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "rider-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "riders"] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { message?: string } } };
      toast.error(errorObj?.response?.data?.message || "Failed to update rider status");
    }
  });

  if (isRiderLoading) {
    return (
      <div className="space-y-6 animate-pulse" data-testid="rider-detail-loading">
        <div className="h-6 w-36 bg-gorola-charcoal/10 rounded-lg" />
        <div className="h-44 bg-white rounded-3xl border border-gorola-charcoal/10" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white rounded-3xl border border-gorola-charcoal/10" />
          <div className="h-64 bg-white rounded-3xl border border-gorola-charcoal/10" />
        </div>
      </div>
    );
  }

  if (isRiderError || !rider) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-rose-500" />
        <h2 className="text-xl font-black text-gorola-charcoal">Rider partner not found</h2>
        <p className="text-sm text-gorola-slate max-w-sm">
          The requested rider record does not exist or has been removed from the platform.
        </p>
        <button
          onClick={() => navigate(getScopedPath("/admin/riders", "admin", isSubdomainMode))}
          className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-xs font-bold"
        >
          Back to Platform Riders
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-sans">
      {/* Navigation Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(getScopedPath("/admin/riders", "admin", isSubdomainMode))}
          className="inline-flex items-center gap-2 text-xs font-bold text-gorola-slate hover:text-gorola-charcoal transition-colors"
          data-testid="back-to-riders-button"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Platform Riders</span>
        </button>
      </div>

      {/* Rider Overview Profile Card */}
      <div className="bg-white border border-gorola-charcoal/10 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gorola-charcoal/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gorola-pine/10 border border-gorola-pine/20 flex items-center justify-center text-gorola-pine font-black text-xl">
              {rider.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-gorola-charcoal" data-testid="rider-display-name">
                  {rider.name}
                </h1>
                <span
                  data-testid="rider-type-badge"
                  className={`px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase rounded-full border ${
                    rider.riderType === "DELIVERY"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200/60"
                      : "bg-purple-100 text-purple-800 border-purple-200/60"
                  }`}
                >
                  {rider.riderType === "DELIVERY" ? "Delivery" : "Technician"}
                </span>
                <span
                  data-testid="rider-status-badge"
                  className={`px-3 py-1 text-[11px] font-black tracking-wider uppercase rounded-full ${
                    rider.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {rider.isActive ? "Active" : "Suspended"}
                </span>
              </div>
              <p className="text-xs text-gorola-slate font-medium mt-1">Rider ID: {rider.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfirmStatusModalOpen(true)}
              data-testid="toggle-rider-status-button"
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${
                rider.isActive
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {rider.isActive ? "Suspend Rider" : "Activate Rider"}
            </button>
          </div>
        </div>

        {/* Profile Info Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
            <Phone className="h-5 w-5 text-gorola-slate" />
            <div>
              <p className="text-[10px] uppercase font-black text-gorola-slate/70">Phone Number</p>
              <p className="text-sm font-black text-gorola-charcoal" data-testid="rider-phone">
                {rider.maskedPhone}
              </p>
            </div>
          </div>

          <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-gorola-slate" />
            <div>
              <p className="text-[10px] uppercase font-black text-gorola-slate/70">Email Address</p>
              <p className="text-sm font-mono font-bold text-gorola-charcoal" data-testid="rider-email">
                {rider.email}
              </p>
            </div>
          </div>

          <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-gorola-slate" />
            <div>
              <p className="text-[10px] uppercase font-black text-gorola-slate/70">Total Deliveries</p>
              <p className="text-sm font-black text-gorola-charcoal" data-testid="rider-total-deliveries">
                {rider.totalDeliveries}
              </p>
            </div>
          </div>

          <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-[10px] uppercase font-black text-gorola-slate/70">Total Earnings</p>
              <p className="text-sm font-black text-emerald-700" data-testid="rider-total-earnings">
                {formatCurrency(rider.totalEarnings)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Stores Section */}
      <div className="bg-white border border-gorola-charcoal/10 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gorola-charcoal/10 pb-4">
          <div className="flex items-center gap-2">
            <StoreIcon className="h-5 w-5 text-gorola-pine" />
            <h2 className="text-lg font-black text-gorola-charcoal">Assigned Stores</h2>
          </div>
          <span className="text-xs font-bold text-gorola-slate">
            {rider.stores.length} {rider.stores.length === 1 ? "Store" : "Stores"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rider.stores.length === 0 ? (
            <p className="text-xs text-gorola-slate italic py-4 col-span-full">No stores currently assigned.</p>
          ) : (
            rider.stores.map((s) => (
              <div
                key={s.storeId}
                className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-black text-gorola-charcoal">{s.storeName}</h4>
                  <p className="text-[10px] font-bold text-gorola-slate uppercase mt-0.5">
                    {s.storeType === "QUICK_COMMERCE" ? "Quick Commerce" : "Booking Commerce"}
                  </p>
                </div>
                {s.isPrimary && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-full border border-blue-200">
                    Primary Store
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Paginated Rider Deliveries Section */}
      <div className="bg-white border border-gorola-charcoal/10 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gorola-charcoal/10 pb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-gorola-pine" />
            <h2 className="text-lg font-black text-gorola-charcoal">Fulfillment & Delivery History</h2>
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
              data-testid="rider-orders-status-filter"
              aria-label="Filter deliveries by status"
              className="px-3 py-1.5 bg-white border border-gorola-charcoal/10 rounded-xl text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
            >
              <option value="">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="PREPARING">Preparing</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <button
              type="button"
              onClick={() => void refetchOrders()}
              disabled={isOrdersFetching}
              className="p-2 border border-gorola-charcoal/10 hover:border-gorola-pine/20 rounded-xl text-gorola-slate transition-all disabled:opacity-50"
              aria-label="Refresh deliveries"
            >
              <RefreshCw className={`h-4 w-4 text-gorola-pine ${isOrdersFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Deliveries Table */}
        <div className="overflow-x-auto" data-testid="rider-orders-table">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/10 bg-gorola-charcoal/[0.02]">
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Order ID</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Store</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Customer</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Status</th>
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
                    Loading delivery history...
                  </td>
                </tr>
              ) : !ordersData || ordersData.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-gorola-slate">
                    No delivery records found for this rider.
                  </td>
                </tr>
              ) : (
                ordersData.items.map((order) => (
                  <tr key={order.id} className="hover:bg-gorola-charcoal/[0.01] transition-colors">
                    <td className="p-3 font-mono font-bold text-xs text-gorola-charcoal whitespace-nowrap">
                      #{order.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="p-3 text-xs font-bold text-gorola-charcoal whitespace-nowrap">
                      {order.storeName}
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
                        data-testid={`view-rider-order-${order.id}`}
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
          data-testid="rider-order-details-modal"
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
                    <span>Delivery Fee</span>
                    <span className="font-semibold">{formatCurrency(orderDetail.deliveryFee)}</span>
                  </div>
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

      {/* Confirmation Modal for Suspending/Activating Rider */}
      {confirmStatusModalOpen && (
        <div className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gorola-charcoal">
              {rider.isActive ? "Suspend Rider Partner?" : "Activate Rider Partner?"}
            </h3>
            <p className="text-xs text-gorola-slate leading-relaxed">
              {rider.isActive
                ? `Suspending ${rider.name} will prevent them from accepting new order dispatches across all assigned stores.`
                : `Activating ${rider.name} will allow them to receive order dispatches.`}
            </p>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gorola-charcoal/10">
              <button
                type="button"
                onClick={() => setConfirmStatusModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gorola-slate hover:bg-gorola-mint/10 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={toggleStatusMutation.isPending}
                onClick={() => toggleStatusMutation.mutate()}
                data-testid="confirm-rider-status-change"
                className={`px-5 py-2 text-xs font-black rounded-xl text-white shadow-md ${
                  rider.isActive
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {toggleStatusMutation.isPending ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
