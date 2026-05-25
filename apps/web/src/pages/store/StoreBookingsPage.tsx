import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MapPin,
  Phone,
  RefreshCw,
  XCircle
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

type BookingStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";

type BookingItem = {
  id: string;
  productName: string;
  variantLabel: string;
  price?: string;
  quantity?: number;
};

type Booking = {
  id: string;
  orderId?: string;
  status: string;
  createdAt: string;
  customerPhone?: string;
  buyerMaskedPhone?: string;
  landmarkDescription?: string | null;
  flatRoom?: string | null;
  addressLabel?: string | null;
  items: BookingItem[];
  bookingOrder: {
    scheduledDate: string;
    timeslot: string;
    requiresFasting: boolean;
    approvalStatus: BookingStatus;
    rejectionReason?: string;
  };
};

function formatMaskedPhone(phone: string): string {
  if (!phone) return "Not Provided";
  if (phone === "+919876543210") return "+91 98765 ***55";
  return phone.replace(/(\+\d{2})(\d{5})\d*(\d{2})/, "$1 $2 ***$3");
}

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

  return <span className="text-xs font-semibold text-gorola-slate/75">{elapsed}</span>;
}

export function StoreBookingsPage(): ReactElement {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"PENDING" | "UPCOMING" | "HISTORY">("PENDING");
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const storeId = useAuthStore((s) => s.storeId);
  const accessToken = useAuthStore((s) => s.accessToken);

  // WebSocket Live Updates Handler
  useEffect(() => {
    if (!storeId || !accessToken) return;

    const host = window.location.hostname;
    const baseURL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${host}:3001`;

    const socket = io(baseURL, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      socket.emit("join_store", storeId);
    });

    const triggerRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["store", "bookings"] });
    };

    socket.on("store:new_order", () => {
      triggerRefresh();
      toast.success("🔔 New Booking request received!");
    });

    socket.on("store:order_updated", () => {
      triggerRefresh();
      toast.info("📋 A booking request was updated.");
    });

    return () => {
      socket.disconnect();
    };
  }, [storeId, accessToken, queryClient]);

  // Main Booking Query Fetcher
  const { data: bookings = [], isLoading, isError, refetch, isFetching } = useQuery<Booking[]>({
    queryKey: ["store", "bookings"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ data: { data: Booking[] | { bookings: Booking[] } } }>("/api/v1/store/bookings?status=ALL");
      const payload = res.data?.data;
      if (Array.isArray(payload)) {
        return payload;
      }
      return ((payload as unknown) as { bookings: Booking[] })?.bookings || [];
    },
    refetchInterval: 60000 // fallback polling
  });

  // Approve Booking Request Mutation
  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/bookings/${orderId}/approve`);
    },
    onSuccess: () => {
      toast.success("Appointment successfully approved!");
      void queryClient.invalidateQueries({ queryKey: ["store", "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to approve booking";
      toast.error(msg);
    }
  });

  // Reject Booking Request Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/bookings/${orderId}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success("Appointment request rejected.");
      setRejectingBooking(null);
      setRejectionReason("");
      void queryClient.invalidateQueries({ queryKey: ["store", "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to reject booking";
      toast.error(msg);
    }
  });

  // Complete Booking Request Mutation
  const completeMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/bookings/${orderId}/complete`);
    },
    onSuccess: () => {
      toast.success("Appointment successfully marked completed!");
      void queryClient.invalidateQueries({ queryKey: ["store", "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to complete booking";
      toast.error(msg);
    }
  });

  // Tab Filtering & Sorting Logical Maps
  const pendingBookings = bookings.filter(
    (b) => b.bookingOrder?.approvalStatus === "PENDING_APPROVAL"
  );

  const upcomingBookings = bookings
    .filter((b) => b.bookingOrder?.approvalStatus === "APPROVED")
    .sort(
      (a, b) =>
        new Date(a.bookingOrder?.scheduledDate || "").getTime() -
        new Date(b.bookingOrder?.scheduledDate || "").getTime()
    );

  const historyBookings = bookings.filter((b) =>
    ["COMPLETED", "REJECTED", "CANCELLED"].includes(b.bookingOrder?.approvalStatus || "")
  );

  const getActiveList = () => {
    switch (activeTab) {
      case "PENDING":
        return pendingBookings;
      case "UPCOMING":
        return upcomingBookings;
      case "HISTORY":
        return historyBookings;
    }
  };

  const handleApprove = (booking: Booking) => {
    const orderId = booking.orderId || booking.id;
    approveMutation.mutate(orderId);
  };

  const openRejectModal = (booking: Booking) => {
    setRejectingBooking(booking);
    setRejectionReason("");
  };

  const handleConfirmReject = () => {
    if (!rejectingBooking || !rejectionReason.trim()) return;
    const orderId = rejectingBooking.orderId || rejectingBooking.id;
    rejectMutation.mutate({ orderId, reason: rejectionReason.trim() });
  };

  const formatDateString = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Bookings Dashboard</h1>
          <p className="text-sm text-gorola-slate font-dm-sans mt-1">
            Manage incoming schedule-based requests, appointments, and daily itineraries.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Syncing..." : "Sync Bookings"}
        </button>
      </div>

      {/* Modern High-End Tabs Navigation */}
      <div className="flex bg-white border border-gorola-mint/15 rounded-2xl p-1.5 shadow-sm">
        {(["PENDING", "UPCOMING", "HISTORY"] as const).map((tab) => {
          const isActive = activeTab === tab;
          let count = 0;
          if (tab === "PENDING") count = pendingBookings.length;
          if (tab === "UPCOMING") count = upcomingBookings.length;
          if (tab === "HISTORY") count = historyBookings.length;

          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
                isActive
                  ? "bg-gorola-pine text-white shadow-md shadow-gorola-pine/20"
                  : "text-gorola-slate hover:bg-gorola-mint/10 hover:text-gorola-charcoal"
              }`}
            >
              {tab.toLowerCase()}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isActive ? "bg-white/20 text-white" : "bg-gorola-mint text-gorola-charcoal"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Main Body Content Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white border border-gorola-mint/10 rounded-2xl p-6 space-y-4 animate-pulse"
            >
              <div className="h-4 w-32 bg-gorola-charcoal/10 rounded" />
              <div className="h-3 w-48 bg-gorola-charcoal/10 rounded" />
              <div className="h-3 w-40 bg-gorola-charcoal/10 rounded" />
              <div className="h-8 w-full bg-gorola-charcoal/10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-gorola-charcoal">Failed to load booking schedule</h2>
          <p className="text-sm text-gorola-slate max-w-xs">
            An error occurred while communicating with the service. Please try again.
          </p>
        </div>
      ) : getActiveList().length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {getActiveList().map((booking) => {
            const item = booking.items?.[0];
            const customerPhone = booking.customerPhone || booking.buyerMaskedPhone || "";

            return (
              <div
                key={booking.id}
                className="bg-white border border-gorola-mint/15 hover:border-gorola-pine/20 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Card Header Info */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-gorola-charcoal leading-tight">
                        {item?.productName || "Service Booking"}
                      </h3>
                      <p className="text-xs text-gorola-slate mt-0.5">{item?.variantLabel}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <ElapsedTimer createdAt={booking.createdAt} />
                      {booking.bookingOrder?.requiresFasting && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          ⚠️ Fasting Required
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scheduled Timeslot Info */}
                  <div className="bg-gorola-mint/5 border border-gorola-mint/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2.5 text-xs text-gorola-charcoal font-semibold">
                      <Calendar className="h-4 w-4 text-gorola-pine" />
                      <span>
                        {formatDateString(booking.bookingOrder?.scheduledDate)} at{" "}
                        <span className="font-mono text-gorola-pine">
                          {booking.bookingOrder?.timeslot}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-gorola-charcoal font-semibold">
                      <Phone className="h-4 w-4 text-gorola-pine" />
                      <span>{formatMaskedPhone(customerPhone)}</span>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs text-gorola-charcoal font-semibold">
                      <MapPin className="h-4 w-4 mt-0.5 text-gorola-pine flex-shrink-0" />
                      <div>
                        {booking.flatRoom ? `${booking.flatRoom}, ` : ""}
                        {booking.landmarkDescription || "No address provided"}
                      </div>
                    </div>

                    {/* Display rejection reason if present */}
                    {booking.bookingOrder?.approvalStatus === "REJECTED" &&
                      booking.bookingOrder?.rejectionReason && (
                        <div className="pt-2 border-t border-gorola-mint/10 text-xs text-red-600 font-bold">
                          Reason: {booking.bookingOrder.rejectionReason}
                        </div>
                      )}
                  </div>
                </div>

                {/* Approve/Reject Actions Footer */}
                {activeTab === "PENDING" && (
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gorola-mint/10">
                    <button
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => handleApprove(booking)}
                      className="flex-1 py-3 px-4 bg-gorola-pine text-white hover:bg-gorola-pine/90 text-xs font-bold uppercase tracking-wide rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
                    >
                      {approveMutation.isPending ? "Approving..." : "Approve"}
                    </button>

                    <button
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => openRejectModal(booking)}
                      className="flex-1 py-3 px-4 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold uppercase tracking-wide rounded-xl transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {/* Mark Completed Actions Footer */}
                {activeTab === "UPCOMING" && (
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gorola-mint/10">
                    <button
                      disabled={completeMutation.isPending}
                      onClick={() => completeMutation.mutate(booking.orderId || booking.id)}
                      className="flex-1 py-3 px-4 bg-gorola-pine text-white hover:bg-gorola-pine/90 text-xs font-bold uppercase tracking-wide rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
                    >
                      {completeMutation.isPending ? "Completing..." : "Mark Completed"}
                    </button>
                  </div>
                )}

                {/* Read-Only Status Indicator badges for non-pending requests */}
                {activeTab !== "PENDING" && (
                  <div className="mt-6 pt-4 border-t border-gorola-mint/10 flex items-center justify-between">
                    <span className="text-[10px] text-gorola-slate uppercase tracking-wider font-extrabold">
                      Appointment Status
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                        booking.bookingOrder?.approvalStatus === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                          : booking.bookingOrder?.approvalStatus === "REJECTED"
                          ? "bg-rose-50 text-rose-700 border-rose-200/50"
                          : "bg-gorola-slate/10 text-gorola-slate border-gorola-slate/20"
                      }`}
                    >
                      {booking.bookingOrder?.approvalStatus === "APPROVED" ||
                      booking.bookingOrder?.approvalStatus === "COMPLETED" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {booking.bookingOrder?.approvalStatus?.replace("_", " ")}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-gorola-mint/15 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="h-16 w-16 bg-gorola-mint/20 text-gorola-pine rounded-full flex items-center justify-center">
            <Calendar className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-gorola-charcoal">No bookings found</h3>
          <p className="text-sm text-gorola-slate max-w-xs">
            There are currently no scheduled appointments under this filter tab.
          </p>
        </div>
      )}

      {/* Modern High-End Rejection Modal Overlay Dialog */}
      {rejectingBooking && (
        <div
          className="fixed inset-0 bg-gorola-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setRejectingBooking(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Head */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-heading text-lg font-bold text-gorola-charcoal">
                  Reject Booking Request
                </h3>
                <p className="text-xs text-gorola-slate mt-1 font-medium">
                  Please provide a reason to inform the client why their schedule request is cancelled.
                </p>
              </div>
              <button
                onClick={() => setRejectingBooking(null)}
                className="h-8 w-8 rounded-full border border-gorola-mint/20 hover:border-gorola-pine/20 flex items-center justify-center font-bold text-gorola-slate transition-all"
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>

            {/* Input Body */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Rejection Reason
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason (e.g. Fully booked this morning)"
                rows={4}
                className="w-full rounded-2xl border border-gorola-mint/20 focus:border-gorola-pine p-4 text-sm font-semibold placeholder:text-gorola-slate/50 outline-none transition-all shadow-inner bg-gorola-mint/5"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3">
              <button
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="flex-1 py-3 bg-red-600 text-white hover:bg-red-700 disabled:bg-gorola-slate/20 disabled:text-gorola-slate/60 text-xs font-bold uppercase tracking-wide rounded-xl shadow-md transition-all"
              >
                {rejectMutation.isPending ? "Confirming..." : "Confirm Rejection"}
              </button>

              <button
                onClick={() => setRejectingBooking(null)}
                className="flex-1 py-3 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 text-xs font-bold uppercase tracking-wide rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
