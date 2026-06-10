import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LogOut, MapPin, Phone, RefreshCw, ShoppingBag } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
import { useAuthStore } from "@/store/auth.store";

type OrderItem = {
  productName: string;
  variantLabel: string;
  quantity: number;
};

type ActiveOrder = {
  id: string;
  status: "PREPARING" | "OUT_FOR_DELIVERY";
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

export function RiderOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);

  const [confirmingOrder, setConfirmingOrder] = useState<{
    id: string;
    status: "OUT_FOR_DELIVERY" | "DELIVERED";
  } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: "OUT_FOR_DELIVERY" | "DELIVERED" }) => {
      if (!api) throw new Error("API not configured");
      const res = await api.put<{ success: boolean }>(`/api/v1/rider/orders/${orderId}/status`, { status });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["riderActiveOrders"] });
      toast.success(
        `Order marked as ${variables.status === "OUT_FOR_DELIVERY" ? "Out for Delivery" : "Delivered"}!`
      );
      setConfirmingOrder(null);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = ax?.response?.data?.error?.message ?? "Failed to update order status.";
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

  async function handleLogout() {
    try {
      if (api) {
        await api.post("/api/v1/rider/auth/logout", {});
      }
    } catch {
      // Ignore API logout failures during local cleanups
    } finally {
      clearSession();
      const { isSubdomainMode } = resolveSubdomain(window.location.hostname);
      navigate(getScopedPath("/rider/login", "rider", isSubdomainMode), { replace: true });
    }
  }

  const orders = data?.data ?? [];
  const preparingOrders = orders.filter((o) => o.status === "PREPARING");
  const deliveringOrders = orders.filter((o) => o.status === "OUT_FOR_DELIVERY");

  const { coords: riderCoords } = useRiderLocation(deliveringOrders[0]?.id);

  function getElapsedTimeStr(createdAt: string): string {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    if (elapsedMins < 1) return "Just now";
    if (elapsedMins < 60) return `${elapsedMins}m ago`;
    const elapsedHours = Math.floor(elapsedMins / 60);
    return `${elapsedHours}h ago`;
  }

  function renderOrderCard(order: ActiveOrder) {
    const isExpanded = expandedOrderId === order.id;

    return (
      <div
        key={order.id}
        className="flex flex-col gap-4 rounded-2xl border border-gorola-fog bg-white p-5 shadow-sm transition hover:shadow-md"
      >
        <div className="flex items-center justify-between border-b border-gorola-fog pb-3">
          <span className="font-heading text-sm font-semibold text-gorola-charcoal">
            Order #{order.id.slice(-6).toUpperCase()}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{getElapsedTimeStr(order.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <Phone className="mt-0.5 h-4 w-4 text-gorola-pine" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium">Buyer Contact</span>
              <span className="text-sm font-semibold text-gorola-charcoal">{order.buyerMaskedPhone}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 text-gorola-pine" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium">Delivery Landmark</span>
              <span className="text-sm text-gorola-charcoal font-medium">
                {order.deliveryAddress.landmark || "No landmark specified"}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <ShoppingBag className="mt-0.5 h-4 w-4 text-gorola-pine" />
            <div className="flex flex-col w-full">
              <span className="text-xs text-muted-foreground font-medium mb-1">Items</span>
              <ul className="flex flex-col gap-1 pl-1">
                {order.items.map((item, idx) => (
                  <li key={idx} className="text-sm font-medium text-gorola-charcoal">
                    {item.productName} ({item.variantLabel}) x{item.quantity}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Collapsible Map Section */}
        {order.deliveryAddress.lat && order.deliveryAddress.lng && (
          <div className="border-t border-gorola-fog pt-4 mt-2">
            <button
              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
              className="text-xs font-bold text-gorola-pine hover:text-gorola-pine-dark flex items-center gap-1 focus:outline-none select-none cursor-pointer"
              data-testid={`toggle-map-${order.id}`}
            >
              <span>{isExpanded ? "Hide Map" : "Show Map"}</span>
              <span className="text-[10px]">{isExpanded ? "▼" : "▶"}</span>
            </button>

            {isExpanded && (
              <div className="mt-3 relative h-64 w-full rounded-xl border border-gorola-fog overflow-hidden shadow-inner animate-in fade-in slide-in-from-top-1 duration-200">
                <OrderRouteMap
                  buyerCoords={{ lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng }}
                  riderCoords={order.status === "OUT_FOR_DELIVERY" ? (riderCoords ?? null) : null}
                  className="h-full w-full border-0 rounded-none min-h-[256px]"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex w-full border-t border-gorola-fog pt-4">
          {order.status === "PREPARING" ? (
            <Button
              className="w-full bg-gorola-pine text-white hover:bg-gorola-pine-dark py-4 text-sm font-semibold h-11 rounded-xl cursor-pointer"
              onClick={() =>
                setConfirmingOrder({ id: order.id, status: "OUT_FOR_DELIVERY" })
              }
            >
              Mark as Out for Delivery
            </Button>
          ) : order.status === "OUT_FOR_DELIVERY" ? (
            <Button
              className="w-full bg-gorola-pine text-white hover:bg-gorola-pine-dark py-4 text-sm font-semibold h-11 rounded-xl cursor-pointer"
              onClick={() =>
                setConfirmingOrder({ id: order.id, status: "DELIVERED" })
              }
            >
              Mark as Delivered
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gorola-fog/30 font-sans pb-16">
      {/* Header bar */}
      <header className="sticky top-0 z-30 border-b border-gorola-fog bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 w-full">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gorola-pine/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-gorola-pine" />
            </div>
            <h1 className="font-heading text-lg font-bold text-gorola-charcoal">Shift Orders</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gorola-fog hover:bg-gorola-fog transition focus:outline-none"
              aria-label="Refresh orders"
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gorola-fog hover:bg-destructive/10 hover:border-destructive/20 transition focus:outline-none"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
      </header>

      {/* Main feed content */}
      <main className="mx-auto max-w-6xl p-5 md:p-8 flex flex-col gap-6">
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
              className="mt-3 inline-flex items-center justify-center px-4 py-2 border border-destructive/20 text-xs font-semibold text-destructive rounded-full hover:bg-destructive/10 transition focus:outline-none"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gorola-pine/10 flex items-center justify-center mb-2">
              <ShoppingBag className="h-7 w-7 text-gorola-pine" />
            </div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal">No active orders right now</h2>
            <p className="text-sm text-muted-foreground max-w-xs px-4">
              When new orders are prepared for pickup at your store, they will appear here.
            </p>
          </div>
        )}

        {!isLoading && !error && orders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Ready for Pickup section */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-heading text-sm font-bold tracking-wide text-gorola-charcoal uppercase">
                  Ready for Pickup ({preparingOrders.length})
                </h2>
              </div>
              {preparingOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gorola-fog bg-white/50 p-6 text-center text-sm text-muted-foreground font-medium">
                  No orders ready for pickup.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {preparingOrders.map(renderOrderCard)}
                </div>
              )}
            </div>

            {/* Out for Delivery section */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-heading text-sm font-bold tracking-wide text-gorola-charcoal uppercase">
                  Out for Delivery ({deliveringOrders.length})
                </h2>
              </div>
              {deliveringOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gorola-fog bg-white/50 p-6 text-center text-sm text-muted-foreground font-medium">
                  No orders currently in delivery.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {deliveringOrders.map(renderOrderCard)}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {confirmingOrder && (
        <Dialog open={!!confirmingOrder} onOpenChange={(open) => !open && setConfirmingOrder(null)}>
          <DialogContent className="sm:max-w-sm rounded-2xl p-6" showCloseButton={false}>
            <DialogHeader className="gap-2">
              <DialogTitle className="font-heading text-lg font-bold text-gorola-charcoal">
                Confirm Status Update
              </DialogTitle>
              <DialogDescription className="font-sans text-sm text-muted-foreground">
                Are you sure you want to mark this order as{" "}
                <span className="font-semibold text-gorola-charcoal">
                  {confirmingOrder.status === "OUT_FOR_DELIVERY" ? "Out for Delivery" : "Delivered"}
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
