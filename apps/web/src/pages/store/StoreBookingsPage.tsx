import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MapPin,
  Phone,
  RefreshCw,
  Truck,
  XCircle
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatStatusLabel } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

type BookingStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";

type DateFilter = "ALL" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";

type BookingItem = {
  id: string;
  productName: string;
  variantLabel: string;
  price?: string;
  quantity?: number;
};

type BookingStatusHistory = {
  id: string;
  status: string;
  changedAt: string;
  changedBy: string;
};

type StoreOffer = {
  id: string;
  title: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type Booking = {
  id: string;
  orderId?: string;
  status: string;
  subtotal?: string;
  deliveryFee?: string;
  total?: string;
  paymentMethod?: string;
  discountAmount?: string;
  discountCode?: string | null;
  createdAt: string;
  customerPhone?: string;
  buyerMaskedPhone?: string;
  landmarkDescription?: string | null;
  flatRoom?: string | null;
  addressLabel?: string | null;
  items: BookingItem[];
  statusHistory?: BookingStatusHistory[];
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

function formatChangedBy(changedBy: string): string {
  if (!changedBy) return "System";
  const normalized = changedBy.toUpperCase();
  if (normalized === "BUYER" || normalized.startsWith("BUYER:")) return "Buyer";
  if (normalized === "RIDER" || normalized.startsWith("RIDER:")) return "Rider";
  if (
    normalized.startsWith("STORE:") ||
    normalized.startsWith("STORE-OWNER:") ||
    normalized.startsWith("STORE_OWNER:") ||
    normalized === "STORE_OWNER"
  ) {
    return "Store Owner";
  }
  if (normalized.startsWith("ADMIN:") || normalized === "ADMIN") return "Admin";
  return "System";
}

export function StoreBookingsPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "APPROVED" | "ON_THE_WAY" | "HISTORY">(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["ALL", "PENDING", "APPROVED", "ON_THE_WAY", "HISTORY"].includes(tabParam)) {
      return tabParam as "ALL" | "PENDING" | "APPROVED" | "ON_THE_WAY" | "HISTORY";
    }
    return "ALL";
  });
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    const filterParam = searchParams.get("dateFilter");
    if (filterParam && ["ALL", "TODAY", "TOMORROW", "THIS_WEEK", "THIS_MONTH", "CUSTOM"].includes(filterParam)) {
      return filterParam as DateFilter;
    }
    return "ALL";
  });
  const [customFrom, setCustomFrom] = useState(() => searchParams.get("customFrom") || "");
  const [customTo, setCustomTo] = useState(() => searchParams.get("customTo") || "");
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const selectedBookingRef = useRef<Booking | null>(null);
  selectedBookingRef.current = selectedBooking;
  const [isDiscountExpanded, setIsDiscountExpanded] = useState(false);
  const [confirmingBookingUpdate, setConfirmingBookingUpdate] = useState<{
    orderId: string;
    action: "APPROVE" | "DISPATCH" | "COMPLETE";
  } | null>(null);

  const storeId = useAuthStore((s) => s.storeId);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: offersResponse } = useQuery({
    enabled: !!storeId,
    queryKey: ["promotions", "store", storeId, "offers"],
    queryFn: async () => {
      const res = await api!.get<{ success: boolean; data: StoreOffer[] }>(
        `/api/v1/promotions/store/${storeId}/offers`
      );
      return res.data;
    }
  });

  const getAppliedDiscounts = (booking: Booking) => {
    const subtotal = Number(booking.subtotal || 0);
    const deliveryFee = Number(booking.deliveryFee || 0);
    const total = Number(booking.total || 0);
    const discountAmount = Number(booking.discountAmount) > 0
      ? Number(booking.discountAmount)
      : Number((subtotal + deliveryFee - total).toFixed(2));
    if (discountAmount <= 0) return [];

    const offers = Array.isArray(offersResponse?.data) ? offersResponse.data : [];
    const orderTime = new Date(booking.createdAt || "").getTime();

    const matchedOffers = offers.filter((o) => {
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
        label: booking.discountCode || "Discount",
        amount: remainingDiscount
      });
    }

    return result;
  };

  useEffect(() => {
    if (selectedBooking) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedBooking]);

  useEffect(() => {
    setIsDiscountExpanded(false);
  }, [selectedBooking]);

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

    socket.on("store:order_updated", (payload?: { orderId: string; status: string; statusHistory?: BookingStatusHistory[] }) => {
      triggerRefresh();
      if (payload?.orderId && (selectedBookingRef.current?.orderId === payload.orderId || selectedBookingRef.current?.id === payload.orderId)) {
        setSelectedBooking((prev) => {
          if (!prev) return null;
          const updated: Booking = {
            ...prev,
            status: payload.status
          };
          const newHistory = payload.statusHistory ?? prev.statusHistory;
          if (newHistory) {
            updated.statusHistory = newHistory;
          }
          return updated;
        });
      }
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

  useEffect(() => {
    if (selectedBooking && bookings) {
      const updatedBooking = bookings.find((b) => b.id === selectedBooking.id);
      if (updatedBooking) {
        if (
          updatedBooking.status !== selectedBooking.status ||
          updatedBooking.statusHistory?.length !== selectedBooking.statusHistory?.length
        ) {
          setSelectedBooking(updatedBooking);
        }
      }
    }
  }, [bookings, selectedBooking?.id]);

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
      setSelectedBooking(null);
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

  // Dispatch Booking Request Mutation
  const dispatchMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/bookings/${orderId}/dispatch`);
    },
    onSuccess: () => {
      toast.success("Appointment successfully marked on the way!");
      void queryClient.invalidateQueries({ queryKey: ["store", "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to mark booking on the way";
      toast.error(msg);
    }
  });

  // Date Filtering helper
  const filterByDate = (list: Booking[]) => {
    if (dateFilter === "ALL") return list;

    const getLocalYMD = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const now = new Date();
    const todayStr = getLocalYMD(now);

    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tomorrowStr = getLocalYMD(tom);

    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const startOfWeekStr = getLocalYMD(startOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const endOfWeekStr = getLocalYMD(endOfWeek);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = getLocalYMD(startOfMonth);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfMonthStr = getLocalYMD(endOfMonth);

    return list.filter((b) => {
      const scheduledDateStr = b.bookingOrder?.scheduledDate;
      if (!scheduledDateStr) return false;

      const bookingDate = new Date(scheduledDateStr);
      const bookingYMD = getLocalYMD(bookingDate);

      switch (dateFilter) {
        case "TODAY":
          return bookingYMD === todayStr;
        case "TOMORROW":
          return bookingYMD === tomorrowStr;
        case "THIS_WEEK":
          return bookingYMD >= startOfWeekStr && bookingYMD <= endOfWeekStr;
        case "THIS_MONTH":
          return bookingYMD >= startOfMonthStr && bookingYMD <= endOfMonthStr;
        case "CUSTOM": {
          if (customFrom && bookingYMD < customFrom) return false;
          if (customTo && bookingYMD > customTo) return false;
          return true;
        }
        default:
          return true;
      }
    });
  };

  // Tab Filtering & Sorting Logical Maps
  const pendingBookings = bookings.filter(
    (b) => b.status === "PENDING_APPROVAL"
  );

  const approvedBookings = bookings
    .filter((b) => b.status === "APPROVED")
    .sort(
      (a, b) =>
        new Date(a.bookingOrder?.scheduledDate || "").getTime() -
        new Date(b.bookingOrder?.scheduledDate || "").getTime()
    );

  const onTheWayBookings = bookings.filter(
    (b) => b.status === "OUT_FOR_DELIVERY"
  );

  const historyBookings = bookings.filter((b) =>
    ["COMPLETED", "REJECTED", "CANCELLED"].includes(b.status)
  );

  const getActiveList = () => {
    let list: Booking[] = [];
    switch (activeTab) {
      case "ALL":
        list = bookings;
        break;
      case "PENDING":
        list = pendingBookings;
        break;
      case "APPROVED":
        list = approvedBookings;
        break;
      case "ON_THE_WAY":
        list = onTheWayBookings;
        break;
      case "HISTORY":
        list = historyBookings;
        break;
    }
    return filterByDate(list);
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

      {/* Tabs and Date Filter Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Modern High-End Tabs Navigation */}
        <div className="flex-1 flex bg-white border border-gorola-mint/15 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
          {(["ALL", "PENDING", "APPROVED", "ON_THE_WAY", "HISTORY"] as const).map((tab) => {
            const isActive = activeTab === tab;
            let count = 0;
            if (tab === "ALL") count = filterByDate(bookings).length;
            if (tab === "PENDING") count = filterByDate(pendingBookings).length;
            if (tab === "APPROVED") count = filterByDate(approvedBookings).length;
            if (tab === "ON_THE_WAY") count = filterByDate(onTheWayBookings).length;
            if (tab === "HISTORY") count = filterByDate(historyBookings).length;

            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 px-4 ${
                  isActive
                    ? "bg-gorola-pine text-white shadow-md shadow-gorola-pine/20"
                    : "text-gorola-slate hover:bg-gorola-mint/10 hover:text-gorola-charcoal"
                }`}
              >
                {tab === "ALL" ? "all requests" : tab === "ON_THE_WAY" ? "on the way" : tab.toLowerCase()}
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

        {/* Date Filter Dropdown and Custom Inputs */}
        <div className="flex items-center gap-3 self-end lg:self-auto">
          {dateFilter === "CUSTOM" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
              <input
                type="date"
                data-testid="date-from-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-gorola-mint/20 focus:border-gorola-pine outline-none bg-white text-gorola-charcoal shadow-sm"
              />
              <span className="text-xs font-bold text-gorola-slate">to</span>
              <input
                type="date"
                data-testid="date-to-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-gorola-mint/20 focus:border-gorola-pine outline-none bg-white text-gorola-charcoal shadow-sm"
              />
            </div>
          )}

          <select
            data-testid="booking-date-filter"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl transition-all shadow-sm focus:outline-none text-gorola-pine cursor-pointer"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="TOMORROW">Tomorrow</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
        </div>
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

            return (
              <div
                key={booking.id}
                data-testid={`booking-card-${booking.id}`}
                onClick={() => setSelectedBooking(booking)}
                className="bg-white border border-gorola-mint/15 hover:border-gorola-pine/20 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between cursor-pointer"
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
                </div>

                {/* Read-Only Status Indicator badges for non-pending requests inside card */}
                {activeTab !== "PENDING" && (
                  <div className="mt-4 pt-3 border-t border-gorola-mint/10 flex items-center justify-between">
                    <span className="text-[10px] text-gorola-slate uppercase tracking-wider font-extrabold">
                      Appointment Status
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border ${
                        booking.status === "APPROVED"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200/50"
                          : booking.status === "OUT_FOR_DELIVERY"
                          ? "bg-blue-50 text-blue-700 border-blue-200/50"
                          : (booking.status === "COMPLETED" || booking.status === "DELIVERED")
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                          : (booking.status === "REJECTED" || booking.status === "CANCELLED")
                          ? "bg-rose-50 text-rose-700 border-rose-200/50"
                          : "bg-gorola-slate/10 text-gorola-slate border-gorola-slate/20"
                      }`}
                    >
                      {booking.status === "APPROVED" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : booking.status === "OUT_FOR_DELIVERY" ? (
                        <Truck className="h-3 w-3" />
                      ) : (booking.status === "COMPLETED" || booking.status === "DELIVERED") ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {formatStatusLabel(booking.status === "OUT_FOR_DELIVERY" ? "ON_THE_WAY" : booking.status === "DELIVERED" ? "COMPLETED" : booking.status)}
                    </span>
                  </div>
                )}

                <div className="pt-4 mt-6 border-t border-gorola-mint/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gorola-slate uppercase tracking-wider font-bold">
                      Grand Total
                    </p>
                    <p className="text-base font-black text-gorola-charcoal">
                      Rs {Number(booking.total || 0).toFixed(2)}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-gorola-pine hover:underline">
                    View Details →
                  </span>
                </div>
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

      {/* Detailed Booking Modal Dialog */}
      {selectedBooking && (
        <div
          data-testid="booking-details-modal"
          className="fixed inset-0 bg-gorola-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border mb-3 ${
                    selectedBooking.status === "APPROVED"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200/50"
                      : selectedBooking.status === "OUT_FOR_DELIVERY"
                      ? "bg-blue-50 text-blue-700 border-blue-200/50"
                      : (selectedBooking.status === "COMPLETED" || selectedBooking.status === "DELIVERED")
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                      : (selectedBooking.status === "REJECTED" || selectedBooking.status === "CANCELLED")
                      ? "bg-rose-50 text-rose-700 border-rose-200/50"
                      : selectedBooking.status === "PENDING_APPROVAL"
                      ? "bg-amber-100 text-amber-800 border-amber-200/50"
                      : "bg-gorola-slate/10 text-gorola-slate border-gorola-slate/20"
                  }`}
                >
                  {formatStatusLabel(selectedBooking.status === "OUT_FOR_DELIVERY" ? "ON_THE_WAY" : selectedBooking.status === "DELIVERED" ? "COMPLETED" : selectedBooking.status)}
                </span>
                <h2 className="font-mono text-xl md:text-2xl font-black text-gorola-charcoal">
                  #{selectedBooking.id.toUpperCase()}
                </h2>
                <p className="text-xs text-gorola-slate mt-1 font-medium">
                  Placed on: {new Date(selectedBooking.createdAt).toLocaleString("en-IN")}
                </p>
                {(selectedBooking.bookingOrder?.approvalStatus === "REJECTED" || selectedBooking.bookingOrder?.approvalStatus === "CANCELLED") &&
                  selectedBooking.bookingOrder?.rejectionReason && (
                    <p className="text-xs font-bold text-red-600 mt-2">
                      Reason: {selectedBooking.bookingOrder.rejectionReason}
                    </p>
                  )}
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="h-8 w-8 rounded-full border border-gorola-mint/20 hover:border-gorola-pine/20 flex items-center justify-center font-bold text-gorola-slate transition-all"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Buyer & Appointment details */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                  Buyer & Appointment
                </h3>
                <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 space-y-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gorola-pine/10 rounded-lg flex items-center justify-center text-gorola-pine">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Schedule Slot</p>
                      <p className="text-xs font-black text-gorola-charcoal">
                        {formatDateString(selectedBooking.bookingOrder?.scheduledDate)} at {selectedBooking.bookingOrder?.timeslot}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-sky-50 text-sky-700 rounded-lg flex items-center justify-center">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Contact Number</p>
                      <p className="text-xs font-black text-gorola-charcoal">
                        {formatMaskedPhone(selectedBooking.customerPhone || selectedBooking.buyerMaskedPhone || "")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center mt-0.5 flex-shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Appointment Address</p>
                      <p className="text-xs font-black text-gorola-charcoal">
                        {selectedBooking.flatRoom ? `${selectedBooking.flatRoom}, ` : ""}
                        {selectedBooking.landmarkDescription || "No address provided"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Transition Log */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                  Status Transition Log
                </h3>
                <div className="relative pl-6 space-y-4 border-l border-gorola-mint/15" data-testid="status-history-list">
                  {selectedBooking.statusHistory && selectedBooking.statusHistory.length > 0 ? (
                    selectedBooking.statusHistory.map((hist, idx) => (
                      <div key={hist.id} className="relative">
                        <span
                          className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ${
                            idx === selectedBooking.statusHistory!.length - 1
                              ? "bg-gorola-pine scale-125"
                              : "bg-gorola-mint"
                          }`}
                        />
                        <p className="text-xs font-black text-gorola-charcoal">
                          {/* DELIVERED is the raw DB status for a completed booking-commerce service.
                              We display it as COMPLETED to match the booking-facing terminology.
                              CANCELLED is written to statusHistory by rejectBooking() — when the
                              bookingOrder.approvalStatus is REJECTED, we surface it as REJECTED to
                              distinguish a store rejection from a buyer-initiated cancellation. */}
                          {formatStatusLabel(
                          hist.status === "DELIVERED"
                            ? "COMPLETED"
                            : hist.status === "OUT_FOR_DELIVERY"
                            ? "ON_THE_WAY"
                            : hist.status === "CANCELLED" &&
                              selectedBooking.bookingOrder?.approvalStatus === "REJECTED"
                            ? "REJECTED"
                            : hist.status
                        )}
                        </p>
                        <p className="text-[10px] text-gorola-slate mt-0.5">
                          By {formatChangedBy(hist.changedBy)} at {new Date(hist.changedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="relative">
                      <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-gorola-pine scale-125" />
                      <p className="text-xs font-black text-gorola-charcoal text-[11px] font-black uppercase ring-1 ring-inset uppercase rounded-full">
                        {selectedBooking.bookingOrder?.approvalStatus?.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-gorola-slate mt-0.5">
                        Created at {new Date(selectedBooking.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                Itemized Summary
              </h3>
              <div className="border border-gorola-mint/15 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15">
                      <th className="p-3 text-xs font-black text-gorola-charcoal uppercase">Product</th>
                      <th className="p-3 text-xs font-black text-gorola-charcoal uppercase text-center">Qty</th>
                      <th className="p-3 text-xs font-black text-gorola-charcoal uppercase text-right">Price</th>
                      <th className="p-3 text-xs font-black text-gorola-charcoal uppercase text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBooking.items.map((item) => (
                      <tr key={item.id} className="border-b border-gorola-mint/10 last:border-0">
                        <td className="p-3">
                          <p className="text-xs font-black text-gorola-charcoal">{item.productName}</p>
                          <p className="text-[10px] text-gorola-slate">{item.variantLabel}</p>
                        </td>
                        <td className="p-3 text-xs font-bold text-center text-gorola-charcoal">
                          {item.quantity || 1}
                        </td>
                        <td className="p-3 text-xs text-right font-medium text-gorola-slate">
                          Rs {Number(item.price || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-xs text-right font-black text-gorola-charcoal">
                          Rs {(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Receipt Summary panel with collapsible discounts */}
            <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs text-gorola-slate">
                <span>Subtotal</span>
                <span className="font-semibold">Rs {Number(selectedBooking.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gorola-slate">
                <span>Service Fee</span>
                <span className="font-semibold">Rs {Number(selectedBooking.deliveryFee || 0).toFixed(2)}</span>
              </div>
              {Number(selectedBooking.discountAmount || 0) > 0 && (
                <div className="space-y-1" data-testid="store-booking-discount">
                  <div className="flex justify-between items-center text-xs text-rose-600 font-bold">
                    <button
                      type="button"
                      onClick={() => setIsDiscountExpanded(!isDiscountExpanded)}
                      data-testid="store-booking-discount-toggle"
                      aria-expanded={isDiscountExpanded}
                      className="flex items-center gap-1 text-rose-600 hover:text-rose-700 transition-colors font-bold focus:outline-none"
                    >
                      <span>Discount:</span>
                      <span className="text-[10px] transform transition-transform duration-200">
                        {isDiscountExpanded ? "▼" : "▶"}
                      </span>
                    </button>
                    <span className="font-semibold">-Rs {Number(selectedBooking.discountAmount).toFixed(2)}</span>
                  </div>
                  {isDiscountExpanded && (
                    <div className="space-y-1 pl-3 border-l border-rose-200" data-testid="store-booking-discount-list">
                      {getAppliedDiscounts(selectedBooking).map((d, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-4 text-[11px] text-rose-500 font-dm-sans italic font-medium w-full">
                          <span className="break-words text-left flex-1">• {d.label}</span>
                          <span className="text-right whitespace-nowrap shrink-0">-Rs {d.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="h-px bg-gorola-mint/15 my-1" />
              <div className="flex justify-between items-center text-sm font-black text-gorola-charcoal">
                <span>Grand Total</span>
                <span className="text-lg text-gorola-pine">Rs {Number(selectedBooking.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* CTAs in Modal Footer */}
            {selectedBooking.status === "PENDING_APPROVAL" && (
              <div className="pt-4 border-t border-gorola-mint/10 flex gap-3">
                <button
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  onClick={() => {
                    setConfirmingBookingUpdate({
                      orderId: selectedBooking.orderId || selectedBooking.id,
                      action: "APPROVE"
                    });
                  }}
                  className="flex-1 py-3 bg-gorola-pine text-white hover:bg-gorola-pine/90 text-xs font-bold uppercase tracking-wide rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {approveMutation.isPending ? "Approving..." : "Approve Booking"}
                </button>

                <button
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  onClick={() => openRejectModal(selectedBooking)}
                  className="flex-1 py-3 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold uppercase tracking-wide rounded-xl transition-all disabled:opacity-50"
                >
                  Reject Booking
                </button>
              </div>
            )}

            {selectedBooking.status === "APPROVED" && (
              <div className="pt-4 border-t border-gorola-mint/10 flex gap-3">
                <button
                  disabled={dispatchMutation.isPending}
                  onClick={() => {
                    setConfirmingBookingUpdate({
                      orderId: selectedBooking.orderId || selectedBooking.id,
                      action: "DISPATCH"
                    });
                  }}
                  className="flex-1 py-3 bg-gorola-pine text-white hover:bg-gorola-pine/90 text-xs font-bold uppercase tracking-wide rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {dispatchMutation.isPending ? "Updating..." : "Mark On The Way"}
                </button>

                <button
                  disabled={dispatchMutation.isPending || rejectMutation.isPending}
                  onClick={() => openRejectModal(selectedBooking)}
                  className="flex-1 py-3 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold uppercase tracking-wide rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel Booking
                </button>
              </div>
            )}

            {selectedBooking.status === "OUT_FOR_DELIVERY" && (
              <div className="pt-4 border-t border-gorola-mint/10 flex gap-3">
                <button
                  disabled={completeMutation.isPending}
                  onClick={() => {
                    setConfirmingBookingUpdate({
                      orderId: selectedBooking.orderId || selectedBooking.id,
                      action: "COMPLETE"
                    });
                  }}
                  className="flex-1 py-3 bg-gorola-pine text-white hover:bg-gorola-pine/90 text-xs font-bold uppercase tracking-wide rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {completeMutation.isPending ? "Completing..." : "Mark Completed"}
                </button>

                <button
                  disabled={completeMutation.isPending || rejectMutation.isPending}
                  onClick={() => openRejectModal(selectedBooking)}
                  className="flex-1 py-3 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold uppercase tracking-wide rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel Booking
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modern High-End Rejection Modal Overlay Dialog */}
      {rejectingBooking && (
        <div
          className="fixed inset-0 bg-gorola-charcoal/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
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
                  {rejectingBooking.status === "PENDING_APPROVAL" ? "Reject Booking Request" : "Cancel Booking"}
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
                {rejectingBooking.status === "PENDING_APPROVAL" ? "Rejection Reason" : "Cancellation Reason"}
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
                {rejectMutation.isPending
                  ? "Confirming..."
                  : rejectingBooking.status === "PENDING_APPROVAL"
                  ? "Confirm Rejection"
                  : "Confirm Cancellation"}
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

      {confirmingBookingUpdate && (
        <Dialog
          open={!!confirmingBookingUpdate}
          onOpenChange={(open) => !open && setConfirmingBookingUpdate(null)}
        >
          <DialogContent className="sm:max-w-sm rounded-2xl p-6" showCloseButton={false}>
            <DialogHeader className="gap-2">
              <DialogTitle className="font-heading text-lg font-bold text-gorola-charcoal">
                Confirm Status Update
              </DialogTitle>
              <DialogDescription className="font-sans text-sm text-muted-foreground">
                Are you sure you want to mark this booking as{" "}
                <span className="font-semibold text-gorola-charcoal">
                  {confirmingBookingUpdate.action === "APPROVE"
                    ? "APPROVED"
                    : confirmingBookingUpdate.action === "DISPATCH"
                    ? "ON THE WAY"
                    : "COMPLETED"}
                </span>
                ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto rounded-xl"
                onClick={() => setConfirmingBookingUpdate(null)}
                disabled={approveMutation.isPending || dispatchMutation.isPending || completeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto bg-gorola-pine text-white hover:bg-gorola-pine/90 rounded-xl"
                onClick={() => {
                  const orderId = confirmingBookingUpdate.orderId;
                  if (confirmingBookingUpdate.action === "APPROVE") {
                    approveMutation.mutate(orderId, {
                      onSuccess: () => {
                        setConfirmingBookingUpdate(null);
                        setSelectedBooking(null);
                      }
                    });
                  } else if (confirmingBookingUpdate.action === "DISPATCH") {
                    dispatchMutation.mutate(orderId, {
                      onSuccess: () => {
                        setConfirmingBookingUpdate(null);
                        setSelectedBooking(null);
                      }
                    });
                  } else {
                    completeMutation.mutate(orderId, {
                      onSuccess: () => {
                        setConfirmingBookingUpdate(null);
                        setSelectedBooking(null);
                      }
                    });
                  }
                }}
                disabled={approveMutation.isPending || dispatchMutation.isPending || completeMutation.isPending}
              >
                {approveMutation.isPending || dispatchMutation.isPending || completeMutation.isPending ? "Updating..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

