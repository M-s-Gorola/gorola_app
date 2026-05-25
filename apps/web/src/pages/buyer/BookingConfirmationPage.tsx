import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home } from "lucide-react";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { useParams } from "react-router-dom";

import { useOrderSocket } from "@/hooks/useOrderSocket";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type BookingOrderDetails = {
  scheduledDate: string;
  timeslot: string;
  requiresFasting: boolean;
  rejectionReason: string | null;
};

type BookingItem = {
  id: string;
  productName: string;
  variantLabel: string;
  price: string;
  quantity: number;
};

type BookingEnvelope = {
  id: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "DELIVERED";
  subtotal: string;
  deliveryFee: string;
  total: string;
  paymentMethod: string;
  landmarkDescription: string;
  flatRoom: string | null;
  addressLabel: string | null;
  store?: {
    id: string;
    name: string;
    phone: string;
    storeType?: string;
  };
  items: BookingItem[];
  bookingOrder: BookingOrderDetails;
};

const statusConfig = {
  PENDING_APPROVAL: {
    borderColor: "border-amber-200 hover:border-amber-300",
    shadowColor: "shadow-amber-100/10",
    badgeBg: "bg-amber-50 border border-amber-200 text-amber-800",
    badgeLabel: "Booking request sent. Waiting for store confirmation.",
    title: "Booking Placed",
    accentBorder: "border-l-4 border-l-amber-500",
    iconColor: "text-amber-500",
  },
  APPROVED: {
    borderColor: "border-indigo-200 hover:border-indigo-300",
    shadowColor: "shadow-indigo-100/10",
    badgeBg: "bg-indigo-50 border border-indigo-200 text-indigo-800",
    badgeLabel: "✅ Your booking has been approved by the store owner!",
    title: "Your booking is confirmed!",
    accentBorder: "border-l-4 border-l-indigo-500",
    iconColor: "text-indigo-500",
  },
  COMPLETED: {
    borderColor: "border-emerald-200 hover:border-emerald-300",
    shadowColor: "shadow-emerald-100/10",
    badgeBg: "bg-emerald-50 border border-emerald-200 text-emerald-800",
    badgeLabel: "🎉 This booking appointment has been marked as completed!",
    title: "Service Done",
    accentBorder: "border-l-4 border-l-emerald-500",
    iconColor: "text-gorola-pine",
  },
  DELIVERED: {
    borderColor: "border-emerald-200 hover:border-emerald-300",
    shadowColor: "shadow-emerald-100/10",
    badgeBg: "bg-emerald-50 border border-emerald-200 text-emerald-800",
    badgeLabel: "🎉 This booking appointment has been marked as completed!",
    title: "Service Done",
    accentBorder: "border-l-4 border-l-emerald-500",
    iconColor: "text-gorola-pine",
  },
  REJECTED: {
    borderColor: "border-red-200 hover:border-red-300",
    shadowColor: "shadow-red-100/10",
    badgeBg: "bg-red-50 border border-red-200 text-red-800",
    badgeLabel: "This booking request was declined.",
    title: "Booking Rejected",
    accentBorder: "border-l-4 border-l-red-500",
    iconColor: "text-red-500",
  },
  CANCELLED: {
    borderColor: "border-gray-200 hover:border-gray-300",
    shadowColor: "shadow-gray-100/10",
    badgeBg: "bg-gray-50 border border-gray-200 text-gray-800",
    badgeLabel: "This booking has been cancelled.",
    title: "Booking Cancelled",
    accentBorder: "border-l-4 border-l-gray-500",
    iconColor: "text-gray-500",
  },
};

