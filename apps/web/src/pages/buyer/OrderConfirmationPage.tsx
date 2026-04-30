import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import {
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useParams } from "react-router-dom";

import { api } from "@/lib/api";
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
  paymentMethod: string;
  scheduledFor?: string | null;
  status: string;
  store: {
    id: string;
    name: string;
    phone: string;
  };
  subtotal: string;
  total: string;
};

type OrderConfirmationEnvelope = {
  data?: BuyerOrderDetail;
  success?: boolean;
};

function formatPayment(method: string): string {
  if (method === "COD") return "Cash on delivery";
  if (method === "UPI") return "UPI";
  if (method === "CARD") return "Card";
  return method;
}

const STATUS_HINT: Partial<Record<string, string>> = {
  DELIVERED: "Delivered",
  OUT_FOR_DELIVERY: "Out for delivery",
  PLACED: "We’ve received your order",
  PREPARING: "The store is preparing your order",
};

function statusLabel(status: string): string {
  return STATUS_HINT[status] ?? `Status: ${status.replaceAll("_", " ").toLowerCase()}`;
}

function telHref(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return "#";
  }
  return `tel:${trimmed}`;
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

  useEffect(() => {
    entranceDoneRef.current = false;
  }, [id]);

  useLayoutEffect(() => {
    if (!query.isSuccess || query.data === undefined || entranceDoneRef.current) {
      return;
    }
    const root = rootRef.current;
    const bloom = bloomRef.current;
    if (!root || !bloom) {
      return;
    }
    entranceDoneRef.current = true;

    const ctx = gsap.context(() => {
      gsap.set(bloom, { autoAlpha: 1 });
      gsap.set(".occ-content", { autoAlpha: 0, y: 16 });
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
        defaults: { ease: "power2.inOut" },
      });
      tl.to(bloom, { autoAlpha: 0, duration: 0.9 })
        .to(
          ".occ-check-path",
          { strokeDashoffset: 0, duration: 0.55 },
          "-=0.42"
        )
        .to(".occ-content", { autoAlpha: 1, y: 0, duration: 0.5 }, "-=0.35");
    }, root);

    return (): void => {
      ctx.revert();
    };
  }, [query.isSuccess, query.data, id]);

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
            <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700" role="alert">
              Could not load order details.
            </p>
          ) : null}
          {typeof id === "string" ? (
            <p className="font-dm-sans text-xs text-gorola-slate">Reference: {id}</p>
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

          const statusBanner = (
            <div
              className="rounded-xl border border-gorola-pine/15 bg-gorola-pine/5 px-3 py-2 font-dm-sans text-sm text-gorola-charcoal"
              role="status"
            >
              {statusLabel(query.data.status)}
            </div>
          );

          return (
            <>
              <div
                ref={bloomRef}
                aria-hidden={true}
                className="occ-bloom pointer-events-none fixed inset-0 z-[100] bg-gradient-to-br from-emerald-500 via-gorola-pine to-teal-800"
              />
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
                <h1 className="font-playfair text-3xl text-gorola-charcoal" id="occ-heading">
                  Thank you
                </h1>
                <p className="font-dm-sans text-sm text-gorola-slate">
                  Order <span className="font-semibold text-gorola-charcoal">{query.data.id}</span> is locked in with{" "}
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
                  <p>Subtotal: Rs {query.data.subtotal}</p>
                  <p>Delivery fee: Rs {query.data.deliveryFee}</p>
                  {discountAmount !== "0.00" ? <p>Discount: -Rs {discountAmount}</p> : null}
                  <p className="font-semibold">Total: Rs {query.data.total}</p>
                  <p>Payment: {formatPayment(query.data.paymentMethod)}</p>
                </div>

                <div className="space-y-1 border-t border-gorola-pine/10 pt-3 font-dm-sans text-sm text-gorola-slate">
                  <p className="font-semibold text-gorola-charcoal">Drop-off cue</p>
                  <p>{query.data.landmarkDescription}</p>
                  {estimatedDeliveryCopy(query.data, isWeatherMode)}
                  {statusBanner}
                  <p className="font-dm-sans text-xs text-gorola-slate">
                    Live Socket.IO ETA polish is slated for Phase 2.13—we show your current status plainly here instead of
                    simulating a fake ticker.
                  </p>
                </div>
              </div>

              <blockquote className="w-full rounded-2xl border border-gorola-pine/10 bg-gorola-fog/80 p-4 text-left shadow-inner">
                <p className="font-dm-sans text-sm leading-relaxed text-gorola-charcoal">
                  Your order from{" "}
                  <span className="font-semibold">{query.data.store.name}</span> is being prepared. Reach the store directly
                  if something urgent comes up—we don&apos;t have a scripted &quot;owner name&quot; field yet, but this number
                  is the real storefront line:
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

              <p className="max-w-md font-dm-sans text-xs text-gorola-slate">
                Built for honest shopper expectations—no artificial urgency ribbons or mystery ETAs unless you have a
                scheduled slot above.
              </p>
              </div>
            </>
          );
        })()
      ) : null}
    </section>
  );
}
