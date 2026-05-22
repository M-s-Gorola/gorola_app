import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { useParams } from "react-router-dom";

import { useOrderSocket } from "@/hooks/useOrderSocket";
import { api } from "@/lib/api";

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
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED";
  subtotal: string;
  deliveryFee: string;
  total: string;
  paymentMethod: string;
  landmarkDescription: string;
  flatRoom: string | null;
  store?: {
    id: string;
    name: string;
    phone: string;
    storeType?: string;
  };
  items: BookingItem[];
  bookingOrder: BookingOrderDetails;
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

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div className="occ-content relative z-[1] mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
        {/* Status Indicator Card */}
        <div className="w-full rounded-2xl border border-gorola-pine/10 bg-white p-5 text-left shadow-sm space-y-4">
          <div className="space-y-1">
            <h1 className="font-playfair text-3xl font-bold text-gorola-charcoal">
              {booking.status === "APPROVED"
                ? "Your booking is confirmed!"
                : booking.status === "REJECTED"
                ? "Booking Rejected"
                : booking.status === "CANCELLED"
                ? "Booking Cancelled"
                : "Booking Placed"}
            </h1>
            <p className="font-dm-sans text-sm text-gorola-slate">
              Booking Ref: <span className="font-mono font-semibold text-gorola-charcoal">{booking.id}</span>
            </p>
          </div>

          {/* Status Badges */}
          {booking.status === "PENDING_APPROVAL" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="font-dm-sans text-sm font-semibold text-amber-800">
                Booking request sent. Waiting for store confirmation.
              </p>
            </div>
          )}

          {booking.status === "APPROVED" && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="font-dm-sans text-sm font-semibold text-emerald-800">
                ✅ Your booking has been approved by the store owner!
              </p>
            </div>
          )}

          {booking.status === "REJECTED" && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-1 text-red-800">
              <p className="font-dm-sans text-sm font-semibold">
                This booking request was declined.
              </p>
              {booking.bookingOrder.rejectionReason && (
                <p className="font-dm-sans text-xs font-medium">
                  Rejection Reason: {booking.bookingOrder.rejectionReason}
                </p>
              )}
            </div>
          )}

          {booking.status === "CANCELLED" && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <p className="font-dm-sans text-sm font-semibold text-gray-800">
                This booking has been cancelled.
              </p>
            </div>
          )}
        </div>

        {/* Schedule & Fasting Card */}
        <div className="w-full rounded-2xl border border-gorola-pine/10 bg-white p-5 text-left shadow-sm space-y-3">
          <h2 className="font-playfair text-lg font-bold text-gorola-charcoal">Schedule Details</h2>
          <div className="font-dm-sans text-sm space-y-2 text-gorola-charcoal">
            <p>
              Scheduled date: <span className="font-semibold">{formattedDate}</span>
            </p>
            <p>
              Selected Slot: <span className="font-semibold">{booking.bookingOrder.timeslot}</span>
            </p>
            {booking.bookingOrder.requiresFasting && (
              <p className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                ⚠️ Fasting Required
              </p>
            )}
          </div>
        </div>

        {/* Items Card */}
        <div className="w-full rounded-2xl border border-gorola-pine/10 bg-white p-5 text-left shadow-sm space-y-3">
          <h2 className="font-playfair text-lg font-bold text-gorola-charcoal">Services Booked</h2>
          <ul className="space-y-2">
            {booking.items.map((line) => (
              <li
                className="flex justify-between gap-3 border-b border-gorola-pine/10 pb-2 font-dm-sans text-sm last:border-0 last:pb-0"
                key={line.id}
              >
                <span className="text-gorola-charcoal font-medium">
                  {line.productName} <span className="text-gorola-slate">({line.variantLabel}) × {line.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold text-gorola-charcoal">
                  Rs {(Number(line.price) * line.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-gorola-pine/10 pt-3 space-y-1 font-dm-sans text-sm text-gorola-charcoal">
            <p>Subtotal: Rs {booking.subtotal}</p>
            <p>Delivery fee: Rs {booking.deliveryFee}</p>
            <p className="font-semibold text-gorola-pine text-base">Total: Rs {booking.total}</p>
            <p className="text-xs text-gorola-slate">Payment method: {booking.paymentMethod === "COD" ? "Pay on Service" : booking.paymentMethod}</p>
          </div>
        </div>

        {/* Store & Location Card */}
        <div className="w-full rounded-2xl border border-gorola-pine/10 bg-white p-5 text-left shadow-sm space-y-3">
          <h2 className="font-playfair text-lg font-bold text-gorola-charcoal">Location & Store</h2>
          <div className="font-dm-sans text-sm space-y-1 text-gorola-slate">
            {booking.store && (
              <>
                <p className="font-semibold text-gorola-charcoal">Store: {booking.store.name}</p>
                <p>Phone: {booking.store.phone}</p>
              </>
            )}
            <div className="border-t border-gorola-pine/10 mt-3 pt-3">
              <p className="font-semibold text-gorola-charcoal">Appointment Address</p>
              <p className="mt-1">
                {booking.flatRoom ? `${booking.flatRoom}, ` : ""}
                {booking.landmarkDescription}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
