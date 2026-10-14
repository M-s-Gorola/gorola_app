import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Download,
  RefreshCw
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

type OrderItem = {
  id: string;
  productName: string;
  variantLabel: string;
  price: number;
  quantity: number;
};

type OrderStatusHistory = {
  id: string;
  status: OrderStatus;
  changedAt: string;
  changedBy: string;
  note?: string | null;
};

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
    nextCursor: string | null;
    stores: StoreOption[];
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

  // Cursor-based pagination state
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const currentCursor = cursors[cursorIndex];

  // Modals state
  const [selectedOrderDetailsId, setSelectedOrderDetailsId] = useState<string | null>(null);
  const [forceUpdateOrderId, setForceUpdateOrderId] = useState<string | null>(null);
  const [forceStatus, setForceStatus] = useState<OrderStatus>("CANCELLED");
  const [auditNote, setAuditNote] = useState("");

  const limit = 50;

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
    setCursors([null]);
    setCursorIndex(0);
  };

  // Fetch orders query
  const { data, isLoading, isError, isFetching, refetch } = useQuery<OrdersResponse["data"]>({
    queryKey: ["admin", "orders", storeFilter, statusFilter, paymentFilter, startsAtFilter, endsAtFilter, currentCursor],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      if (storeFilter) params.append("storeId", storeFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (paymentFilter) params.append("paymentMethod", paymentFilter);
      if (startsAtFilter) params.append("startsAt", startsAtFilter);
      if (endsAtFilter) params.append("endsAt", endsAtFilter);
      if (currentCursor) params.append("cursor", currentCursor);

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

  const getStatusBadgeClass = (status: OrderStatus) => {
    return getStatusBadgeClasses(status);
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
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
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

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
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
                      className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusBadgeClass(
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
                  <td colSpan={8} className="p-8 text-sm text-gorola-slate/60 italic text-center">
                    No orders matching filters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cursor Pagination */}
        {data && (data.nextCursor || cursorIndex > 0) && (
          <div className="flex justify-center items-center gap-4 py-4 border-t border-gorola-charcoal/5 bg-gorola-mint/5">
            <button
              disabled={cursorIndex === 0}
              onClick={() => setCursorIndex((idx) => Math.max(idx - 1, 0))}
              className="px-4 py-2 bg-white border border-gorola-charcoal/10 hover:border-gorola-pine/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-gorola-slate">Page {cursorIndex + 1}</span>
            <button
              disabled={!data.nextCursor}
              onClick={() => {
                if (data.nextCursor) {
                  setCursors((prev) => {
                    const nextList = [...prev.slice(0, cursorIndex + 1), data.nextCursor];
                    return nextList;
                  });
                  setCursorIndex((idx) => idx + 1);
                }
              }}
              className="px-4 py-2 bg-white border border-gorola-charcoal/10 hover:border-gorola-pine/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              Next
            </button>
          </div>
        )}
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
