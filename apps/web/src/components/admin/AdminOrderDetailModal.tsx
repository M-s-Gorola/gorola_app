import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  FileText,
  MapPin,
  Phone,
  RefreshCw,
  Store,
  User,
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import { api } from "@/lib/api";
import { lenis } from "@/lib/lenis";
import { cn, formatCurrency, formatStatusLabel, getStatusBadgeClasses } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

export interface AdminOrderDetailItem {
  id: string;
  name?: string;
  productName?: string;
  price: number;
  quantity: number;
  customizations?: string | null;
  variantLabel?: string | null;
}

export interface AdminOrderDetailHistory {
  id?: string;
  status: string;
  changedAt: string;
  changedBy?: string | null;
  note?: string | null;
}

export interface AdminOrderDetailDiscountItem {
  code?: string;
  offerTitle?: string;
  label?: string;
  amount?: number;
  discountType?: string;
  discountValue?: number;
}

export interface AdminOrderDetail {
  id: string;
  shortId?: string;
  orderType?: "REGULAR" | "BOOKING" | "QUICK";
  status: string;
  statusHistory?: AdminOrderDetailHistory[];
  createdAt: string;
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  tax?: number;
  discountAmount?: number;
  discountSavingAmount?: number | null;
  offerSavingAmount?: number | null;
  appliedDiscountCode?: string | null;
  appliedOfferTitle?: string | null;
  discount?: {
    code?: string;
    amount?: number;
  } | null;
  discounts?: AdminOrderDetailDiscountItem[];
  couponCode?: string | null;
  storeOfferTitle?: string | null;
  storeName?: string;
  buyerMaskedPhone?: string;
  landmarkDescription?: string;
  flatRoom?: string;
  riderName?: string;
  user?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
    maskedPhone?: string | null;
  } | null;
  store?: {
    id?: string;
    name?: string | null;
    address?: string | null;
    phone?: string | null;
  } | null;
  rider?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
  } | null;
  items: AdminOrderDetailItem[];
  deliveryAddress?: {
    flatRoom?: string | null;
    street?: string | null;
    city?: string | null;
    landmark?: string | null;
  } | null;
  deliveryNote?: string | null;
  booking?: {
    timeslot?: string | null;
    scheduledDate?: string | null;
    appointmentAddress?: string | null;
    serviceInstructions?: string | null;
    requiresFasting?: boolean | null;
  } | null;
  bookingOrder?: {
    id?: string;
    timeslot?: string | null;
    scheduledDate?: string | null;
    requiresFasting?: boolean | null;
    approvalStatus?: string | null;
    serviceInstructions?: string | null;
  } | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
}

export interface AdminOrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
  dataTestId?: string;
}

