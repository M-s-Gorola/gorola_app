import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  User,
  X
} from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type AddressItem = {
  id: string;
  flatRoom?: string | null;
  landmarkDescription?: string | null;
};

type UserDetail = {
  id: string;
  name: string;
  maskedPhone: string;
  isActive: boolean;
  createdAt: string;
  addresses: AddressItem[];
  nomineeName?: string | null;
  nomineeContact?: string | null;
  nomineeRelationship?: string | null;
};

type UserDetailResponse = {
  success: boolean;
  data: UserDetail;
};

type UserOrderItem = {
  id: string;
  storeId: string;
  storeName: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  status: string;
  orderType: string;
  paymentMethod: string;
  itemsCount: number;
  createdAt: string;
};

type UserOrdersResponse = {
  success: boolean;
  data: {
    items: UserOrderItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type ConsentSummaryItem = {
  purpose: string;
  displayName: string;
  isEssential: boolean;
  isActive: boolean;
  givenAt: string | null;
  withdrawnAt: string | null;
  version: string | null;
};

type ConsentLogItem = {
  id: string;
  purpose: string;
  isWithdrawn: boolean;
  consentVersion: string;
  noticeText: string;
  ipAddress: string;
  userAgent?: string | null;
  createdAt: string;
  withdrawnAt?: string | null;
};

type UserConsentData = {
  summary: ConsentSummaryItem[];
  logs: ConsentLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type UserConsentResponse = {
  success: boolean;
  data: UserConsentData;
};

type OrderItemDetail = {
  id: string;
  productName: string;
  variantLabel: string;
  price: number;
  quantity: number;
};

type OrderStatusHistoryItem = {
  id: string;
  status: string;
  changedBy: string;
  changedAt: string;
  note?: string | null;
};

type OrderDetail = {
  id: string;
  status: string;
  orderType?: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  landmarkDescription: string;
  flatRoom?: string | null;
  createdAt: string;
  buyerMaskedPhone: string;
  user?: { name: string; phone: string } | null;
  store: { name: string; phone: string; storeType?: string };
  items: OrderItemDetail[];
  statusHistory: OrderStatusHistoryItem[];
  riderName?: string | null;
};

type OrderDetailResponse = {
  success: boolean;
  data: OrderDetail;
};

export function AdminUserDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  // Filter & Pagination states for User Orders
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string>("ALL");

  // Consent Pagination & Accordion states
  const [consentPage, setConsentPage] = useState(1);
  const [consentLogOpen, setConsentLogOpen] = useState(false);

  // Status suspension dialog
  const [confirmStatusModalOpen, setConfirmStatusModalOpen] = useState(false);

  // Order Details Modal
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // 1. Fetch User Detail
  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
    refetch: refetchUser
  } = useQuery<UserDetail>({
    queryKey: ["admin", "users", id],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<UserDetailResponse>(`/api/v1/admin/users/${id}`);
      return res.data.data;
    },
    enabled: !!id
  });

  // 2. Fetch User Orders
  const {
    data: ordersData,
    isLoading: isOrdersLoading
  } = useQuery<UserOrdersResponse["data"]>({
    queryKey: ["admin", "users", id, "orders", ordersPage, ordersStatusFilter],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const params = new URLSearchParams();
      params.set("page", String(ordersPage));
      params.set("limit", "10");
      if (ordersStatusFilter !== "ALL") {
        params.set("status", ordersStatusFilter);
      }
      const res = await api.get<UserOrdersResponse>(`/api/v1/admin/users/${id}/orders?${params.toString()}`);
      return res.data.data;
    },
    enabled: !!id
  });

  // 3. Fetch User Consents (DPDP Act)
  const {
    data: consentData,
    isLoading: isConsentLoading
  } = useQuery<UserConsentData>({
    queryKey: ["admin", "users", id, "consents", consentPage],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<UserConsentResponse>(
        `/api/v1/admin/users/${id}/consents?page=${consentPage}&limit=10`
      );
      return res.data.data;
    },
    enabled: !!id
  });

  // 4. Fetch Single Order Details (for modal)
  const {
    data: orderDetail,
    isLoading: isOrderDetailLoading
  } = useQuery<OrderDetail>({
    queryKey: ["admin", "orders", selectedOrderId],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<OrderDetailResponse>(`/api/v1/admin/orders/${selectedOrderId}`);
      return res.data.data;
    },
    enabled: !!selectedOrderId
  });

  // Suspend / Unsuspend Mutation
  const toggleSuspendMutation = useMutation({
    mutationFn: async ({ userId, isCurrentlyActive }: { userId: string; isCurrentlyActive: boolean }) => {
      if (!api) throw new Error("API helper not initialized");
      const endpoint = isCurrentlyActive
        ? `/api/v1/admin/users/${userId}/suspend`
        : `/api/v1/admin/users/${userId}/unsuspend`;
      const res = await api.put(endpoint, {});
      return res.data;
    },
    onSuccess: async (_, variables) => {
      const action = variables.isCurrentlyActive ? "suspended" : "unsuspended";
      toast.success(`User successfully ${action}`);
      setConfirmStatusModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "users", id] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      ]);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update user status";
      toast.error(msg);
    }
  });

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (isUserLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4 md:p-8" data-testid="user-detail-loading">
        <div className="h-8 bg-gorola-charcoal/10 rounded-xl w-48" />
        <div className="h-40 bg-gorola-charcoal/10 rounded-2xl w-full" />
        <div className="h-64 bg-gorola-charcoal/10 rounded-2xl w-full" />
      </div>
    );
  }

  if (isUserError || !user) {
    return (
      <div className="p-8 text-center space-y-4" data-testid="user-detail-error">
        <AlertTriangle className="h-10 w-10 text-gorola-clay mx-auto" />
        <h2 className="text-xl font-black text-gorola-charcoal">Failed to load user profile</h2>
        <p className="text-sm text-gorola-slate">The user could not be found or a network error occurred.</p>
        <button
          onClick={() => void refetchUser()}
          className="px-5 py-2.5 bg-gorola-pine text-white text-xs font-bold rounded-xl shadow-md hover:bg-gorola-pine/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  const displayName = user.name?.trim() || "Registered User";

  return (
    <div className="space-y-8 pb-16" data-testid="admin-user-detail-page">
      {/* Navigation Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(getScopedPath("/admin/users", "admin", isSubdomainMode))}
          className="inline-flex items-center gap-2 text-xs font-bold text-gorola-slate hover:text-gorola-charcoal transition-colors"
          data-testid="back-to-users-button"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Platform Users</span>
        </button>
      </div>

      {/* User Overview Profile Card */}
      <div className="bg-white border border-gorola-charcoal/10 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gorola-charcoal/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gorola-pine/10 border border-gorola-pine/20 flex items-center justify-center text-gorola-pine font-black text-xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-gorola-charcoal" data-testid="user-display-name">
                  {displayName}
                </h1>
                <span
                  data-testid="user-status-badge"
                  className={`px-3 py-1 text-[11px] font-black tracking-wider uppercase rounded-full ${
                    user.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {user.isActive ? "Active" : "Suspended"}
                </span>
              </div>
              <p className="text-xs text-gorola-slate font-medium mt-1">User ID: {user.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfirmStatusModalOpen(true)}
              data-testid="toggle-user-status-button"
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${
                user.isActive
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {user.isActive ? "Suspend User" : "Unsuspend User"}
            </button>
          </div>
        </div>

        {/* Profile Info Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
            <Phone className="h-5 w-5 text-gorola-slate" />
            <div>
              <p className="text-[10px] uppercase font-black text-gorola-slate/70">Phone Number</p>
              <p className="text-sm font-black text-gorola-charcoal" data-testid="user-phone">
                {user.maskedPhone}
              </p>
            </div>
          </div>

          <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gorola-slate" />
            <div>
              <p className="text-[10px] uppercase font-black text-gorola-slate/70">Joined Date</p>
              <p className="text-sm font-black text-gorola-charcoal">
                {new Date(user.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
              </p>
            </div>
          </div>

          <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-gorola-slate" />
            <div>
              <p className="text-[10px] uppercase font-black text-gorola-slate/70">Saved Addresses</p>
              <p className="text-sm font-black text-gorola-charcoal">{user.addresses.length}</p>
            </div>
          </div>

          <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-gorola-slate" />
            <div>
              <p className="text-[10px] uppercase font-black text-gorola-slate/70">Nominee Info</p>
              <p className="text-sm font-black text-gorola-charcoal">
                {user.nomineeName ? `${user.nomineeName} (${user.nomineeRelationship ?? "Nominee"})` : "Not Configured"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Addresses Section */}
      <div className="bg-white border border-gorola-charcoal/10 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <h2 className="text-lg font-black text-gorola-charcoal flex items-center gap-2">
          <MapPin className="h-5 w-5 text-gorola-pine" />
          <span>Registered Delivery Addresses</span>
        </h2>

        {user.addresses.length === 0 ? (
          <p className="text-xs text-gorola-slate italic">No saved delivery addresses found for this user.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="user-addresses-grid">
            {user.addresses.map((addr) => (
              <div
                key={addr.id}
                className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 space-y-1"
              >
                {addr.flatRoom && (
                  <p className="text-xs font-black text-gorola-charcoal">{addr.flatRoom}</p>
                )}
                <p className="text-xs text-gorola-slate font-medium">{addr.landmarkDescription}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Orders History Section */}
      <div className="bg-white border border-gorola-charcoal/10 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-gorola-charcoal flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-gorola-pine" />
              <span>Orders History</span>
            </h2>
            <p className="text-xs text-gorola-slate mt-0.5">
              {ordersData?.total ?? 0} total orders placed by this buyer
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="user-orders-status-filter" className="text-xs font-bold text-gorola-slate">
              Status:
            </label>
            <select
              id="user-orders-status-filter"
              value={ordersStatusFilter}
              onChange={(e) => {
                setOrdersStatusFilter(e.target.value);
                setOrdersPage(1);
              }}
              data-testid="user-orders-status-filter"
              className="px-3 py-1.5 bg-gorola-mint/10 border border-gorola-mint/20 text-xs font-black text-gorola-charcoal rounded-xl focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="PLACED">Placed</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PREPARING">Preparing</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        {isOrdersLoading ? (
          <div className="p-8 text-center text-xs text-gorola-slate animate-pulse">Loading orders...</div>
        ) : !ordersData || ordersData.items.length === 0 ? (
          <div className="p-8 text-center text-xs text-gorola-slate bg-gorola-mint/5 rounded-2xl" data-testid="user-no-orders">
            No orders found matching the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="user-orders-table">
              <thead>
                <tr className="border-b border-gorola-charcoal/10 text-[11px] font-black uppercase text-gorola-slate/70 tracking-wider">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Store</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gorola-charcoal/5 text-xs">
                {ordersData.items.map((order) => (
                  <tr key={order.id} className="hover:bg-gorola-mint/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gorola-charcoal text-[11px]">
                      #{order.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-bold text-gorola-charcoal">{order.storeName}</td>
                    <td className="py-3 px-4 text-center font-semibold text-gorola-slate">{order.itemsCount}</td>
                    <td className="py-3 px-4 font-black text-gorola-charcoal">{formatCurrency(order.total)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md ${
                          order.orderType === "BOOKING"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {order.orderType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-full ${
                          order.status === "DELIVERED" || order.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : order.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gorola-slate">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedOrderId(order.id)}
                        data-testid={`view-user-order-${order.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gorola-pine/10 text-gorola-pine text-xs font-bold rounded-xl hover:bg-gorola-pine hover:text-white transition-all shadow-sm"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {ordersData.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gorola-charcoal/10">
                <p className="text-xs text-gorola-slate">
                  Page {ordersData.page} of {ordersData.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={ordersPage <= 1}
                    onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-xl border border-gorola-charcoal/10 disabled:opacity-40 hover:bg-gorola-mint/10 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-gorola-charcoal" />
                  </button>
                  <button
                    disabled={ordersPage >= ordersData.totalPages}
                    onClick={() => setOrdersPage((p) => p + 1)}
                    className="p-2 rounded-xl border border-gorola-charcoal/10 disabled:opacity-40 hover:bg-gorola-mint/10 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-gorola-charcoal" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Consent & Privacy Section (DPDP Act 2023) */}
      <div className="bg-white border border-gorola-charcoal/10 rounded-3xl p-6 md:p-8 shadow-sm space-y-6" data-testid="user-consent-section">
        <div>
          <h2 className="text-lg font-black text-gorola-charcoal flex items-center gap-2">
            <Lock className="h-5 w-5 text-gorola-pine" />
            <span>Consent & Privacy (DPDP Act 2023)</span>
          </h2>
          <p className="text-xs text-gorola-slate mt-0.5">
            Real-time status of statutory consents and immutable audit log for this user.
          </p>
        </div>

        {isConsentLoading ? (
          <div className="p-6 text-center text-xs text-gorola-slate animate-pulse">Loading privacy consents...</div>
        ) : !consentData ? (
          <p className="text-xs text-gorola-slate italic">No consent history recorded for this user.</p>
        ) : (
          <div className="space-y-6">
            {/* Purpose Status Summary Table */}
            <div className="border border-gorola-mint/20 rounded-2xl overflow-hidden bg-gorola-mint/5" data-testid="consent-summary-section">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gorola-mint/20 text-[10px] font-black uppercase text-gorola-slate tracking-wider">
                    <th className="py-2.5 px-4">Purpose</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gorola-mint/10">
                  {consentData.summary.map((item) => (
                    <tr key={item.purpose}>
                      <td className="py-3 px-4 font-bold text-gorola-charcoal">{item.displayName}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold text-gorola-slate uppercase">
                          {item.isEssential ? "Essential" : "Optional"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded-full ${
                            item.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : item.withdrawnAt
                              ? "bg-red-100 text-red-800"
                              : "bg-gorola-slate/10 text-gorola-slate"
                          }`}
                        >
                          {item.isActive ? "Active" : item.withdrawnAt ? "Withdrawn" : "Never Given"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gorola-slate font-medium">
                        {item.withdrawnAt
                          ? new Date(item.withdrawnAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })
                          : item.givenAt
                          ? new Date(item.givenAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expandable Paginated Audit Log */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setConsentLogOpen(!consentLogOpen)}
                className="text-xs font-bold text-gorola-pine hover:underline flex items-center gap-1.5"
                data-testid="toggle-consent-log-button"
              >
                <span>{consentLogOpen ? "Hide full log" : `Show full log (${consentData.total} events)`}</span>
              </button>

              {consentLogOpen && (
                <div className="border border-gorola-charcoal/10 rounded-2xl overflow-hidden bg-white space-y-2 p-4 animate-in fade-in duration-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]" data-testid="consent-log-table">
                      <thead>
                        <tr className="border-b border-gorola-charcoal/10 text-[10px] font-black uppercase text-gorola-slate/70">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Purpose</th>
                          <th className="py-2 px-3">Action</th>
                          <th className="py-2 px-3">Ver</th>
                          <th className="py-2 px-3">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gorola-charcoal/5">
                        {consentData.logs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-2 px-3 text-gorola-slate">
                              {new Date(log.createdAt).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "numeric",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="py-2 px-3 font-bold text-gorola-charcoal">{log.purpose}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                                  log.isWithdrawn
                                    ? "bg-red-100 text-red-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {log.isWithdrawn ? "Withdrawn" : "Granted"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gorola-slate font-mono">{log.consentVersion}</td>
                            <td className="py-2 px-3 text-gorola-slate font-mono">{log.ipAddress}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Consent Log Pagination */}
                  {consentData.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gorola-charcoal/5 text-xs">
                      <span className="text-gorola-slate">
                        Page {consentData.page} of {consentData.totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={consentPage <= 1}
                          onClick={() => setConsentPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded border border-gorola-charcoal/10 text-[11px] font-bold disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          disabled={consentPage >= consentData.totalPages}
                          onClick={() => setConsentPage((p) => p + 1)}
                          className="px-2.5 py-1 rounded border border-gorola-charcoal/10 text-[11px] font-bold disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Suspend / Unsuspend Confirmation Modal */}
      {confirmStatusModalOpen && (
        <div className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gorola-charcoal">
              {user.isActive ? "Suspend User Account?" : "Unsuspend User Account?"}
            </h3>
            <p className="text-xs text-gorola-slate leading-relaxed">
              {user.isActive
                ? "Suspending this user will immediately revoke all active sessions and block further OTP verification until reactivated."
                : "Unsuspending this user will restore their ability to log in and access services."}
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
                disabled={toggleSuspendMutation.isPending}
                onClick={() =>
                  toggleSuspendMutation.mutate({
                    userId: user.id,
                    isCurrentlyActive: user.isActive
                  })
                }
                data-testid="confirm-user-status-change"
                className={`px-5 py-2 text-xs font-black rounded-xl text-white shadow-md ${
                  user.isActive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {toggleSuspendMutation.isPending ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal (when clicked from orders table) */}
      {selectedOrderId && (
        <div
          className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          data-testid="user-order-details-modal"
        >
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gorola-charcoal/10 pb-4">
              <div className="space-y-1">
                <span
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full ${
                    orderDetail?.status === "DELIVERED" || orderDetail?.status === "COMPLETED"
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
                          <User className="h-4 w-4 text-gorola-slate" />
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
                              idx === orderDetail.statusHistory.length - 1
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
                            <td className="p-3 text-right text-gorola-slate font-medium">
                              {formatCurrency(Number(item.price))}
                            </td>
                            <td className="p-3 text-right font-black text-gorola-charcoal">
                              {formatCurrency(Number(item.price) * item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grand Total Bar */}
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
    </div>
  );
}
