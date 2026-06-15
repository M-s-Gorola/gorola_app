import "leaflet/dist/leaflet.css";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { Bike, CheckCircle2, Home, MessageSquare, Package } from "lucide-react";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { OrderRouteMap } from "@/components/shared/OrderRouteMap";
import { StarRating } from "@/components/shared/StarRating";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useWeatherStore } from "@/store/weather.store";


export type BuyerOrderConfirmationItem = {
  id: string;
  orderId: string;
  price: string;
  productName: string;
  productVariantId: string;
  quantity: number;
  variantLabel: string;
};

export type StatusHistoryItem = {
  changedAt: string;
  id: string;
  status: string;
};

export type BuyerOrderDetail = {
  createdAt?: string;
  deliveryFee: string;
  discount?: {
    amount: string;
    code: string | null;
  };
  id: string;
  orderType?: string;
  items: BuyerOrderConfirmationItem[];
  landmarkDescription: string;
  addressLabel?: string | null;
  flatRoom?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  paymentMethod: string;
  rating: number | null;
  ratingComment: string | null;
  scheduledFor?: string | null;
  status: string;
  statusHistory?: StatusHistoryItem[];
  store: {
    id: string;
    name: string;
    phone: string;
    storeType?: string;
  };
  subtotal: string;
  total: string;
};


function formatPayment(method: string): string {
  if (method === "COD") return "Cash on delivery";
  if (method === "UPI") return "UPI";
  if (method === "CARD") return "Card";
  return method;
}


function telHref(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return "#";
  }
  return `tel:${trimmed}`;
}

/** Short ref in primary copy; full id in `title` + screen-reader text for support. */
function formatOrderRefForUi(fullId: string): string {
  if (fullId.length <= 14) {
    return fullId;
  }
  return `…${fullId.slice(-8)}`;
}

function calculateDeliveryDuration(history: StatusHistoryItem[], createdAt?: string): string | null {
  const placed = history.find((h) => h.status === "PLACED");
  const delivered = history.find((h) => h.status === "DELIVERED");
  
  const startTime = placed?.changedAt ?? createdAt;
  const endTime = delivered?.changedAt;

  if (!startTime || !endTime) return null;

  const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const mins = Math.floor(diffMs / 60000);
  return mins > 0 ? `${mins}m` : "< 1m";
}

function AddressBlock({ order }: { order: BuyerOrderDetail }): ReactElement {
  return (
    <div className="space-y-1 text-left">
      {order.addressLabel && (
        <div className="flex items-center gap-1.5 font-dm-sans text-sm font-bold text-gorola-charcoal">
          <Home className="h-3.5 w-3.5 text-gorola-pine" />
          {order.addressLabel}
        </div>
      )}
      <p className="font-dm-sans text-sm text-gorola-slate">
        {order.flatRoom ? `${order.flatRoom}, ` : ""}
        {order.landmarkDescription}
      </p>
    </div>
  );
}

/** Honest ETA copy — avoids fake countdowns until scheduling + notifications are modeled. */
function estimatedDeliveryCopy(
  order: BuyerOrderDetail,
  isWeatherMode: boolean,
): ReactElement | null {
  if (typeof order.scheduledFor === "string" && order.scheduledFor.length > 0) {
    const dt = new Date(order.scheduledFor);
    const ok = Number.isFinite(dt.valueOf());
    return (
      <p className="font-dm-sans text-sm text-gorola-charcoal">
        {ok ? (
          <>
            Scheduled window:{" "}
            <time dateTime={order.scheduledFor}>{dt.toLocaleString()}</time>
          </>
        ) : (
          <>
            Scheduling note on file—we’ll notify you if anything changes.
          </>
        )}
      </p>
    );
  }

  if (isWeatherMode) {
    return (
      <p className="font-dm-sans text-sm leading-relaxed text-gorola-charcoal">
        Roads may be slower tonight around Mussoorie. Your order window may widen a little—we&apos;ll notify you if the
        timing shifts rather than guessing a fake countdown here.
      </p>
    );
  }

  return (
    <p className="font-dm-sans text-sm leading-relaxed text-gorola-charcoal">
      Preparation and arrival times vary by store load and neighbourhood. You&apos;ll get updates here and by message
      as your order progresses—without invented minute-by-minute ETA games.
    </p>
  );
}