export function BookingConfirmationPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["booking-order-confirmation", id],
    queryFn: async (): Promise<BookingEnvelope> => {
      if (!id) throw new Error("Missing booking ID");
      const res = await api!.get<{ success: boolean; data: BookingEnvelope }>(
        `/api/v1/bookings/${id}`
      );
      return res.data.data;
    },
    enabled: !!id,
  });

  // Realtime update listener using standard Socket.IO hook
  const onStatusChanged = useCallback(
    (data: { orderId: string; status: string }) => {
      if (data.orderId === id) {
        queryClient.setQueryData(
          ["booking-order-confirmation", id],
          (old: BookingEnvelope | undefined) => {
            if (!old) return old;
            return { ...old, status: data.status as BookingEnvelope["status"] };
          }
        );
      }
    },
    [id, queryClient]
  );

  useOrderSocket(id, onStatusChanged);

  if (query.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center font-dm-sans text-sm text-gorola-slate">
        Loading confirmation details...
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-xl bg-red-50 p-4 font-dm-sans text-sm text-red-700">
        Could not load booking confirmation.
      </div>
    );
  }

  const booking = query.data;

  // Format date correctly
  const formattedDate = booking.bookingOrder.scheduledDate.split("T")[0];
  const config = statusConfig[booking.status] || statusConfig.PENDING_APPROVAL;

  // Track if bloom needs to show based on standard creation timeline
  const isRecentlyPlaced = booking.bookingOrder !== undefined; // default animation support
  const shouldShowBloom = isRecentlyPlaced && booking.status === "PENDING_APPROVAL";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8" data-booking-confirmation="true">
      <div className="occ-content relative z-[1] mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
        {/* Dynamic Status Icon / Checkmark at top */}
        <svg
          aria-hidden={true}
          className={cn("occ-check h-20 w-20 transition-colors duration-300", config.iconColor)}
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

        {/* Dynamic Status Header Info (displayed above receipt card) */}
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col items-center gap-2">
            <h1 className="font-playfair text-3xl font-bold text-gorola-charcoal" id="occ-heading">
              {config.title}
            </h1>
            <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset",
              booking.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-700 ring-amber-600/20" :
              booking.status === "APPROVED" ? "bg-indigo-50 text-indigo-700 ring-indigo-600/20" :
              (booking.status === "COMPLETED" || booking.status === "DELIVERED") ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" :
              booking.status === "REJECTED" ? "bg-rose-50 text-rose-700 ring-rose-600/20" :
              "bg-gray-50 text-gray-700 ring-gray-600/20"
            )}>
              {booking.status === "PENDING_APPROVAL" ? "Pending Approval" :
               booking.status === "APPROVED" ? "Confirmed" :
               (booking.status === "COMPLETED" || booking.status === "DELIVERED") ? "Completed" :
               booking.status.replace("_", " ")}
            </div>
          </div>
          
          <p className="font-dm-sans text-sm text-gorola-slate">
            Booking{" "}
            <span
              className="font-mono font-semibold text-gorola-charcoal"
              title={`Full booking reference: ${booking.id}`}
            >
              {booking.id.length > 8 ? `…${booking.id.slice(-8)}` : booking.id}
            </span>{" "}
            {booking.status === "COMPLETED" || booking.status === "DELIVERED" ? "has been completed at" :
             booking.status === "REJECTED" ? "was declined by" :
             booking.status === "APPROVED" ? "is confirmed with" : "has been requested from"}{" "}
            <span className="font-semibold text-gorola-charcoal">{booking.store?.name}</span>.
          </p>
        </div>

        {/* Unified, Status-Aware Receipt Card */}
        <div className={cn(
          "w-full rounded-3xl border bg-white p-6 text-left shadow-lg transition-all duration-300 space-y-6",
          config.borderColor,
          config.accentBorder,
          config.shadowColor
        )}>
          {/* Card Header Status Alert */}
          <div className={cn("rounded-2xl p-4 transition-all duration-300", config.badgeBg)}>
            <p className="font-dm-sans text-sm font-semibold">
              {config.badgeLabel}
            </p>
            {booking.status === "REJECTED" && booking.bookingOrder.rejectionReason && (
              <p className="font-dm-sans text-xs font-medium mt-1 opacity-90">
                Rejection Reason: {booking.bookingOrder.rejectionReason}
              </p>
            )}
          </div>

          {/* Section 1: Services Booked & Store Info */}
          <div className="border-t border-gorola-pine/10 pt-5 space-y-3">
            <div className="flex justify-between items-baseline gap-2">
              <h2 className="font-playfair text-lg font-bold text-gorola-charcoal">Services Booked</h2>
              {booking.store && (
                <span className="font-dm-sans text-xs text-gorola-slate">
                  from <span className="font-semibold text-gorola-charcoal">{booking.store.name}</span>
                </span>
              )}
            </div>
            <ul className="space-y-4">
              {booking.items.map((line) => (
                <li
                  className="flex flex-col gap-1 border-b border-gorola-pine/10 pb-3 last:border-0 last:pb-0"
                  key={line.id}
                >
                  <div className="flex justify-between gap-3 font-dm-sans text-sm text-gorola-charcoal">
                    <span className="font-semibold text-gorola-charcoal">
                      {line.productName} <span className="text-gorola-slate font-normal">({line.variantLabel}) × {line.quantity}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-gorola-charcoal">
                      Rs {(Number(line.price) * line.quantity).toFixed(2)}
                    </span>
                  </div>
                  {/* Schedule Details inline */}
                  <div className="space-y-1 pt-1.5 font-dm-sans text-xs">
                    <div className="flex justify-between">
                      <span className="text-gorola-slate">Scheduled date:</span>
                      <span className="font-semibold text-gorola-charcoal">{formattedDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gorola-slate">Selected Slot:</span>
                      <span className="font-semibold text-gorola-charcoal">{booking.bookingOrder.timeslot}</span>
                    </div>
                  </div>
                  {/* Fasting Required alert directly below */}
                  {booking.bookingOrder.requiresFasting && (
                    <div className="mt-2 flex self-start">
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                        ⚠️ Fasting Required
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Section 2: Pricing Summary & Total */}
          <div className="border-t border-gorola-pine/10 pt-5 space-y-1.5 font-dm-sans text-sm text-gorola-charcoal">
            <div className="flex justify-between" data-testid="order-subtotal">
              <span className="text-gorola-slate">Subtotal:</span>
              <span className="font-medium">Rs {booking.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gorola-slate">Delivery fee:</span>
              <span className="font-medium">Rs {booking.deliveryFee}</span>
            </div>
            <div className="flex justify-between border-t border-gorola-pine/10 pt-2 font-semibold" data-testid="order-total">
              <span>Payment [{booking.paymentMethod === "COD" ? "Pay on Service" : booking.paymentMethod}]:</span>
              <span>Rs {booking.total}</span>
            </div>
          </div>

          {/* Section 3: Appointment Address */}
          <div className="border-t border-gorola-pine/10 pt-5 space-y-1.5 font-dm-sans text-sm text-gorola-slate">
            <p className="font-semibold text-gorola-charcoal">Appointment Address</p>
            {booking.addressLabel && (
              <div className="flex items-center gap-1.5 font-dm-sans text-sm font-bold text-gorola-charcoal">
                <Home className="h-3.5 w-3.5 text-gorola-pine" />
                {booking.addressLabel}
              </div>
            )}
            <p className="text-gorola-slate">
              {booking.flatRoom ? `${booking.flatRoom}, ` : ""}
              {booking.landmarkDescription}
            </p>
          </div>
        </div>

        {/* Dynamic Store Contact Box (Only if not cancelled or rejected) */}
        {booking.status !== "CANCELLED" && booking.status !== "REJECTED" && booking.store && (
          <blockquote className="w-full rounded-2xl border border-gorola-pine/10 bg-gorola-fog/80 p-4 text-left shadow-inner">
            <p className="font-dm-sans text-sm leading-relaxed text-gorola-charcoal">
              Your order from <span className="font-semibold">{booking.store.name}</span> is being handled. Reach the store directly if something urgent comes up:
            </p>
            <a
              aria-label={`Call ${booking.store.name}`}
              className="mt-3 inline-flex rounded-full bg-gorola-pine px-5 py-2 font-dm-sans text-sm font-semibold text-white hover:bg-gorola-pine/90 transition-all"
              href={`tel:${booking.store.phone.trim()}`}
              rel="noopener noreferrer"
            >
              Call {booking.store.phone}
            </a>
          </blockquote>
        )}

        <p className="max-w-md font-dm-sans text-xs text-gorola-slate">
          Built for honest shopper expectations—no artificial urgency ribbons or mystery ETAs unless you have a scheduled slot above.
        </p>
      </div>
    </div>
  );
}
