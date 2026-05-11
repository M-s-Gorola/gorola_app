import { useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { Bike, CheckCircle2, Home, Package } from "lucide-react";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useParams } from "react-router-dom";

import { useOrderSocket } from "@/hooks/useOrderSocket";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
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
  items: BuyerOrderConfirmationItem[];
  landmarkDescription: string;
  addressLabel?: string | null;
  flatRoom?: string | null;
  paymentMethod: string;
  scheduledFor?: string | null;
  status: string;
  statusHistory?: StatusHistoryItem[];
  store: {
    id: string;
    name: string;
    phone: string;
  };
  subtotal: string;
  total: string;
};

export type OrderConfirmationEnvelope = {
  data?: BuyerOrderDetail;
  success?: boolean;
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
}: {
  history: StatusHistoryItem[];
  status: string;
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
                    "text-[11px] font-bold uppercase tracking-wider",
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
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
          </div>
          <p className="font-dm-sans text-sm">
            <strong>Rider location:</strong> Your rider is on the way with your order.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function OrderConfirmationPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const rootRef = useRef<HTMLElement | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);
  const entranceDoneRef = useRef(false);

  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);

  const query = useQuery({
    enabled: api !== null && id !== undefined,
    queryKey: ["buyer-order-confirmation", id ?? null],
    queryFn: async (): Promise<BuyerOrderDetail> => {
      const response = await api!.get<OrderConfirmationEnvelope>(
        `/api/v1/orders/${id}`
      );
      const payload = response.data;
      if (payload.success !== true || payload.data === undefined) {
        throw new Error("Invalid order confirmation response");
      }
      return payload.data;
    },
  });

  const queryClient = useQueryClient();
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

  useOrderSocket(id, onStatusChanged);

  useEffect(() => {
    entranceDoneRef.current = false;
  }, [id]);

  const isRecentlyPlaced = query.isSuccess && query.data.createdAt ? (
    Date.now() - new Date(query.data.createdAt).getTime() < 60000
  ) : false;

  const shouldShowBloom = query.isSuccess && (query.data.status === "PLACED" || isRecentlyPlaced);

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

      {query.isSuccess ? (
        (() => {
          const discountAmount = query.data.discount?.amount ?? "0.00";

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
                    {query.data.status === "DELIVERED" ? "Order Delivered" : 
                     query.data.status === "PLACED" ? "Thank you" :
                     query.data.status === "PREPARING" ? "Store is picking items" :
                     query.data.status === "OUT_FOR_DELIVERY" ? "On the way" :
                     query.data.status === "CANCELLED" ? "Order Cancelled" : "Order Status"}
                  </h1>
                  {query.data.status === "DELIVERED" && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Delivered in {calculateDeliveryDuration(query.data.statusHistory ?? [], query.data.createdAt) ?? "15m"}
                    </div>
                  )}
                </div>
                <p className="font-dm-sans text-sm text-gorola-slate">
                  <span className="sr-only">Full order reference {query.data.id}. </span>
                  Order{" "}
                  <span
                    className="font-mono font-semibold text-gorola-charcoal"
                    title={`Full order reference: ${query.data.id}`}
                  >
                    {formatOrderRefForUi(query.data.id)}
                  </span>{" "}
                  {query.data.status === "DELIVERED" ? "was delivered from" : 
                   query.data.status === "CANCELLED" ? "from" : "is being handled by"}{" "}
                  <span className="font-semibold text-gorola-charcoal">{query.data.store.name}</span>.
                </p>
              </div>


              {weatherPulse}

              <div className="w-full space-y-2 rounded-2xl border border-gorola-pine/10 bg-white p-5 text-left shadow-sm">
                <h2 className="font-playfair text-lg text-gorola-charcoal">Your items</h2>
                <ul aria-label="Order items" className="space-y-2">
                  {query.data.items.map((line) => (
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

                <div className="space-y-1 border-t border-gorola-pine/10 pt-3 font-dm-sans text-sm text-gorola-charcoal">
                  <p data-testid="order-subtotal">Subtotal: Rs {query.data.subtotal}</p>
                  <p>Delivery fee: Rs {query.data.deliveryFee}</p>
                  {discountAmount !== "0.00" ? <p>Discount: -Rs {discountAmount}</p> : null}
                  <p className="font-semibold" data-testid="order-total">Total: Rs {query.data.total}</p>
                  <p>Payment: {formatPayment(query.data.paymentMethod)}</p>
                </div>

                <div className="space-y-1 border-t border-gorola-pine/10 pt-3 font-dm-sans text-sm text-gorola-slate">
                  {query.data.status !== "DELIVERED" && query.data.status !== "CANCELLED" && (
                    <p className="font-semibold text-gorola-charcoal">Delivery Address</p>
                  )}
                  <AddressBlock order={query.data} />
                  {query.data.status !== "DELIVERED" && query.data.status !== "CANCELLED" && estimatedDeliveryCopy(query.data, isWeatherMode)}
                  <StatusStepper
                    history={query.data.statusHistory ?? []}
                    status={query.data.status}
                  />
                  {query.data.status !== "DELIVERED" && query.data.status !== "CANCELLED" && (
                    <p className="font-dm-sans text-xs text-gorola-slate">
                      Tracking is live — updates appear here automatically as your order moves through
                      the store and neighborhood.
                    </p>
                  )}
                </div>
              </div>

              {query.data.status !== "DELIVERED" && query.data.status !== "CANCELLED" && (
                <blockquote className="w-full rounded-2xl border border-gorola-pine/10 bg-gorola-fog/80 p-4 text-left shadow-inner">
                  <p className="font-dm-sans text-sm leading-relaxed text-gorola-charcoal">
                    Your order from{" "}
                    <span className="font-semibold">{query.data.store.name}</span> is being handled. Reach the store directly
                    if something urgent comes up:
                  </p>
                  <a
                    aria-label={`Call ${query.data.store.name}`}
                    className="mt-3 inline-flex rounded-full bg-gorola-pine px-5 py-2 font-dm-sans text-sm font-semibold text-white hover:bg-gorola-pine/90"
                    href={telHref(query.data.store.phone)}
                    rel="noopener noreferrer"
                  >
                    Call {query.data.store.phone}
                  </a>
                </blockquote>
              )}

              <p className="max-w-md font-dm-sans text-xs text-gorola-slate">
                {query.data.status === "DELIVERED" ? "Hope you enjoy your purchase!" : 
                 query.data.status === "CANCELLED" ? "We apologize for the inconvenience." :
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