function StatusStepper({
  history,
  status,
  riderLocation,
  order
}: {
  history: StatusHistoryItem[];
  status: string;
  riderLocation: { lat: number; lng: number } | null;
  order: BuyerOrderDetail;
}): ReactElement {
  const steps = [
    { icon: CheckCircle2, key: "PLACED", label: "Placed" },
    { icon: Package, key: "PREPARING", label: "Preparing" },
    { icon: Bike, key: "OUT_FOR_DELIVERY", label: "On the way" },
    { icon: CheckCircle2, key: "DELIVERED", label: "Delivered" },
  ];

  const isCancelled = status === "CANCELLED";
  const currentIndex = steps.findIndex((s) => s.key === status);

  if (isCancelled) {
    return (
      <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-left">
        <p className="font-dm-sans text-sm font-semibold text-red-700">Order Cancelled</p>
        <p className="font-dm-sans text-xs text-red-600/80">
          This order was cancelled. Any refunds will be processed according to your payment method.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full py-6">
      <div className="relative flex justify-between">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 -z-10 h-0.5 w-full bg-gorola-slate-mist" />
        <div
          className="absolute top-5 left-0 -z-10 h-0.5 bg-gorola-pine transition-all duration-700"
          style={{ width: `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%` }}
        />

        {steps.map((step, i) => {
          const Icon = step.icon;
          const isCompleted = i < currentIndex || (status === "DELIVERED" && i === currentIndex);
          const isActive = i === currentIndex && status !== "DELIVERED";
          const hist = history.find((h) => h.status === step.key);

          return (
            <div className="flex flex-col items-center gap-2" key={step.key}>
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white transition-colors duration-500",
                  isCompleted || isActive
                    ? "border-gorola-pine text-gorola-pine"
                    : "border-gorola-slate-mist text-gorola-slate",
                  isActive && "ring-4 ring-gorola-pine/10",
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "animate-pulse")} />
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-[11px] font-bold tracking-wider",
                    isActive || isCompleted ? "text-gorola-pine" : "text-gorola-slate",
                  )}
                >
                  {step.label}
                </p>
                {hist !== undefined ? (
                  <p className="font-dm-sans text-[10px] text-gorola-slate">
                    {new Date(hist.changedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {status === "OUT_FOR_DELIVERY" ? (
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
            </div>
            <p className="font-dm-sans text-sm">
              <strong>Rider location:</strong> Your rider is on the way with your order.
            </p>
          </div>

          {/* Live Tracking Map Container */}
          <div className="relative h-64 w-full rounded-lg border border-amber-200/60 overflow-hidden bg-amber-100/30 mt-1" data-testid="rider-location-map-container">
            {riderLocation ? (
              <OrderRouteMap
                buyerCoords={{ lat: order.deliveryLat ?? 30.4598, lng: order.deliveryLng ?? 78.0664 }}
                riderCoords={riderLocation}
                className="h-full w-full border-0 rounded-none min-h-[256px]"
              />
            ) : (
              <div className="flex items-center justify-center h-full w-full">
                <p className="text-xs text-amber-800/80 italic animate-pulse">Waiting for rider GPS updates...</p>
              </div>
            )}
          </div>

          {riderLocation ? (
            <div className="mt-1 text-xs font-mono bg-white/60 p-2 rounded-lg border border-amber-200/50" data-testid="rider-location-display">
              Rider Coordinates: {riderLocation.lat.toFixed(5)}, {riderLocation.lng.toFixed(5)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function OrderConfirmationPage(): ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const rootRef = useRef<HTMLElement | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);
  const entranceDoneRef = useRef(false);
  const [animationFinished, setAnimationFinished] = useState(false);
  const [showStatusTransitionBloom, setShowStatusTransitionBloom] = useState(false);
  const [isDiscountExpanded, setIsDiscountExpanded] = useState(false);
  const [activeRating, setActiveRating] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState("");
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);

  const queryClient = useQueryClient();

  const rateMutation = useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment?: string | undefined }) => {
      const res = await api!.put(`/api/v1/orders/${id}/rate`, { 
        rating,
        ratingComment: comment 
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success("Thank you for your rating!");
      setActiveRating(null);
      setRatingComment("");
      void queryClient.invalidateQueries({ queryKey: ["buyer-order-confirmation", id] });
      void queryClient.invalidateQueries({ queryKey: ["orders", "history"] });
    },
    onError: () => {
      toast.error("Failed to submit rating");
    }
  });

  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);
  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);
 
 
  const query = useQuery({
    enabled: !isBootstrapPending && id !== undefined,
    queryKey: ["buyer-order-confirmation", id ?? null],
    queryFn: async (): Promise<BuyerOrderDetail> => {
      const response = await api!.get<{ success: boolean; data: BuyerOrderDetail }>(
        `/api/v1/orders/${id}`
      );
      const payload = response.data;
      if (payload.success !== true || payload.data === undefined) {
        throw new Error("Invalid order confirmation response");
      }
      return payload.data;
    },
  });

  const order = query.data;

interface StoreOffer {
  id: string;
  title: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

  const storeId = order?.store?.id;
  const { data: offersResponse } = useQuery({
    enabled: !!storeId && !isBootstrapPending,
    queryKey: ["promotions", "store", storeId, "offers"],
    queryFn: async () => {
      const res = await api!.get<{ success: boolean; data: StoreOffer[] }>(`/api/v1/promotions/store/${storeId}/offers`);
      return res.data;
    }
  });

  const getAppliedDiscounts = (order: BuyerOrderDetail) => {
    const subtotal = Number(order.subtotal);
    const deliveryFee = Number(order.deliveryFee);
    const total = Number(order.total);
    const discountAmount = Number((subtotal + deliveryFee - total).toFixed(2));
    if (discountAmount <= 0) return [];

    const offers = Array.isArray(offersResponse?.data) ? offersResponse.data : [];
    const orderTime = new Date(order.createdAt || "").getTime();

    // Find all offers that were active at the order's creation time
    const matchedOffers = (offers as StoreOffer[]).filter((o) => {
      const start = new Date(o.startsAt).getTime();
      const end = new Date(o.endsAt).getTime();
      return orderTime >= start && orderTime <= end;
    });

    const result: { label: string; amount: number }[] = [];
    let remainingDiscount = discountAmount;

    for (const offer of matchedOffers) {
      const minOrder = offer.minOrderAmount ?? 0;
      if (subtotal < minOrder) continue;

      let offerDiscount = 0;
      if (offer.discountType === "PERCENTAGE") {
        offerDiscount = (subtotal * offer.discountValue) / 100;
        if (offer.maxDiscount !== null && offer.maxDiscount !== undefined) {
          offerDiscount = Math.min(offerDiscount, offer.maxDiscount);
        }
      } else {
        offerDiscount = offer.discountValue;
      }
      offerDiscount = Number(Math.min(subtotal, offerDiscount).toFixed(2));

      if (offerDiscount > 0 && remainingDiscount > 0) {
        const appliedAmt = Number(Math.min(remainingDiscount, offerDiscount).toFixed(2));
        if (appliedAmt > 0.05) {
          result.push({
            label: `Discount (${offer.title})`,
            amount: appliedAmt
          });
          remainingDiscount = Number((remainingDiscount - appliedAmt).toFixed(2));
        }
      }
    }

    if (remainingDiscount > 0.05) {
      result.push({
        label: order.discount?.code ? `Discount (${order.discount.code})` : "Discount",
        amount: remainingDiscount
      });
    }

    return result;
  };
  useEffect(() => {
    if (order && (order.orderType === "BOOKING" || order.store?.storeType === "BOOKING_COMMERCE")) {
      navigate(`/bookings/${order.id}`, { replace: true });
    }
  }, [order, navigate]);

  const onStatusChanged = useCallback(
    (data: { orderId: string; status: string }) => {
      if (data.orderId === id) {
        queryClient.setQueryData(
          ["buyer-order-confirmation", id],
          (old: BuyerOrderDetail | undefined) => {
            if (old === undefined) return old;
            const alreadyHasStatus = old.statusHistory?.some((h) => h.status === data.status);
            if (alreadyHasStatus) return { ...old, status: data.status };

            const newHistoryItem: StatusHistoryItem = {
              changedAt: new Date().toISOString(),
              id: `temp-${Date.now()}`,
              status: data.status,
            };

            return {
              ...old,
              status: data.status,
              statusHistory: [...(old.statusHistory ?? []), newHistoryItem],
            };
          },
        );
      }
    },
    [id, queryClient],
  );

  const onLocationUpdated = useCallback(
    (data: { lat: number; lng: number }) => {
      setRiderLocation({ lat: data.lat, lng: data.lng });
    },
    []
  );

  useOrderSocket(id, onStatusChanged, onLocationUpdated);

  const currentStatus = query.data?.status;
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentStatus && lastStatusRef.current && lastStatusRef.current !== currentStatus) {
      setShowStatusTransitionBloom(true);
      setAnimationFinished(false);
      entranceDoneRef.current = false;
    }
    lastStatusRef.current = currentStatus ?? null;
  }, [currentStatus]);

  useEffect(() => {
    entranceDoneRef.current = false;
    setAnimationFinished(false);
    setShowStatusTransitionBloom(false);
    setRiderLocation(null);
  }, [id]);

  const isRecentlyPlaced = query.isSuccess && query.data.createdAt ? (
    Date.now() - new Date(query.data.createdAt).getTime() < 60000
  ) : false;

  const shouldShowBloom = query.isSuccess && (
    (query.data.status === "PLACED" || isRecentlyPlaced || showStatusTransitionBloom) && !animationFinished
  );

  useLayoutEffect(() => {
    if (!query.isSuccess || query.data === undefined || entranceDoneRef.current) {
      return;
    }
    const root = rootRef.current;
    const bloom = bloomRef.current;
    if (!root) {
      return;
    }

    // If we shouldn't show bloom, just show content immediately
    if (!shouldShowBloom) {
      entranceDoneRef.current = true;
      setAnimationFinished(true);
      gsap.set(".occ-content", { autoAlpha: 1, y: 0 });
      return;
    }

    if (!bloom) return;
    entranceDoneRef.current = true;

    const ctx = gsap.context(() => {
      gsap.set(bloom, { autoAlpha: 1 });
      gsap.set(".occ-content", { autoAlpha: 0, y: 24 });
      const path = root.querySelector<SVGPathElement>(".occ-check-path");
      let length = 80;
      if (path !== null) {
        try {
          length = path.getTotalLength();
        } catch {
          length = 80;
        }
        gsap.set(path, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
      }

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          setAnimationFinished(true);
          setShowStatusTransitionBloom(false);
        }
      });

      // 1. Initial hold on the green screen for "Impact"
      tl.to({}, { duration: 0.75 }) 
        // 2. Slow fade of the bloom
        .to(bloom, { autoAlpha: 0, duration: 1.1 })
        // 3. Draw the checkmark with impact
        .to(
          ".occ-check-path",
          { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" },
          "-=0.7"
        )
        // 4. Smooth content reveal
        .to(".occ-content", { autoAlpha: 1, y: 0, duration: 0.8 }, "-=0.5");
    }, root);

    return (): void => {
      ctx.revert();
    };
  }, [query.isSuccess, query.data, id, shouldShowBloom]);

  return (
    <section
      ref={rootRef}
      aria-labelledby={query.isSuccess ? "occ-heading" : "occ-heading-loading"}
      className="relative overflow-hidden pb-16 pt-8"
      data-order-confirmation="true"
    >
      {!query.isSuccess ? (
        <div className="relative z-[1] space-y-3">
          <h1 className="font-playfair text-3xl text-gorola-charcoal" id="occ-heading-loading">
            Order confirmation
          </h1>
          {query.isLoading ? (
            <p className="font-dm-sans text-sm text-gorola-slate">Loading your order…</p>
          ) : null}
          {query.isError ? (
            <div className="space-y-2 rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700" role="alert">
              <p>Could not load order details.</p>
              {typeof id === "string" ? (
                <p className="text-xs text-red-800">
                  Support reference: <span className="font-mono break-all">{id}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {query.isSuccess && query.data ? (
        (() => {
          const order = query.data;

          const weatherPulse =
            isWeatherMode ?
              (
                <div
                  className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 font-dm-sans text-sm text-amber-950"
                  role="status"
                >
                  Weather-aware delivery tonight: batches may merge when visibility is poor—we&apos;ll be straight with you
                  in messages rather than flashy fake timers on this screen.
                </div>
              )
            : null;

          return (
            <>
              {shouldShowBloom && (
                <div
                  ref={bloomRef}
                  aria-hidden={true}
                  className="occ-bloom pointer-events-none fixed inset-0 z-[100] bg-gradient-to-br from-emerald-400/95 via-gorola-pine to-emerald-900/90"
                />
              )}
              <div className="occ-content relative z-[1] mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
              <svg
                aria-hidden={true}
                className="occ-check h-20 w-20 text-gorola-pine"
                fill="none"
                viewBox="0 0 64 64"
              >
                <circle
                  className="opacity-35"
                  cx="32"
                  cy="32"
                  r={28}
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  className="occ-check-path"
                  d="M18 34 L28 43 L46 23"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                />
              </svg>

              <div className="space-y-1">
                <div className="flex flex-col items-center gap-2">
                  <h1 className="font-playfair text-3xl text-gorola-charcoal" id="occ-heading">
                    {order.status === "DELIVERED" ? "Order Delivered" : 
                     order.status === "PLACED" ? "Thank you" :
                     order.status === "PREPARING" ? "Store is picking items" :
                     order.status === "OUT_FOR_DELIVERY" ? "On the way" :
                     order.status === "CANCELLED" ? "Order Cancelled" : "Order Status"}
                  </h1>
                  {order.status === "DELIVERED" && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Delivered in {calculateDeliveryDuration(order.statusHistory ?? [], order.createdAt) ?? "15m"}
                    </div>
                  )}
                </div>
                <p className="font-dm-sans text-sm text-gorola-slate">
                  <span className="sr-only">Full order reference {order.id}. </span>
                  Order{" "}
                  <span
                    className="font-mono font-semibold text-gorola-charcoal"
                    title={`Full order reference: ${order.id}`}
                  >
                    {formatOrderRefForUi(order.id)}
                  </span>{" "}
                  {order.status === "DELIVERED" ? "was delivered from" : 
                   order.status === "CANCELLED" ? "from" : "is being handled by"}{" "}
                  <span className="font-semibold text-gorola-charcoal">{order.store.name}</span>.
                </p>
              </div>


              {weatherPulse}

              <div className={cn(
                "w-full space-y-4 rounded-2xl border bg-white p-5 text-left transition-all duration-500",
                order.status === "PLACED" ? "border-amber-200 shadow-amber-100/10 border-l-4 border-l-amber-500" :
                order.status === "PREPARING" ? "border-indigo-200 shadow-indigo-100/10 border-l-4 border-l-indigo-500" :
                order.status === "OUT_FOR_DELIVERY" ? "border-blue-200 shadow-blue-100/10 border-l-4 border-l-blue-500" :
                order.status === "DELIVERED" ? "border-emerald-200 shadow-emerald-100/10 border-l-4 border-l-emerald-500" :
                "border-red-200 shadow-red-100/10 border-l-4 border-l-red-500"
              )}>
                {/* Dynamic Status Alert Banner */}
                <div className={cn("rounded-2xl p-4 transition-all duration-300", 
                  order.status === "PLACED" ? "bg-amber-50 border border-amber-200 text-amber-800" :
                  order.status === "PREPARING" ? "bg-indigo-50 border border-indigo-200 text-indigo-800" :
                  order.status === "OUT_FOR_DELIVERY" ? "bg-blue-50 border border-blue-200 text-blue-800" :
                  order.status === "DELIVERED" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" :
                  "bg-red-50 border border-red-200 text-red-800"
                )}>
                  <p className="font-dm-sans text-sm font-semibold">
                    {order.status === "PLACED" ? "Your order has been placed. Waiting for the store to accept and start picking your items." :
                     order.status === "PREPARING" ? "👨‍🍳 The store has accepted and is picking/packaging your items!" :
                     order.status === "OUT_FOR_DELIVERY" ? "🚴 Your rider is on the way! Live tracking is active." :
                     order.status === "DELIVERED" ? "🎉 Your order has been delivered! Hope you enjoy your purchase." :
                     "⚠️ This order was cancelled. Any refunds will be processed soon."}
                  </p>
                </div>

                <div className="flex justify-between items-baseline gap-2 pb-1 border-b border-gorola-pine/10 pb-2">
                  <h2 className="font-playfair text-lg font-bold text-gorola-charcoal">Your items</h2>
                  {order.store && (
                    <span className="font-dm-sans text-xs text-gorola-slate">
                      from <span className="font-semibold text-gorola-charcoal">{order.store.name}</span>
                    </span>
                  )}
                </div>
                <ul aria-label="Order items" className="space-y-2">
                  {order.items.map((line) => (
                    <li
                      className="flex justify-between gap-3 border-b border-gorola-pine/10 pb-2 font-dm-sans text-sm last:border-0 last:pb-0"
                      key={line.id}
                    >
                      <span className="text-gorola-charcoal">
                        {line.productName}{" "}
                        <span className="text-gorola-slate">({line.variantLabel}) × {line.quantity}</span>
                      </span>
                      <span className="shrink-0 font-medium text-gorola-charcoal">
                        Rs {(Number(line.price) * line.quantity).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-1.5 border-t border-gorola-pine/10 pt-3 font-dm-sans text-sm text-gorola-charcoal">
                  <div className="flex justify-between" data-testid="order-subtotal">
                    <span className="text-gorola-slate">Subtotal:</span>
                    <span className="font-medium">Rs {order.subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gorola-slate">Delivery fee:</span>
                    <span className="font-medium">Rs {order.deliveryFee}</span>
                  </div>
                  {(() => {
                    const applied = getAppliedDiscounts(order);
                    const totalAmt = applied.reduce((sum, d) => sum + d.amount, 0);
                    if (totalAmt <= 0) return null;
                    return (
                      <div className="space-y-1" data-testid="discount-summary-row">
                        <div className="flex justify-between items-center text-emerald-700">
                          <button
                            type="button"
                            onClick={() => setIsDiscountExpanded(!isDiscountExpanded)}
                            data-testid="discount-breakdown-toggle"
                            aria-expanded={isDiscountExpanded}
                            className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 transition-colors font-medium focus:outline-none"
                          >
                            <span>Discount:</span>
                            <span className="text-[10px] transform transition-transform duration-200">
                              {isDiscountExpanded ? "▼" : "▶"}
                            </span>
                          </button>
                          <span className="font-medium">-Rs {totalAmt.toFixed(2)}</span>
                        </div>
                        {isDiscountExpanded && (
                          <div className="space-y-1 pl-3 border-l border-emerald-100" data-testid="discount-breakdown-list">
                            {applied.map((d, idx) => (
                              <div key={idx} className="flex justify-between items-start gap-4 text-xs text-emerald-600/90 font-dm-sans italic w-full">
                                <span className="break-words text-left flex-1">• {d.label}</span>
                                <span className="text-right whitespace-nowrap shrink-0">-Rs {d.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex justify-between border-t border-gorola-pine/10 pt-2 font-semibold" data-testid="order-total">
                    <span>Payment [{formatPayment(order.paymentMethod)}]:</span>
                    <span>Rs {order.total}</span>
                  </div>
                </div>

                <div className="space-y-1 border-t border-gorola-pine/10 pt-3 font-dm-sans text-sm text-gorola-slate">
                  {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                    <p className="font-semibold text-gorola-charcoal">Delivery Address</p>
                  )}
                  <AddressBlock order={order} />
                  {order.status !== "DELIVERED" && order.status !== "CANCELLED" && estimatedDeliveryCopy(order, isWeatherMode)}
                  <StatusStepper
                    history={order.statusHistory ?? []}
                    status={order.status}
                    riderLocation={riderLocation}
                    order={order}
                  />
                  {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                    <p className="font-dm-sans text-xs text-gorola-slate">
                      Tracking is live — updates appear here automatically as your order moves through
                      the store and neighborhood.
                    </p>
                  )}
                </div>
              </div>

              {/* Clean Rate Your Order Section */}
              {order.status === "DELIVERED" && (
                <div 
                  data-testid="rate-order-section"
                  className="w-full bg-white border border-gorola-pine/10 rounded-2xl p-5 text-left shadow-sm font-dm-sans space-y-4"
                >
                  <h3 className="font-playfair text-lg font-bold text-gorola-charcoal">Rate your order</h3>
                  
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-gorola-slate font-medium">
                      {order.rating !== null ? (
                        <div className="space-y-1.5">
                          <span className="flex items-center gap-1.5 text-green-600 font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            Rating submitted
                          </span>
                          <div className="flex items-center gap-2">
                            <StarRating rating={order.rating} disabled={true} />
                            <span className="text-sm font-bold text-gorola-charcoal">{order.rating} / 5</span>
                          </div>
                          {order.ratingComment && (
                            <p className="text-xs text-gorola-slate italic">"{order.ratingComment}"</p>
                          )}
                        </div>
                      ) : (
                        "How was your overall experience?"
                      )}
                    </div>
                    
                    {order.rating === null && (
                      <div className="flex items-center gap-3">
                        <StarRating
                          rating={activeRating ?? 0}
                          interactive={true}
                          onChange={setActiveRating}
                          disabled={rateMutation.isPending}
                        />
                      </div>
                    )}
                  </div>

                  {/* Comment Box */}
                  {activeRating !== null && order.rating === null && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-3 pt-2">
                      <div className="relative group/input">
                        <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gorola-charcoal/20 group-focus-within/input:text-gorola-charcoal/40 transition-colors" />
                        <textarea
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                          placeholder="Any feedback for the store? (Optional)"
                          className="w-full bg-white border border-gorola-charcoal/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gorola-charcoal placeholder:text-gorola-charcoal/20 focus:outline-none focus:border-gorola-pine/30 transition-all resize-none h-20 shadow-inner"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => rateMutation.mutate({ 
                            rating: activeRating!, 
                            comment: ratingComment || undefined
                          })}
                          className="px-6 py-2 bg-gorola-pine text-white text-xs font-bold rounded-full hover:bg-gorola-pine/90 transition-all shadow-md shadow-gorola-pine/10 disabled:opacity-50"
                          disabled={rateMutation.isPending}
                        >
                          {rateMutation.isPending ? "Submitting..." : "Submit Feedback"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                <blockquote className="w-full rounded-2xl border border-gorola-pine/10 bg-gorola-fog/80 p-4 text-left shadow-inner">
                  <p className="font-dm-sans text-sm leading-relaxed text-gorola-charcoal">
                    Your order from{" "}
                    <span className="font-semibold">{order.store.name}</span> is being handled. Reach the store directly
                    if something urgent comes up:
                  </p>
                  <a
                    aria-label={`Call ${order.store.name}`}
                    className="mt-3 inline-flex rounded-full bg-gorola-pine px-5 py-2 font-dm-sans text-sm font-semibold text-white hover:bg-gorola-pine/90"
                    href={telHref(order.store.phone)}
                    rel="noopener noreferrer"
                  >
                    Call {order.store.phone}
                  </a>
                </blockquote>
              )}

              <p className="max-w-md font-dm-sans text-xs text-gorola-slate">
                {order.status === "DELIVERED" ? "Hope you enjoy your purchase!" : 
                 order.status === "CANCELLED" ? "We apologize for the inconvenience." :
                 "Built for honest shopper expectations—no artificial urgency ribbons or mystery ETAs unless you have a scheduled slot above."}
              </p>
              </div>
            </>
          );
        })()
      ) : null}
    </section>
  );
}