export function AdminOrderDetailModal({
  orderId,
  onClose,
  dataTestId = "order-details-modal"
}: AdminOrderDetailModalProps): ReactElement | null {
  const [isDiscountExpanded, setIsDiscountExpanded] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (orderId) {
      document.body.style.overflow = "hidden";
      lenis?.stop();
    } else {
      document.body.style.overflow = "";
      lenis?.start();
    }
    return () => {
      document.body.style.overflow = "";
      lenis?.start();
    };
  }, [orderId]);

  useEffect(() => {
    setIsDiscountExpanded(false);
  }, [orderId]);

  const { data: orderDetail, isLoading: isDetailLoading, refetch } = useQuery<AdminOrderDetail | null>({
    queryKey: ["adminOrderDetail", orderId],
    queryFn: async () => {
      if (!orderId || !api) return null;
      const res = await api.get<{ success: boolean; data: AdminOrderDetail }>(
        `/api/v1/admin/orders/${orderId}`
      );
      return res.data?.data ?? null;
    },
    enabled: Boolean(orderId),
    refetchInterval: 3000
  });

  // Real-time WebSocket connection to subscribe to order updates
  useEffect(() => {
    if (!orderId || !accessToken) return;

    const baseURL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    const socket = io(baseURL, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      socket.emit("join_order", orderId);
      if (orderDetail?.store?.id) {
        socket.emit("join_store", orderDetail.store.id);
      }
    });

    const handleOrderUpdate = (payload?: {
      orderId: string;
      status: string;
      statusHistory?: AdminOrderDetailHistory[];
    }) => {
      const incomingId = payload?.orderId?.toLowerCase();
      const currentId = orderId?.toLowerCase();
      if (!incomingId || !currentId) return;
      if (incomingId !== currentId && !incomingId.includes(currentId) && !currentId.includes(incomingId)) {
        return;
      }

      queryClient.setQueryData<AdminOrderDetail | null>(
        ["adminOrderDetail", orderId],
        (prev) => {
          if (!prev) return prev;
          const updated: AdminOrderDetail = {
            ...prev,
            status: payload.status
          };
          if (payload.statusHistory && payload.statusHistory.length > 0) {
            updated.statusHistory = payload.statusHistory;
          } else {
            const exists = prev.statusHistory?.some(
              (h) => h.status === payload.status
            );
            if (!exists) {
              const newHist: AdminOrderDetailHistory = {
                id: `live-${Date.now()}`,
                status: payload.status,
                changedAt: new Date().toISOString(),
                changedBy: "System",
                note: null
              };
              updated.statusHistory = [...(prev.statusHistory || []), newHist];
            }
          }
          return updated;
        }
      );

      void queryClient.invalidateQueries({ queryKey: ["adminOrderDetail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    };

    socket.on("order_status_changed", handleOrderUpdate);
    socket.on("store:order_updated", handleOrderUpdate);
    socket.on("order:updated", handleOrderUpdate);

    return () => {
      socket.disconnect();
    };
  }, [orderId, accessToken, queryClient, orderDetail?.store?.id]);

  if (!orderId) {
    return null;
  }

  const getStatusBadgeClass = (status: string) => {
    return getStatusBadgeClasses(status);
  };

  const bookingData = orderDetail?.booking || orderDetail?.bookingOrder;
  const deliveryNote =
    orderDetail?.deliveryNote ||
    orderDetail?.booking?.serviceInstructions ||
    orderDetail?.bookingOrder?.serviceInstructions;
  const storeName = orderDetail?.storeName || orderDetail?.store?.name || "Store Partner";
  const buyerName = orderDetail?.user?.name || "Registered User";
  const buyerPhone =
    orderDetail?.buyerMaskedPhone ||
    orderDetail?.user?.maskedPhone ||
    orderDetail?.user?.phone ||
    "Not Provided";

  const flatRoom = orderDetail?.flatRoom || orderDetail?.deliveryAddress?.flatRoom;
  const landmark = orderDetail?.landmarkDescription || orderDetail?.deliveryAddress?.landmark;
  const street = orderDetail?.deliveryAddress?.street;
  const city = orderDetail?.deliveryAddress?.city;
  const fullAddress = [flatRoom, street, landmark, city].filter(Boolean).join(", ");

  // Discount calculation
  const discountSaving = Number(orderDetail?.discountSavingAmount || 0);
  const offerSaving = Number(orderDetail?.offerSavingAmount || 0);
  const fallbackDiscount = Number(orderDetail?.discount?.amount || orderDetail?.discountAmount || 0);
  const hasDetailedStored =
    (orderDetail?.discountSavingAmount !== undefined && orderDetail?.discountSavingAmount !== null) ||
    (orderDetail?.offerSavingAmount !== undefined && orderDetail?.offerSavingAmount !== null);

  const appliedDiscounts: { label: string; amount: number }[] = [];
  if (hasDetailedStored) {
    if (offerSaving > 0) {
      appliedDiscounts.push({
        label: orderDetail?.appliedOfferTitle
          ? `Store Offer (${orderDetail.appliedOfferTitle})`
          : "Store Offer",
        amount: offerSaving
      });
    }
    if (discountSaving > 0) {
      const code = orderDetail?.appliedDiscountCode || orderDetail?.discount?.code;
      appliedDiscounts.push({
        label: code ? `Discount Code (${code})` : "Discount Code",
        amount: discountSaving
      });
    }
  } else if (orderDetail?.discounts && orderDetail.discounts.length > 0) {
    for (const d of orderDetail.discounts) {
      appliedDiscounts.push({
        label: d.code
          ? `Discount Code (${d.code})`
          : d.offerTitle
            ? `Store Offer (${d.offerTitle})`
            : d.label || "Promo Discount",
        amount: Number(d.amount || 0)
      });
    }
  } else if (fallbackDiscount > 0) {
    appliedDiscounts.push({
      label: orderDetail?.discount?.code
        ? `Discount Code (${orderDetail.discount.code})`
        : orderDetail?.couponCode
          ? `Discount Code (${orderDetail.couponCode})`
          : "Total Discount",
      amount: fallbackDiscount
    });
  }

  const totalDiscountAmount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0) || fallbackDiscount;

  return (
    <div
      data-testid={dataTestId}
      data-lenis-prevent
      className="fixed inset-0 bg-gorola-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        data-lenis-prevent
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 overscroll-contain animate-in zoom-in-95 duration-200 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {isDetailLoading ? (
          <div data-testid="order-details-loading" className="h-64 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="h-8 w-8 text-gorola-pine animate-spin" />
            <span className="text-sm text-gorola-slate font-medium">Retrieving detailed records...</span>
          </div>
        ) : !orderDetail ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-sm font-semibold text-gorola-slate">Order details could not be found.</p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gorola-pine text-white text-xs font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border mb-3",
                    getStatusBadgeClass(orderDetail.status)
                  )}
                >
                  {formatStatusLabel(orderDetail.status, orderDetail.orderType)}
                </span>
                <h2 className="font-mono text-xl md:text-2xl font-black text-gorola-charcoal">
                  #{orderDetail.id.toUpperCase()}
                </h2>
                <p className="text-xs text-gorola-slate mt-1 font-medium">
                  Placed on: {new Date(orderDetail.createdAt).toLocaleString("en-IN")}
                </p>
                {(orderDetail.rejectionReason || orderDetail.cancellationReason) && (
                  <p className="text-xs text-rose-600 font-medium pt-1">
                    Reason: {orderDetail.rejectionReason || orderDetail.cancellationReason}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="h-8 w-8 rounded-full border border-gorola-mint/20 hover:border-gorola-pine/20 flex items-center justify-center font-bold text-gorola-slate transition-all"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Buyer & Appointment details */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                  {orderDetail.orderType === "BOOKING" ? "Buyer & Appointment" : "Buyer & Delivery Details"}
                </h3>
                <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 space-y-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gorola-pine/10 rounded-lg flex items-center justify-center text-gorola-pine shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Buyer Profile</p>
                      <p className="text-xs font-black text-gorola-charcoal">
                        {buyerName}
                      </p>
                    </div>
                  </div>

                  {orderDetail.orderType === "BOOKING" && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-gorola-pine/10 rounded-lg flex items-center justify-center text-gorola-pine shrink-0">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gorola-slate font-bold">Schedule Slot</p>
                        <p className="text-xs font-black text-gorola-charcoal">
                          {bookingData?.scheduledDate
                            ? `${typeof bookingData.scheduledDate === "string" && bookingData.scheduledDate.includes("T") ? bookingData.scheduledDate.split("T")[0] : String(bookingData.scheduledDate)} at `
                            : ""}
                          {bookingData?.timeslot || "Not scheduled"}
                        </p>
                        {bookingData?.requiresFasting && (
                          <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                            ⚠️ Fasting Required (min 8-10 hours)
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Store partner */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gorola-pine/10 rounded-lg flex items-center justify-center text-gorola-pine shrink-0">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Store Partner</p>
                      <p className="text-xs font-black text-gorola-charcoal">{storeName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-sky-50 text-sky-700 rounded-lg flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gorola-slate font-bold">Contact Number</p>
                      <p className="text-xs font-black text-gorola-charcoal">
                        {buyerPhone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center mt-0.5 shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="w-full">
                      <p className="text-[10px] text-gorola-slate font-bold">
                        {orderDetail.orderType === "BOOKING" ? "Appointment Address" : "Delivery Address"}
                      </p>
                      <p className="text-xs font-black text-gorola-charcoal">
                        {fullAddress || "No address provided"}
                      </p>
                      {deliveryNote && (
                        <div
                          data-testid="admin-order-delivery-note"
                          className="mt-2 text-xs bg-amber-50 border border-amber-200/60 text-amber-900 rounded-xl p-3 flex items-start gap-2"
                        >
                          <FileText className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-[10px] uppercase text-amber-700">
                              {orderDetail.orderType === "BOOKING" ? "Service Instructions" : "Delivery Note"}
                            </span>
                            <span className="font-medium whitespace-pre-line" data-testid="admin-delivery-note">
                              {orderDetail.orderType === "BOOKING"
                                ? `Service Note: ${deliveryNote}`
                                : `Delivery Note: ${deliveryNote}`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery Partner / Rider */}
                  {(orderDetail.riderName || orderDetail.rider?.name) && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gorola-slate font-bold">Delivery Partner</p>
                        <p className="text-xs font-black text-gorola-charcoal">
                          {orderDetail.riderName || orderDetail.rider?.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Transition Log */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/60">
                  Status Transition Log
                </h3>
                <div className="relative pl-6 space-y-4 border-l border-gorola-mint/15" data-testid="status-history-list">
                  {orderDetail.statusHistory && orderDetail.statusHistory.length > 0 ? (
                    orderDetail.statusHistory.map((hist, idx) => (
                      <div key={hist.id || idx} className="relative">
                        <span
                          className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ${
                            idx === orderDetail.statusHistory!.length - 1
                              ? "bg-gorola-pine scale-125"
                              : "bg-gorola-mint"
                          }`}
                        />
                        <p className="text-xs font-black text-gorola-charcoal">
                          {formatStatusLabel(hist.status, orderDetail?.orderType)}
                        </p>
                        <p className="text-[10px] text-gorola-slate mt-0.5">
                          By {hist.changedBy || "System"} at{" "}
                          {new Date(hist.changedAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true
                          })}
                          {hist.note && ` - ${hist.note}`}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="relative">
                      <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-gorola-pine scale-125" />
                      <p className="text-xs font-black text-gorola-charcoal">
                        {formatStatusLabel(orderDetail.status, orderDetail?.orderType)}
                      </p>
                      <p className="text-[10px] text-gorola-slate mt-0.5">
                        Created at{" "}
                        {new Date(orderDetail.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true
                        })}
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
                  <tbody className="divide-y divide-gorola-mint/10">
                    {orderDetail.items.map((item) => {
                      const itemName = item.productName || item.name;
                      const itemVariant = item.variantLabel || item.customizations;
                      return (
                        <tr key={item.id} className="hover:bg-gorola-mint/5 transition-colors">
                          <td className="p-3 text-xs">
                            <span className="font-black text-gorola-charcoal block">{itemName}</span>
                            {itemVariant && (
                              <span className="text-[10px] text-gorola-slate block mt-0.5">{itemVariant}</span>
                            )}
                          </td>
                          <td className="p-3 text-xs font-bold text-center text-gorola-charcoal">
                            {item.quantity || 1}
                          </td>
                          <td className="p-3 text-xs text-right font-medium text-gorola-slate">
                            {formatCurrency(Number(item.price || 0))}
                          </td>
                          <td className="p-3 text-xs text-right font-black text-gorola-charcoal">
                            {formatCurrency(Number(item.price || 0) * (item.quantity || 1))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Receipt Summary panel with collapsible discounts */}
            <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs text-gorola-slate">
                <span>Subtotal</span>
                <span className="font-semibold text-gorola-charcoal">
                  {formatCurrency(Number(orderDetail.subtotal || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-gorola-slate">
                <span>{orderDetail.orderType === "BOOKING" ? "Service Fee" : "Delivery Fee"}</span>
                <span className="font-semibold text-gorola-charcoal">
                  {formatCurrency(Number(orderDetail.deliveryFee || 0))}
                </span>
              </div>

              {/* Total Discount with Dropdown Toggle */}
              {totalDiscountAmount > 0 && (
                <div className="space-y-1.5 pt-0.5" data-testid="admin-order-discount">
                  <div className="flex justify-between items-center text-rose-600 font-bold">
                    <button
                      type="button"
                      data-testid="admin-order-discount-toggle"
                      onClick={() => setIsDiscountExpanded((prev) => !prev)}
                      aria-expanded={isDiscountExpanded}
                      className="inline-flex items-center gap-1 hover:underline cursor-pointer group text-xs text-rose-600 font-bold"
                    >
                      <span data-testid="admin-toggle-discounts">Total Discount:</span>
                      <span className="text-[10px] transition-transform text-rose-600">
                        {isDiscountExpanded ? "▼" : "▶"}
                      </span>
                    </button>
                    <span>-{formatCurrency(totalDiscountAmount)}</span>
                  </div>

                  {isDiscountExpanded && (
                    <div
                      data-testid="admin-order-discount-list"
                      className="pl-3 py-1 space-y-1 border-l-2 border-rose-200 animate-in fade-in slide-in-from-top-1 duration-150"
                    >
                      {appliedDiscounts.length > 0 ? (
                        appliedDiscounts.map((d, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] text-rose-500 italic font-medium w-full">
                            <span className="inline-flex items-center gap-1">
                              • {d.label}
                            </span>
                            <span className="font-bold text-rose-600">
                              -{formatCurrency(d.amount)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between items-center text-[11px] text-rose-500 italic font-medium">
                          <span>• Promotional Savings</span>
                          <span className="font-bold text-rose-600">
                            -{formatCurrency(totalDiscountAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-gorola-mint/15 pt-2 flex justify-between items-center font-black text-gorola-charcoal">
                <span className="text-sm font-black">Grand Total</span>
                <span className="text-base font-black text-gorola-pine">
                  {formatCurrency(Number(orderDetail.total || 0))}
                </span>
              </div>
            </div>

            {/* Close Button Footer */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-gorola-charcoal text-white hover:bg-gorola-charcoal/90 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
