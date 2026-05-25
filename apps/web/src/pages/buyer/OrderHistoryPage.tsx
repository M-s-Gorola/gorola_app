import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, ChevronRight, Clock, MessageSquare, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { syncBuyerCartFromServer } from "@/lib/buyer-cart-sync";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  variantLabel: string;
  price: string;
};

type Order = {
  id: string;
  total: string;
  status: string;
  orderType?: string;
  createdAt: string;
  store: {
    name: string;
    storeType?: string;
  };
  items: OrderItem[];
  rating: boolean | null;
  ratingComment: string | null;
};

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ratingComment, setRatingComment] = useState<Record<string, string>>({});
  const [activeRating, setActiveRating] = useState<string | null>(null);

  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: orders, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["orders", "history"],
    queryFn: async () => {
      const res = await api!.get("/api/v1/orders/history");
      return res.data.data.orders as Order[];
    }
  });

  useEffect(() => {
    if (!accessToken || !orders || orders.length === 0) return;

    // Filter orders that are not in a final state (DELIVERED or CANCELLED)
    const activeOrders = orders.filter(
      (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED"
    );
    if (activeOrders.length === 0) return;

    console.log("🔌 [OrderHistorySocket] Found active orders to monitor:", activeOrders.map(o => o.id));
    const host = window.location.hostname;
    const baseURL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${host}:3001`;
    
    const socket = io(baseURL, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("🔌 [OrderHistorySocket] Connected. Joining rooms...");
      activeOrders.forEach((o) => {
        socket.emit("join_order", o.id);
      });
    });

    socket.on("order_status_changed", (data: { orderId: string; status: string }) => {
      console.log(`🔌 [OrderHistorySocket] Status update received for order ${data.orderId}: ${data.status}`);
      toast.info(`📦 Order status updated: ${data.status}`, {
        description: `Order #${data.orderId.substring(0, 8).toUpperCase()} is now ${data.status.replace(/_/g, ' ')}.`
      });
      void queryClient.invalidateQueries({ queryKey: ["orders", "history"] });
    });

    socket.on("error", (err: unknown) => {
      console.error("🔌 [OrderHistorySocket] Socket error:", err);
    });

    return () => {
      console.log("🔌 [OrderHistorySocket] Cleaning up connection.");
      socket.disconnect();
    };
  }, [orders, accessToken, queryClient]);

  const reorderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api!.post(`/api/v1/orders/${orderId}/reorder`);
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      toast.success("Items added to cart");
      void syncBuyerCartFromServer().then(() => {
        useCartStore.getState().open();
      });
    },
    onError: () => {
      toast.error("Failed to reorder items");
    }
  });

  const rateMutation = useMutation({
    mutationFn: async ({ orderId, rating, comment }: { orderId: string; rating: boolean; comment?: string | undefined }) => {
      const res = await api!.put(`/api/v1/orders/${orderId}/rate`, { 
        rating,
        ratingComment: comment 
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success("Thank you for your rating!");
      setActiveRating(null);
      queryClient.invalidateQueries({ queryKey: ["orders", "history"] });
    },
    onError: () => {
      toast.error("Failed to submit rating");
    }
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gorola-charcoal/10 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center space-y-4 py-20">
        <div className="w-20 h-20 bg-gorola-charcoal/5 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-gorola-charcoal/20" />
        </div>
        <h1 className="text-2xl font-bold text-gorola-charcoal">No orders yet</h1>
        <p className="text-gorola-charcoal/60">Your past orders will appear here.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 px-6 py-2 bg-gorola-pine text-white font-semibold rounded-full hover:bg-gorola-pine/90 transition-colors shadow-lg shadow-gorola-pine/20"
        >
          Browse Products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pb-24">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gorola-charcoal">Order History</h1>
          <p className="text-gorola-charcoal/60 mt-1">Manage and track your past deliveries</p>
        </div>
        <button
          onClick={async () => {
            const toastId = toast.loading("Syncing order history...");
            try {
              await refetch();
              toast.success("Order history synchronized!", { id: toastId });
            } catch {
              toast.error("Failed to sync order history", { id: toastId });
            }
          }}
          disabled={isFetching}
          className="p-3 bg-white border border-gorola-pine/10 hover:border-gorola-pine/20 rounded-full text-gorola-pine hover:bg-gorola-pine/5 transition-all shadow-sm flex items-center justify-center disabled:opacity-50"
          title="Refresh History"
        >
          <RefreshCcw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            data-testid="order-card"
            className="group relative bg-white border border-gorola-charcoal/10 rounded-2xl overflow-hidden hover:border-gorola-pine/30 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-gorola-charcoal">{order.store.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : 
                    order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {order.status === 'DELIVERED' && (order.orderType === 'BOOKING' || order.store?.storeType === 'BOOKING_COMMERCE') ? 'COMPLETED' : order.status}
                  </span>
                </div>
                <p className="text-sm text-gorola-charcoal/40">
                  {format(new Date(order.createdAt), "MMM d, yyyy • h:mm a")}
                </p>
                <div className="pt-2 text-sm text-gorola-charcoal/70">
                  {order.items.map(i => `${i.quantity}x ${i.productName}`).join(", ")}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gorola-charcoal/40 uppercase tracking-widest font-bold">Total</p>
                  <p className="text-xl font-black text-gorola-charcoal">₹{order.total}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => reorderMutation.mutate(order.id)}
                    disabled={reorderMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-gorola-pine text-white hover:bg-gorola-pine/90 rounded-xl font-bold text-sm transition-all duration-300 disabled:opacity-50 shadow-md shadow-gorola-pine/10"
                    aria-label="Reorder"
                  >
                    <RefreshCcw 
                      className={`w-4 h-4 ${(reorderMutation.isPending && reorderMutation.variables === order.id) ? 'animate-spin' : ''}`} 
                    />
                    Reorder
                  </button>
                  <button
                    onClick={() => {
                      if (order.orderType === "BOOKING" || order.store?.storeType === "BOOKING_COMMERCE") {
                        navigate(`/bookings/${order.id}`);
                      } else {
                        navigate(`/orders/${order.id}`);
                      }
                    }}
                    className="p-2 bg-gorola-charcoal/5 hover:bg-gorola-charcoal/10 rounded-xl text-gorola-charcoal/60 hover:text-gorola-charcoal transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Rating Section for Delivered Orders */}
            {order.status === "DELIVERED" && (
              <div className="px-5 py-3 bg-gorola-charcoal/[0.02] border-t border-gorola-charcoal/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gorola-charcoal/40 font-medium">
                    {order.rating !== null ? (
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-green-600 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Rating submitted
                        </span>
                        {order.ratingComment && (
                          <p className="text-[10px] text-gorola-charcoal/50 italic">"{order.ratingComment}"</p>
                        )}
                      </div>
                    ) : (
                      "How was your order?"
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveRating(activeRating === `${order.id}:up` ? null : `${order.id}:up`)}
                      disabled={order.rating !== null || (rateMutation.isPending && rateMutation.variables?.orderId === order.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        order.rating === true || activeRating === `${order.id}:up`
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : 'bg-gorola-charcoal/5 text-gorola-charcoal/60 hover:bg-gorola-charcoal/10 hover:text-gorola-charcoal'
                      } disabled:opacity-50`}
                      aria-label="Thumbs Up"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {order.rating === true ? "Liked" : ""}
                    </button>
                    <button
                      onClick={() => setActiveRating(activeRating === `${order.id}:down` ? null : `${order.id}:down`)}
                      disabled={order.rating !== null || (rateMutation.isPending && rateMutation.variables?.orderId === order.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        order.rating === false || activeRating === `${order.id}:down`
                          ? 'bg-red-100 text-red-700 border border-red-200' 
                          : 'bg-gorola-charcoal/5 text-gorola-charcoal/60 hover:bg-gorola-charcoal/10 hover:text-gorola-charcoal'
                      } disabled:opacity-50`}
                      aria-label="Thumbs Down"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      {order.rating === false ? "Disliked" : ""}
                    </button>
                  </div>
                </div>

                {/* Comment Box */}
                {activeRating?.startsWith(order.id) && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="relative group/input">
                      <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gorola-charcoal/20 group-focus-within/input:text-gorola-charcoal/40 transition-colors" />
                      <textarea
                        value={ratingComment[order.id] || ""}
                        onChange={(e) => setRatingComment({ ...ratingComment, [order.id]: e.target.value })}
                        placeholder="Any feedback for the store? (Optional)"
                        className="w-full bg-white border border-gorola-charcoal/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gorola-charcoal placeholder:text-gorola-charcoal/20 focus:outline-none focus:border-gorola-pine/30 transition-all resize-none h-20 shadow-inner"
                      />
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => rateMutation.mutate({ 
                          orderId: order.id, 
                          rating: activeRating.endsWith(":up"), 
                          comment: ratingComment[order.id] 
                        })}
                        className="px-4 py-1.5 bg-gorola-pine text-white text-xs font-bold rounded-lg hover:bg-gorola-pine/90 transition-colors shadow-md shadow-gorola-pine/10 disabled:opacity-50"
                        disabled={rateMutation.isPending && rateMutation.variables?.orderId === order.id}
                      >
                        Submit Feedback
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
