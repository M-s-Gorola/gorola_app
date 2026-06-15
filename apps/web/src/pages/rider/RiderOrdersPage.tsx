import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin, Phone, RefreshCw, ShoppingBag } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

import { OrderRouteMap } from "@/components/shared/OrderRouteMap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRiderLocation } from "@/hooks/useRiderLocation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

type OrderItem = {
  productName: string;
  variantLabel: string;
  quantity: number;
};

type ActiveOrder = {
  id: string;
  status: "PREPARING" | "OUT_FOR_DELIVERY" | "APPROVED";
  orderType: "QUICK" | "BOOKING";
  bookingOrder: {
    scheduledDate: string;
    timeslot: string;
    requiresFasting: boolean;
  } | null;
  buyerMaskedPhone: string;
  deliveryAddress: {
    landmark: string;
    lat: number | null;
    lng: number | null;
  };
  items: OrderItem[];
  createdAt: string;
};

type ActiveOrdersResponse = {
  success: boolean;
  data: ActiveOrder[];
};

type RiderProfileResponse = {
  success: boolean;
  data: {
    id: string;
    name: string;
    email: string;
    phone: string;
    riderType: string;
    store: {
      id: string;
      name: string;
    };
  };
};

export function RiderOrdersPage(): ReactElement {
  const [activeTab, setActiveTab] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<{
    id: string;
    status: "OUT_FOR_DELIVERY" | "DELIVERED";
  } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeTrackingId, setActiveTrackingId] = useState<string | undefined>(undefined);

  const queryClient = useQueryClient();

  const storeId = useAuthStore((s) => s.storeId);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: profileData } = useQuery<RiderProfileResponse>({
    queryKey: ["riderProfile"],
    queryFn: async () => {
      if (!api) throw new Error("API not configured");
      const res = await api.get<RiderProfileResponse>("/api/v1/rider/profile");
      return res.data;
    },
    enabled: !!accessToken
  });
  const isFieldTechnician = profileData?.data?.riderType === "FIELD_TECHNICIAN";

  useEffect(() => {
    if (selectedOrder) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedOrder]);

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
      void queryClient.invalidateQueries({ queryKey: ["riderActiveOrders"] });
    };

    socket.on("store:new_order", () => {
      triggerRefresh();
      toast.success(isFieldTechnician ? "🔔 New Service Received! Action required." : "🔔 New Order Received! Action required.");
    });

    socket.on("store:order_updated", () => {
      triggerRefresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [storeId, accessToken, queryClient, isFieldTechnician]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: "OUT_FOR_DELIVERY" | "DELIVERED" }) => {
      if (!api) throw new Error("API not configured");
      const res = await api.put<{ success: boolean }>(`/api/v1/rider/orders/${orderId}/status`, { status });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["riderActiveOrders"] });
      const isBooking = selectedOrder?.orderType === "BOOKING";
      const statusText = variables.status === "OUT_FOR_DELIVERY"
        ? (isBooking ? "Departed" : "Out for Delivery")
        : (isBooking ? "Visit Complete" : "Delivered");
      toast.success(
        `${isBooking ? "Service" : "Order"} marked as ${statusText}!`
      );
      setConfirmingOrder(null);
      setSelectedOrder(null);
      if (variables.status === "OUT_FOR_DELIVERY") {
        setActiveTrackingId(variables.orderId);
      } else if (variables.status === "DELIVERED") {
        setActiveTrackingId(undefined);
      }
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = ax?.response?.data?.error?.message ?? (isFieldTechnician ? "Failed to update service status." : "Failed to update order status.");
      toast.error(errMsg);
    }
  });

  const handleConfirmStatusUpdate = () => {
    if (confirmingOrder) {
      updateStatusMutation.mutate({
        orderId: confirmingOrder.id,
        status: confirmingOrder.status
      });
    }
  };

  // Fetch active orders with a 30s auto-refresh interval
  const { data, isLoading, error, refetch, isFetching } = useQuery<ActiveOrdersResponse>({
    queryKey: ["riderActiveOrders"],
    queryFn: async () => {
      if (!api) throw new Error("API not configured");
      const res = await api.get<ActiveOrdersResponse>("/api/v1/rider/orders/active");
      return res.data;
    },
    refetchInterval: 30000
  });

  const orders = data?.data ?? [];
  const preparingOrders = orders.filter((o) => o.status === "PREPARING" || o.status === "APPROVED");
  const deliveringOrders = orders.filter((o) => o.status === "OUT_FOR_DELIVERY");

  useEffect(() => {
    if (deliveringOrders.length > 0) {
      setActiveTrackingId(deliveringOrders[0]?.id);
    } else {
      if (!isFetching && !isLoading) {
        setActiveTrackingId(undefined);
      }
    }
  }, [deliveringOrders, isFetching, isLoading]);

  const { coords: riderCoords } = useRiderLocation(activeTrackingId);

  function getElapsedTimeStr(createdAt: string): string {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    if (elapsedMins < 1) return "Just now";
    if (elapsedMins < 60) return `${elapsedMins}m ago`;
    const elapsedHours = Math.floor(elapsedMins / 60);
    return `${elapsedHours}h ago`;
  }

  function renderCompactOrderCard(order: ActiveOrder) {
    const isBooking = order.orderType === "BOOKING";
    return (
      <div
        key={order.id}
        data-testid={isBooking ? "booking-order-card" : `order-card-${order.id}`}
        onClick={() => setSelectedOrder(order)}
        className="flex flex-col gap-3 rounded-2xl border border-gorola-fog bg-white p-4 shadow-sm transition hover:shadow-md cursor-pointer hover:border-gorola-pine/20"
      >
        <div className="flex items-center justify-between border-b border-gorola-fog pb-2">
          <span className="font-heading text-xs font-semibold text-gorola-charcoal">
            {isBooking ? "Service" : "Order"} #{order.id.slice(-6).toUpperCase()}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{getElapsedTimeStr(order.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {isBooking && order.bookingOrder && (
            <div className="flex flex-col gap-1 border-b border-gorola-fog/60 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gorola-charcoal">
                <span className="bg-gorola-pine/10 text-gorola-pine px-2 py-0.5 rounded text-[10px] uppercase">Slot</span>
                {order.bookingOrder.timeslot}
              </div>
              {order.bookingOrder.requiresFasting && (
                <div className="text-[11px] font-semibold text-gorola-saffron flex items-center gap-1">
                  ⚠️ Patient must be fasting
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 text-gorola-pine shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium">Landmark</span>
              <span className="text-xs text-gorola-charcoal font-semibold">
                {order.deliveryAddress.landmark || "No landmark specified"}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <ShoppingBag className="mt-0.5 h-3.5 w-3.5 text-gorola-pine shrink-0" />
            <div className="flex flex-col w-full">
              <span className="text-[10px] text-muted-foreground font-medium mb-0.5">Items</span>
              <ul className="flex flex-col gap-0.5">
                {order.items.map((item, idx) => (
                  <li key={idx} className="text-xs font-semibold text-gorola-charcoal">
                    {item.productName} ({item.variantLabel}) x{item.quantity}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const visibleOrders = activeTab === "PICKUP" ? preparingOrders : deliveringOrders;

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-gorola-fog pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-gorola-charcoal border-gorola-fog">
            {isFieldTechnician ? "Today's Bookings" : "Shift Orders"}
          </h1>
          {isFieldTechnician && (
            <p className="text-xs text-muted-foreground font-medium">Scheduled for today</p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gorola-fog bg-white hover:bg-gorola-fog transition focus:outline-none select-none cursor-pointer"
          aria-label="Refresh orders"
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Top Filter Navigation Tabs */}
      {!isLoading && !error && orders.length > 0 && (
        <div className="flex bg-white border border-gorola-fog rounded-2xl p-1 gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("PICKUP")}
            className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              activeTab === "PICKUP"
                ? "bg-gorola-pine text-white shadow-sm"
                : "text-muted-foreground hover:text-gorola-charcoal hover:bg-gorola-fog/50"
            }`}
          >
            {isFieldTechnician ? "Ready for Visit" : "Ready for Pickup"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DELIVERY")}
            className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              activeTab === "DELIVERY"
                ? "bg-gorola-pine text-white shadow-sm"
                : "text-muted-foreground hover:text-gorola-charcoal hover:bg-gorola-fog/50"
            }`}
          >
            {isFieldTechnician ? "Departed" : "Out for Delivery"}
          </button>
        </div>
      )}

      {/* Main feed content */}
      <div className="flex flex-col gap-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-gorola-pine" />
            <p className="text-sm text-muted-foreground font-medium">Loading active feed...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center">
            <p className="text-sm font-semibold text-destructive">Failed to load active orders.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center justify-center px-4 py-2 border border-destructive/20 text-xs font-semibold text-destructive rounded-full hover:bg-destructive/10 transition focus:outline-none select-none cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gorola-pine/10 flex items-center justify-center mb-2">
              <ShoppingBag className="h-7 w-7 text-gorola-pine" />
            </div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal">
              {isFieldTechnician ? "No active services right now" : "No active orders right now"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs px-4">
              {isFieldTechnician
                ? "When new booking requests are approved at your store, they will appear here."
                : "When new orders are prepared for pickup at your store, they will appear here."}
            </p>
          </div>
        )}

        {!isLoading && !error && orders.length > 0 && (
          <div className="flex flex-col gap-4">
            {visibleOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gorola-fog bg-white/50 p-6 text-center text-sm text-muted-foreground font-medium">
                {isFieldTechnician
                  ? (activeTab === "PICKUP" ? "No services ready for visit." : "No services currently departed.")
                  : (activeTab === "PICKUP" ? "No orders ready for pickup." : "No orders currently in delivery.")}
              </div>
            ) : (
              visibleOrders.map(renderCompactOrderCard)
            )}
          </div>
        )}
      </div>

      {/* Detailed Overlay Modal */}
      {selectedOrder && (
        <div
          data-testid="rider-order-modal"
          className="fixed inset-0 bg-gorola-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start gap-4 border-b border-gorola-fog pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-gorola-pine/10 text-gorola-pine border border-gorola-pine/20">
                  {selectedOrder.orderType === "BOOKING" ? "Service" : "Order"} #{selectedOrder.id.toUpperCase()}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Placed {getElapsedTimeStr(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="h-8 w-8 rounded-full border border-gorola-fog hover:bg-gorola-fog flex items-center justify-center font-bold text-muted-foreground transition-all cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Content details */}
            <div className="flex flex-col gap-4">
              {selectedOrder.orderType === "BOOKING" && selectedOrder.bookingOrder && (
                <div className="flex flex-col gap-2 bg-gorola-fog/60 p-3.5 rounded-2xl border border-gorola-fog">
                  <div className="flex items-center justify-between text-xs font-bold text-gorola-charcoal">
                    <span>Scheduled Visit</span>
                    <span className="bg-gorola-pine/10 text-gorola-pine px-2.5 py-1 rounded-full text-[10px] uppercase font-extrabold">
                      {selectedOrder.bookingOrder.timeslot}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-semibold">
                    Date: {new Date(selectedOrder.bookingOrder.scheduledDate).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short"
                    })}
                  </div>
                  {selectedOrder.bookingOrder.requiresFasting && (
                    <div className="mt-1 text-xs font-semibold text-gorola-saffron flex items-center gap-1">
                      ⚠️ Patient must be fasting
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 text-gorola-pine shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-medium">Buyer Contact</span>
                  <span className="text-sm font-semibold text-gorola-charcoal">{selectedOrder.buyerMaskedPhone}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 text-gorola-pine shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-medium">Delivery Landmark</span>
                  <span className="text-sm text-gorola-charcoal font-semibold">
                    {selectedOrder.deliveryAddress.landmark || "No landmark specified"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ShoppingBag className="mt-0.5 h-4 w-4 text-gorola-pine shrink-0" />
                <div className="flex flex-col w-full">
                  <span className="text-xs text-muted-foreground font-medium mb-1">Items</span>
                  <ul className="flex flex-col gap-1 pl-1">
                    {selectedOrder.items.map((item, idx) => (
                      <li key={idx} className="text-sm font-semibold text-gorola-charcoal">
                        {item.productName} ({item.variantLabel}) x{item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Collapsible Map Section */}
            {selectedOrder.deliveryAddress.lat && selectedOrder.deliveryAddress.lng && (
              <div className="border-t border-gorola-fog pt-4">
                <button
                  onClick={() => setExpandedOrderId(expandedOrderId === selectedOrder.id ? null : selectedOrder.id)}
                  className="text-xs font-bold text-gorola-pine hover:text-gorola-pine-dark flex items-center gap-1 focus:outline-none select-none cursor-pointer"
                  data-testid={`toggle-map-${selectedOrder.id}`}
                >
                  <span>{expandedOrderId === selectedOrder.id ? "Hide Map" : "Show Map"}</span>
                  <span className="text-[10px]">{expandedOrderId === selectedOrder.id ? "▼" : "▶"}</span>
                </button>

                {expandedOrderId === selectedOrder.id && (
                  <div className="mt-3 relative h-64 w-full rounded-xl border border-gorola-fog overflow-hidden shadow-inner animate-in fade-in slide-in-from-top-1 duration-200">
                    <OrderRouteMap
                      buyerCoords={{ lat: selectedOrder.deliveryAddress.lat, lng: selectedOrder.deliveryAddress.lng }}
                      riderCoords={selectedOrder.status === "OUT_FOR_DELIVERY" ? (riderCoords ?? null) : null}
                      className="h-full w-full border-0 rounded-none min-h-[256px]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Action buttons footer */}
            <div className="pt-4 border-t border-gorola-fog flex w-full">
              {selectedOrder.status === "PREPARING" ? (
                <Button
                  className="w-full bg-gorola-pine text-white hover:bg-gorola-pine-dark py-4 text-sm font-semibold h-11 rounded-xl cursor-pointer"
                  onClick={() =>
                    setConfirmingOrder({ id: selectedOrder.id, status: "OUT_FOR_DELIVERY" })
                  }
                >
                  Mark as Out for Delivery
                </Button>
              ) : selectedOrder.status === "APPROVED" ? (
                <Button
                  className="w-full bg-gorola-pine text-white hover:bg-gorola-pine-dark py-4 text-sm font-semibold h-11 rounded-xl cursor-pointer"
                  onClick={() =>
                    setConfirmingOrder({ id: selectedOrder.id, status: "OUT_FOR_DELIVERY" })
                  }
                >
                  Mark as Departed
                </Button>
              ) : selectedOrder.status === "OUT_FOR_DELIVERY" ? (
                <Button
                  className="w-full bg-gorola-pine text-white hover:bg-gorola-pine-dark py-4 text-sm font-semibold h-11 rounded-xl cursor-pointer"
                  onClick={() =>
                    setConfirmingOrder({ id: selectedOrder.id, status: "DELIVERED" })
                  }
                >
                  {selectedOrder.orderType === "BOOKING" ? "Mark Visit Complete" : "Mark as Delivered"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmingOrder && (
        <Dialog open={!!confirmingOrder} onOpenChange={(open) => !open && setConfirmingOrder(null)}>
          <DialogContent className="sm:max-w-sm rounded-2xl p-6" showCloseButton={false}>
            <DialogHeader className="gap-2">
              <DialogTitle className="font-heading text-lg font-bold text-gorola-charcoal">
                Confirm Status Update
              </DialogTitle>
              <DialogDescription className="font-sans text-sm text-muted-foreground">
                Are you sure you want to mark this {selectedOrder?.orderType === "BOOKING" ? "service" : "order"} as{" "}
                <span className="font-semibold text-gorola-charcoal">
                  {confirmingOrder.status === "OUT_FOR_DELIVERY"
                    ? (selectedOrder?.orderType === "BOOKING" ? "Departed" : "Out for Delivery")
                    : (selectedOrder?.orderType === "BOOKING" ? "Visit Complete" : "Delivered")}
                </span>
                ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto rounded-xl"
                onClick={() => setConfirmingOrder(null)}
                disabled={updateStatusMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto bg-gorola-pine text-white hover:bg-gorola-pine-dark rounded-xl"
                onClick={handleConfirmStatusUpdate}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "Updating..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
