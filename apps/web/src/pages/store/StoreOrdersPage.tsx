import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  ShoppingBag,
  Truck,
  User,
  XCircle
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
import { useAuthStore } from "@/store/auth.store";

type OrderStatus =
  | "PLACED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

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
};

type Order = {
  id: string;
  userId: string;
  storeId: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  landmarkDescription: string;
  createdAt: string;
  buyerMaskedPhone: string;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
};

type OrdersEnvelope = {
  success: boolean;
  data: Order[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

function ElapsedTimer({ createdAt }: { createdAt: string }): ReactElement {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const diffMs = Date.now() - new Date(createdAt).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) {
        setElapsed("Just now");
      } else if (diffMins < 60) {
        setElapsed(`${diffMins}m ago`);
      } else {
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setElapsed(`${hrs}h ${mins}m ago`);
      }
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return <span className="font-mono text-xs font-bold text-gorola-slate/80">{elapsed}</span>;
}

export function StoreOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const storeId = useAuthStore((s) => s.storeId);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  const { data: storeProfile } = useQuery({
    queryKey: ["store", "profile"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: { storeType: string } }>("/api/v1/store/profile");
      return res.data.data;
    },
    enabled: !!storeId
  });

  useEffect(() => {
    if (storeProfile?.storeType === "BOOKING_COMMERCE") {
      navigate(getScopedPath("/store/bookings", "store", isSubdomainMode), { replace: true });
    }
  }, [storeProfile, navigate, isSubdomainMode]);

  useEffect(() => {
    console.log("🔌 [StoreSocket] useEffect triggered. storeId:", storeId, "hasToken:", !!accessToken);
    if (!storeId || !accessToken) {
      console.log("🔌 [StoreSocket] Returning early: missing storeId or accessToken");
      return;
    }

    const host = window.location.hostname;
    const baseURL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${host}:3001`;
    console.log("🔌 [StoreSocket] Connecting to socket at:", baseURL);
    
    const socket = io(baseURL, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("🔌 [StoreSocket] Connected! Emitting join_store for:", storeId);
      socket.emit("join_store", storeId);
    });

    const triggerRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["store", "orders"] });
    };

    const playChime = () => {
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav");
        audio.volume = 0.5;
        void audio.play();
      } catch (err) {
        console.warn("Failed to play notification sound:", err);
      }
    };

    socket.on("store:new_order", () => {
      console.log("🔌 [StoreSocket] Event: store:new_order received!");
      triggerRefresh();
      playChime();
      toast.success("🔔 New Order Received! Action required.", {
        description: "A brand new order has just been placed.",
        duration: 8000,
      });
    });

    socket.on("store:order_updated", () => {
      console.log("🔌 [StoreSocket] Event: store:order_updated received!");
      triggerRefresh();
      toast.info("📋 Order status was updated by client/system.");
    });

    socket.on("error", (err: unknown) => {
      console.error("🔌 [StoreSocket] Error event:", err);
    });

    socket.on("connect_error", (err) => {
      console.error("🔌 [StoreSocket] Connection error event:", err);
    });

    return () => {
      console.log("🔌 [StoreSocket] useEffect cleanup running. Disconnecting socket.");
      socket.disconnect();
    };
  }, [storeId, accessToken, queryClient]);

  const limit = 10;

  // 1. Query for fetching orders
  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ["store", "orders", { status: selectedStatus, page }],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const url =
        selectedStatus === "ALL"
          ? `/api/v1/store/orders?page=${page}&limit=${limit}`
          : `/api/v1/store/orders?status=${selectedStatus}&page=${page}&limit=${limit}`;
      const res = await api.get<OrdersEnvelope>(url);
      return res.data;
    }
  });

  // 2. Mutation for changing status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put<{ success: boolean; data: Order }>(
        `/api/v1/store/orders/${orderId}/status`,
        { status }
      );
      return res.data;
    },
    onSuccess: (res, variables) => {
      toast.success(`Order status updated to ${variables.status}`);
      // Refresh order lists
      void queryClient.invalidateQueries({ queryKey: ["store", "orders"] });
      // Update local modal data
      if (selectedOrder && selectedOrder.id === variables.orderId) {
        setSelectedOrder((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: res.data.status,
            statusHistory: res.data.statusHistory ?? prev.statusHistory
          };
        });
      }
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to update order status";
      toast.error(errMsg);
    }
  });

  const getStatusBadgeStyles = (status: OrderStatus) => {
    switch (status) {
      case "PLACED":
        return "bg-amber-100 text-amber-800 border-amber-200/50";
      case "PREPARING":
        return "bg-sky-100 text-sky-800 border-sky-200/50";
      case "OUT_FOR_DELIVERY":
        return "bg-gorola-saffron/10 text-gorola-saffron border-gorola-saffron/20";
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200/50";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 border-rose-200/50";
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case "PLACED":
        return <ShoppingBag className="h-3.5 w-3.5" />;
      case "PREPARING":
        return <Clock className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "3s" }} />;
      case "OUT_FOR_DELIVERY":
        return <Truck className="h-3.5 w-3.5 animate-pulse" />;
      case "DELIVERED":
        return <CheckCircle className="h-3.5 w-3.5" />;
      case "CANCELLED":
        return <XCircle className="h-3.5 w-3.5" />;
    }
  };

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const handleTabChange = (status: OrderStatus | "ALL") => {
    setSelectedStatus(status);
    setPage(1);
  };

  const allowedTransitions = (currentStatus: OrderStatus): OrderStatus[] => {
    switch (currentStatus) {
      case "PLACED":
        return ["PREPARING", "CANCELLED"];
      case "PREPARING":
        return ["OUT_FOR_DELIVERY", "CANCELLED"];
      case "OUT_FOR_DELIVERY":
        return ["DELIVERED"];
      default:
        return [];
    }
  };

  const getTransitionButtonLabel = (status: OrderStatus) => {
    switch (status) {
      case "PREPARING":
        return "Mark Preparing";
      case "OUT_FOR_DELIVERY":
        return "Dispatch Order";
      case "DELIVERED":
        return "Mark Delivered";
      case "CANCELLED":
        return "Cancel Order";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Incoming Orders</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Real-time delivery management and order fullfilment dashboard.
          </p>
        </div>
        <button
          onClick={async () => {
            const toastId = toast.loading("Syncing latest incoming orders...");
            try {
              await refetch();
              toast.success("Order queue synchronized!", { id: toastId });
            } catch {
              toast.error("Failed to sync order queue", { id: toastId });
            }
          }}
          disabled={isFetching}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Clock className={`h-3.5 w-3.5 text-gorola-pine ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? "Syncing..." : "Refresh Queue"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border border-gorola-mint/15 rounded-2xl p-1.5 overflow-x-auto gap-1 shadow-sm scrollbar-none">
        {(["ALL", "PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const).map((tab) => {
          const isActive = selectedStatus === tab;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wide whitespace-nowrap transition-all ${
                isActive
                  ? "bg-gorola-pine text-white shadow-md shadow-gorola-pine/15"
                  : "text-gorola-slate hover:bg-gorola-mint/10 hover:text-gorola-charcoal"
              }`}
            >
              {tab === "ALL" ? "All Orders" : tab.replace(/_/g, " ")}
            </button>
          );
        })}
      </div>

      {/* Main Order Queue Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 4].map((i) => (
            <div
              key={i}
              data-testid="order-card-skeleton"
              className="bg-white border border-gorola-mint/10 rounded-2xl p-6 space-y-4 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-gorola-charcoal/10 rounded" />
                <div className="h-5 w-20 bg-gorola-charcoal/10 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-40 bg-gorola-charcoal/10 rounded" />
                <div className="h-3 w-48 bg-gorola-charcoal/10 rounded" />
              </div>
              <div className="h-px bg-gorola-charcoal/5" />
              <div className="h-8 w-24 bg-gorola-charcoal/10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
          <div className="h-14 w-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-gorola-charcoal">Failed to retrieve orders</h2>
          <p className="text-xs text-gorola-slate max-w-xs">
            Please check your connectivity or try reloading the order queue dashboard.
          </p>
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {data.data.map((order) => (
              <div
                key={order.id}
                data-testid={`order-card-${order.id}`}
                onClick={() => setSelectedOrder(order)}
                className="bg-white border border-gorola-mint/15 hover:border-gorola-pine/20 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Card Head */}
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div>
                      <h4 className="font-mono text-sm font-black text-gorola-charcoal">
                        #{order.id.slice(-8).toUpperCase()}
                      </h4>
                      <p className="text-[10px] text-gorola-slate font-semibold mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <ElapsedTimer createdAt={order.createdAt} />
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${getStatusBadgeStyles(
                          order.status
                        )}`}
                      >
                        {getStatusIcon(order.status)}
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="space-y-1 mb-4">
                    <p className="text-xs font-bold text-gorola-slate/80">
                      {order.items.length} {order.items.length === 1 ? "Item" : "Items"}
                    </p>
                    <p className="text-xs text-gorola-charcoal font-semibold truncate max-w-[300px]">
                      {order.items.map((item) => `${item.productName} (x${item.quantity})`).join(", ")}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gorola-mint/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gorola-slate uppercase tracking-wider font-bold">
                      Grand Total
                    </p>
                    <p className="text-base font-black text-gorola-charcoal">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-gorola-pine hover:underline">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.meta && (data.meta.total > limit) && (
            <div className="flex justify-center items-center gap-4 pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-4 py-2 bg-white border border-gorola-mint/15 hover:border-gorola-pine/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-gorola-slate">
                Page {page} of {Math.ceil(data.meta.total / limit)}
              </span>
              <button
                disabled={!data.meta.hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 bg-white border border-gorola-mint/15 hover:border-gorola-pine/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gorola-mint/15 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="h-16 w-16 bg-gorola-mint/20 text-gorola-pine rounded-full flex items-center justify-center">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-gorola-charcoal">No orders found</h3>
          <p className="text-sm text-gorola-slate max-w-xs">
            There are currently no orders in this queue filter status category.
          </p>
        </div>
      )}

      {/* Detailed Order Modal Dialog */}
      {selectedOrder && (
        <div
          data-testid="order-details-modal"
          className="fixed inset-0 bg-gorola-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase border mb-3 ${getStatusBadgeStyles(
                    selectedOrder.status
                  )}`}
                >
                  {getStatusIcon(selectedOrder.status)}
                  {selectedOrder.status.replace(/_/g, " ")}
                </span>
                <h2 className="font-mono text-xl md:text-2xl font-black text-gorola-charcoal">
                  #{selectedOrder.id.toUpperCase()}
                </h2>
                <p className="text-xs text-gorola-slate mt-1 font-medium">
                  Placed on: {new Date(selectedOrder.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="h-8 w-8 rounded-full border border-gorola-mint/20 hover:border-gorola-pine/20 flex items-center justify-center font-bold text-gorola-slate transition-all"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Buyer & Delivery details */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                  Buyer Information
                </h3>
                <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 space-y-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gorola-pine/10 rounded-lg flex items-center justify-center text-gorola-pine">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Buyer Profile</p>
                      <p className="text-xs font-black text-gorola-charcoal">Registered User</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-sky-50 text-sky-700 rounded-lg flex items-center justify-center">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Contact Number</p>
                      <p className="text-xs font-black text-gorola-charcoal">
                        {selectedOrder.buyerMaskedPhone || "Not Provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Landmark Description</p>
                      <p className="text-xs font-bold text-gorola-charcoal">
                        {selectedOrder.landmarkDescription || "No landmark specified"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order status transitions */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                  Status Transition Log
                </h3>
                <div className="relative pl-6 space-y-4 border-l border-gorola-mint/15">
                  {selectedOrder.statusHistory?.map((hist, idx) => (
                    <div key={hist.id} className="relative">
                      {/* Timeline dot */}
                      <span
                        className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ${
                          idx === selectedOrder.statusHistory.length - 1
                            ? "bg-gorola-pine scale-125"
                            : "bg-gorola-mint"
                        }`}
                      />
                      <p className="text-xs font-black text-gorola-charcoal">
                        {hist.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-gorola-slate mt-0.5">
                        By {hist.changedBy} at {new Date(hist.changedAt).toLocaleTimeString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                Itemized Summary
              </h3>
              <div className="border border-gorola-mint/15 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15">
                      <th className="p-3 text-xs font-black text-gorola-charcoal uppercase">Product</th>
                      <th className="p-3 text-xs font-black text-gorola-charcoal uppercase text-center">
                        Qty
                      </th>
                      <th className="p-3 text-xs font-black text-gorola-charcoal uppercase text-right">
                        Price
                      </th>
                      <th className="p-3 text-xs font-black text-gorola-charcoal uppercase text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id} className="border-b border-gorola-mint/10 last:border-0">
                        <td className="p-3">
                          <p className="text-xs font-black text-gorola-charcoal">{item.productName}</p>
                          <p className="text-[10px] text-gorola-slate">{item.variantLabel}</p>
                        </td>
                        <td className="p-3 text-xs font-bold text-center text-gorola-charcoal">
                          {item.quantity}
                        </td>
                        <td className="p-3 text-xs text-right font-medium text-gorola-slate">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="p-3 text-xs text-right font-black text-gorola-charcoal">
                          {formatCurrency(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total calculation panel */}
            <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs text-gorola-slate">
                <span>Subtotal</span>
                <span className="font-semibold">{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gorola-slate">
                <span>Delivery Fee</span>
                <span className="font-semibold">{formatCurrency(selectedOrder.deliveryFee)}</span>
              </div>
              <div className="h-px bg-gorola-mint/15 my-1" />
              <div className="flex justify-between items-center text-sm font-black text-gorola-charcoal">
                <span>Grand Total</span>
                <span className="text-lg text-gorola-pine">{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Transitions actions buttons footer */}
            {allowedTransitions(selectedOrder.status).length > 0 && (
              <div className="pt-4 border-t border-gorola-mint/10 flex flex-wrap gap-3">
                {allowedTransitions(selectedOrder.status).map((nextStatus) => {
                  const isCancel = nextStatus === "CANCELLED";
                  return (
                    <button
                      key={nextStatus}
                      disabled={updateStatusMutation.isPending}
                      onClick={() =>
                        updateStatusMutation.mutate({ orderId: selectedOrder.id, status: nextStatus })
                      }
                      className={`flex-1 min-w-[140px] px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                        isCancel
                          ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"
                          : "bg-gorola-pine text-white hover:bg-gorola-pine/90 disabled:opacity-50 shadow-md shadow-gorola-pine/15"
                      }`}
                    >
                      {updateStatusMutation.isPending
                        ? "Updating..."
                        : getTransitionButtonLabel(nextStatus)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
