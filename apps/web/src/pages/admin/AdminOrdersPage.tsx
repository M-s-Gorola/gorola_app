import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  RefreshCw,
  Table2
} from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AdminOrderDetailModal } from "@/components/admin/AdminOrderDetailModal";
import { api } from "@/lib/api";
import { formatStatusLabel, getStatusBadgeClasses } from "@/lib/utils";

type OrderStatus =
  | "PLACED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "PENDING_APPROVAL"
  | "APPROVED";

type OrderListItem = {
  id: string;
  buyerMaskedPhone: string;
  storeName: string;
  itemsCount: number;
  total: number;
  status: OrderStatus;
  orderType?: "REGULAR" | "BOOKING" | "QUICK";
  createdAt: string;
  paymentMethod: string;
  riderName?: string | null;
};

type StoreOption = {
  id: string;
  name: string;
};

type OrdersResponse = {
  success: boolean;
  data: {
    items: OrderListItem[];
    nextCursor?: string | null;
    stores: StoreOption[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

export function AdminOrdersPage(): ReactElement {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters synced to URL search parameters
  const storeFilter = searchParams.get("storeId") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const paymentFilter = searchParams.get("paymentMethod") ?? "";
  const startsAtFilter = searchParams.get("startsAt") ?? "";
  const endsAtFilter = searchParams.get("endsAt") ?? "";

  // Pagination and view mode state
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modals state
  const [selectedOrderDetailsId, setSelectedOrderDetailsId] = useState<string | null>(null);
  const [forceUpdateOrderId, setForceUpdateOrderId] = useState<string | null>(null);
  const [forceStatus, setForceStatus] = useState<OrderStatus>("CANCELLED");
  const [auditNote, setAuditNote] = useState("");

  const limit = 20;

  // Invalidate pagination cursors if filters change
  const handleFilterChange = (key: string, value: string) => {
    setSearchParams((prev) => {
      if (value) {
        prev.set(key, value);
      } else {
        prev.delete(key);
      }
      return prev;
    });
    setPage(1);
  };

  // Fetch orders query
  const { data, isLoading, isError, isFetching, refetch } = useQuery<OrdersResponse["data"]>({
    queryKey: ["admin", "orders", storeFilter, statusFilter, paymentFilter, startsAtFilter, endsAtFilter, page],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      if (storeFilter) params.append("storeId", storeFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (paymentFilter) params.append("paymentMethod", paymentFilter);
      if (startsAtFilter) params.append("startsAt", startsAtFilter);
      if (endsAtFilter) params.append("endsAt", endsAtFilter);

      const res = await api.get<OrdersResponse>(`/api/v1/admin/orders?${params.toString()}`);
      return res.data.data;
    },
    staleTime: 5000,
    refetchInterval: 5000,
    placeholderData: (prev) => prev
  });

  // Force update status mutation
  const forceUpdateMutation = useMutation({
    mutationFn: async ({ orderId, status, note }: { orderId: string; status: OrderStatus; note: string }) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/admin/orders/${orderId}/status`, { status, auditNote: note });
    },
    onSuccess: () => {
      toast.success("Order status force-updated successfully");
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setForceUpdateOrderId(null);
      setAuditNote("");
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update order status";
      toast.error(msg);
    }
  });

  const handleForceUpdateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!forceUpdateOrderId || !auditNote.trim()) return;
    forceUpdateMutation.mutate({
      orderId: forceUpdateOrderId,
      status: forceStatus,
      note: auditNote
    });
  };

  const handleExport = async () => {
    try {
      const toastId = toast.loading("Generating CSV export...");
      const params = new URLSearchParams();
      if (storeFilter) params.append("storeId", storeFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (paymentFilter) params.append("paymentMethod", paymentFilter);
      if (startsAtFilter) params.append("startsAt", startsAtFilter);
      if (endsAtFilter) params.append("endsAt", endsAtFilter);

      const res = await api?.get(`/api/v1/admin/orders/export?${params.toString()}`, { responseType: "text" });
      const blob = new Blob([res?.data as string], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `orders-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV export downloaded!", { id: toastId });
    } catch {
      toast.error("Failed to generate CSV export");
    }
  };

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (isLoading && !data) {
    return (
      <div data-testid="orders-loading-skeleton" className="space-y-6 animate-pulse">
        <div className="h-10 bg-gorola-charcoal/10 rounded-xl w-48" />
        <div className="h-14 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
        <div className="h-96 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load platform orders</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
          Try Again
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];
  const stores = data?.stores ?? [];
  const total = data?.total ?? items.length;
  const totalPages = data?.totalPages ?? (Math.ceil(total / limit) || 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Platform Orders</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Manage, filter, audit, and force-adjust status transitions of system-wide transactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-white border border-gorola-charcoal/10 rounded-xl p-1 shadow-sm">
            <button
              type="button"
              data-testid="view-mode-table"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "table"
                  ? "bg-gorola-pine text-white shadow-xs"
                  : "text-gorola-slate hover:text-gorola-charcoal hover:bg-gorola-mint/10"
              }`}
              title="Table View"
            >
              <Table2 className="h-4 w-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              data-testid="view-mode-cards"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "cards"
                  ? "bg-gorola-pine text-white shadow-xs"
                  : "text-gorola-slate hover:text-gorola-charcoal hover:bg-gorola-mint/10"
              }`}
              title="Cards View"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <button
            onClick={handleExport}
            data-testid="export-csv-button"
            className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
          >
            <Download className="h-4 w-4 text-gorola-pine" />
            Export CSV
          </button>
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
            Sync Queue
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <section className="bg-white rounded-2xl border border-gorola-charcoal/10 p-5 shadow-sm grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end">
        {/* Store */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">Store</label>
          <select
            data-testid="filter-store-select"
            value={storeFilter}
            onChange={(e) => handleFilterChange("storeId", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">Status</label>
          <select
            data-testid="filter-status-select"
            value={statusFilter}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
          >
            <option value="">All Statuses</option>
            <option value="PLACED">Placed</option>
            <option value="PREPARING">Preparing</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery / On The Way</option>
            <option value="DELIVERED">Delivered / Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
          </select>
        </div>

        {/* Payment */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">Payment Method</label>
          <select
            data-testid="filter-payment-select"
            value={paymentFilter}
            onChange={(e) => handleFilterChange("paymentMethod", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
          >
            <option value="">All Methods</option>
            <option value="COD">Cash on Delivery</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
          </select>
        </div>

        {/* From Date */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">From Date</label>
          <input
            type="date"
            data-testid="filter-starts-date"
            value={startsAtFilter}
            onChange={(e) => handleFilterChange("startsAt", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
          />
        </div>

        {/* To Date */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">To Date</label>
          <input
            type="date"
            data-testid="filter-ends-date"
            value={endsAtFilter}
            onChange={(e) => handleFilterChange("endsAt", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
          />
        </div>
      </section>

      {/* Orders View (Table or Cards) */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 overflow-hidden shadow-sm">
        {viewMode === "table" ? (
          <div data-testid="admin-orders-table" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gorola-charcoal/5 bg-gorola-mint/5">
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider">Order ID</th>
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider">Store</th>
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider">Buyer Phone</th>
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider">Rider</th>
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider text-center">Items</th>
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider text-right">Total</th>
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider text-center">Status</th>
                  <th className="p-4 text-xs font-bold text-gorola-slate/60 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gorola-charcoal/[0.03]">
                {items.map((order) => (
                  <tr key={order.id} className="hover:bg-gorola-mint/5 transition-colors">
                    <td className="p-4 font-mono text-xs font-black text-gorola-charcoal">
                      #{order.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="p-4 text-xs text-gorola-slate font-medium">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="p-4 text-xs font-bold text-gorola-charcoal">{order.storeName}</td>
                    <td className="p-4 text-xs font-bold text-gorola-slate">{order.buyerMaskedPhone}</td>
                    <td className="p-4 text-xs font-bold text-gorola-slate">{order.riderName || "-"}</td>
                    <td className="p-4 text-xs font-bold text-gorola-charcoal text-center">{order.itemsCount}</td>
                    <td className="p-4 text-xs font-black text-gorola-charcoal text-right">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusBadgeClasses(
                          order.status
                        )}`}
                      >
                        {formatStatusLabel(order.status, order.orderType)}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedOrderDetailsId(order.id)}
                        data-testid={`view-details-${order.id}`}
                        className="px-3 py-1.5 border border-gorola-pine/25 hover:border-gorola-pine text-gorola-pine hover:bg-gorola-pine/5 rounded-lg text-xs font-bold transition-all"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => {
                          setForceUpdateOrderId(order.id);
                          setForceStatus(order.status);
                        }}
                        data-testid={`force-update-status-${order.id}`}
                        className="px-3 py-1.5 bg-gorola-charcoal hover:bg-gorola-charcoal/90 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                      >
                        Force Update
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-sm text-gorola-slate/60 italic text-center">
                      No orders matching filters found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div data-testid="admin-orders-cards" className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gorola-charcoal/10 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-gorola-charcoal/5">
                    <span className="font-mono font-bold text-xs text-gorola-charcoal">
                      #{order.id.slice(-8).toUpperCase()}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusBadgeClasses(
                        order.status
                      )}`}
                    >
                      {formatStatusLabel(order.status, order.orderType)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-gorola-slate">
                      <span>Store:</span>
                      <span className="font-bold text-gorola-charcoal truncate max-w-[150px]">{order.storeName}</span>
                    </div>
                    <div className="flex items-center justify-between text-gorola-slate">
                      <span>Buyer Phone:</span>
                      <span className="font-mono font-semibold text-gorola-charcoal">{order.buyerMaskedPhone}</span>
                    </div>
                    <div className="flex items-center justify-between text-gorola-slate">
                      <span>Rider / Tech:</span>
                      <span className="font-medium text-gorola-charcoal">{order.riderName || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between text-gorola-slate">
                      <span>Items & Total:</span>
                      <span className="font-black text-gorola-charcoal">
                        {order.itemsCount} items • {formatCurrency(order.total)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gorola-slate/70 pt-1">
                      <span>
                        {new Date(order.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      <span className="px-1.5 py-0.5 bg-gorola-mint/20 text-gorola-pine rounded font-bold uppercase text-[9px]">
                        {order.paymentMethod}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gorola-charcoal/5 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setSelectedOrderDetailsId(order.id)}
                    data-testid={`card-view-details-${order.id}`}
                    className="px-3 py-1.5 border border-gorola-pine/25 hover:border-gorola-pine text-gorola-pine hover:bg-gorola-pine/5 rounded-lg text-xs font-bold transition-all"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      setForceUpdateOrderId(order.id);
                      setForceStatus(order.status);
                    }}
                    data-testid={`card-force-update-${order.id}`}
                    className="px-3 py-1.5 bg-gorola-charcoal hover:bg-gorola-charcoal/90 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    Force Update
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="col-span-full p-8 text-sm text-gorola-slate/60 italic text-center">
                No orders matching filters found.
              </div>
            )}
          </div>
        )}

        {/* Persistent Pagination Bar */}
        <div
          data-testid="admin-orders-pagination"
          className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gorola-charcoal/10 bg-gorola-mint/5"
        >
          <span className="text-xs font-bold text-gorola-slate">
            Showing page <span className="text-gorola-charcoal font-black">{page}</span> of{" "}
            <span className="text-gorola-charcoal font-black">{totalPages}</span> ({total} orders)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="pagination-prev-btn"
              className="px-4 py-2 bg-white border border-gorola-charcoal/10 hover:border-gorola-pine/20 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-bold text-gorola-charcoal shadow-sm transition-all flex items-center gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
            <span className="text-xs font-bold text-gorola-charcoal px-2">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="pagination-next-btn"
              className="px-4 py-2 bg-white border border-gorola-charcoal/10 hover:border-gorola-pine/20 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-bold text-gorola-charcoal shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <AdminOrderDetailModal
        orderId={selectedOrderDetailsId}
        onClose={() => setSelectedOrderDetailsId(null)}
      />

      {/* Force Status Update Modal */}
      {forceUpdateOrderId && (
        <div data-lenis-prevent className="fixed inset-0 z-50 flex items-center justify-center bg-gorola-charcoal/40 backdrop-blur-sm overscroll-contain animate-in fade-in duration-200">
          <form
            onSubmit={handleForceUpdateSubmit}
            role="dialog"
            aria-modal="true"
            data-lenis-prevent
            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl border border-gorola-charcoal/10 transform overscroll-contain animate-in zoom-in-95 duration-200 space-y-4"
          >
            <h3 className="text-lg font-bold text-gorola-charcoal flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Force Update Order Status
            </h3>
            <p className="text-xs text-gorola-slate font-dm-sans">
              Warning: Modifying order status directly will skip normal state checks. Deactivations or cancellations will trigger stock restoration.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">New Status</label>
              <select
                data-testid="force-status-select"
                value={forceStatus}
                onChange={(e) => setForceStatus(e.target.value as OrderStatus)}
                className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none"
              >
                <option value="PLACED">Placed</option>
                <option value="PREPARING">Preparing</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">Audit note / reason</label>
              <textarea
                rows={3}
                data-testid="audit-note-input"
                required
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                placeholder="Explain why this status is being forced (mandatory)..."
                className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-medium text-gorola-charcoal focus:outline-none focus:ring-2 focus:ring-gorola-pine/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setForceUpdateOrderId(null);
                  setAuditNote("");
                }}
                className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 rounded-xl font-bold text-sm text-gorola-slate transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="confirm-force-status-update"
                disabled={!auditNote.trim() || forceUpdateMutation.isPending}
                className="px-4 py-2 bg-gorola-pine hover:bg-gorola-pine/90 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
              >
                {forceUpdateMutation.isPending ? "Updating..." : "Confirm Update"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
