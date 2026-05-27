import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Loader2,
  Percent,
  Plus,
  PowerOff,
  Ticket,
  Pencil
} from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

type Discount = {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  usedCount: number;
  maxUsageCount?: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type DiscountsEnvelope = {
  success: boolean;
  data: Discount[];
};

type StoreProfile = {
  storeType: string;
};

type ProfileEnvelope = {
  success: boolean;
  data: StoreProfile;
};

function getDefaultDateTimeString(daysOffset = 0, timeStr = "00:00") {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${timeStr}`;
}

export function StoreDiscountsPage(): ReactElement {
  const queryClient = useQueryClient();

  // Form states
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUsageCount, setMaxUsageCount] = useState("");
  
  // Date states (only dates are editable in the UI)
  const [startsAtDate, setStartsAtDate] = useState(() => getDefaultDateTimeString(0, "00:00").split("T")[0]);
  const [endsAtDate, setEndsAtDate] = useState(() => getDefaultDateTimeString(30, "23:59").split("T")[0]);

  // Unified backing states for testing / API
  const [startsAt, setStartsAt] = useState(() => getDefaultDateTimeString(0, "00:00"));
  const [endsAt, setEndsAt] = useState(() => getDefaultDateTimeString(30, "23:59"));

  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [isActive, setIsActive] = useState(true);

  // 1. Fetch Store Profile
  const { data: profileResponse } = useQuery({
    queryKey: ["store", "profile"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<ProfileEnvelope>("/api/v1/store/profile");
      return res.data;
    }
  });

  const isBooking = profileResponse?.data?.storeType === "BOOKING_COMMERCE";

  // 2. Fetch Discounts Query
  const { data: discountsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ["store", "discounts"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<DiscountsEnvelope>("/api/v1/store/discounts");
      return res.data;
    }
  });

  const resetForm = () => {
    setEditingDiscount(null);
    setCode("");
    setDiscountType("PERCENTAGE");
    setDiscountValue("");
    setMaxUsageCount("");
    setIsActive(true);
    
    const defaultStarts = getDefaultDateTimeString(0, "00:00");
    const defaultEnds = getDefaultDateTimeString(30, "23:59");
    
    setStartsAtDate(defaultStarts.split("T")[0]);
    setEndsAtDate(defaultEnds.split("T")[0]);
    
    setStartsAt(defaultStarts);
    setEndsAt(defaultEnds);
  };

  // 3. Submit Discount Mutation
  const createDiscountMutation = useMutation({
    mutationFn: async (payload: {
      code: string;
      discountType: "PERCENTAGE" | "FLAT";
      discountValue: number;
      maxUsageCount?: number;
      startsAt: string;
      endsAt: string;
    }) => {
      if (!api) throw new Error("API helper not initialized");
      const formattedPayload = {
        ...payload,
        startsAt: new Date(payload.startsAt).toISOString(),
        endsAt: new Date(payload.endsAt).toISOString()
      };
      const res = await api.post<DiscountsEnvelope>("/api/v1/store/discounts", formattedPayload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Discount code created successfully");
      resetForm();
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", "discounts"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to create discount code";
      toast.error(errMsg);
    }
  });

  // 3.5. Update Discount Mutation
  const updateDiscountMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      code: string;
      discountType: "PERCENTAGE" | "FLAT";
      discountValue: number;
      maxUsageCount?: number;
      startsAt: string;
      endsAt: string;
      isActive: boolean;
    }) => {
      if (!api) throw new Error("API helper not initialized");
      const formattedPayload = {
        ...payload,
        startsAt: new Date(payload.startsAt).toISOString(),
        endsAt: new Date(payload.endsAt).toISOString()
      };
      const res = await api.put<DiscountsEnvelope>(`/api/v1/store/discounts/${payload.id}`, formattedPayload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Discount code updated successfully");
      resetForm();
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", "discounts"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to update discount code";
      toast.error(errMsg);
    }
  });

  // 4. Deactivate Discount Mutation
  const deactivateDiscountMutation = useMutation({
    mutationFn: async (discountId: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/discounts/${discountId}/deactivate`);
    },
    onSuccess: () => {
      toast.success("Discount code deactivated successfully");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", "discounts"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to deactivate discount code";
      toast.error(errMsg);
    }
  });



  const handleEditClick = (discount: Discount) => {
    setEditingDiscount(discount);
    setCode(discount.code);
    setDiscountType(discount.discountType);
    setDiscountValue(discount.discountValue.toString());
    setMaxUsageCount(discount.maxUsageCount ? discount.maxUsageCount.toString() : "");
    setIsActive(discount.isActive);
    
    const [sDate] = discount.startsAt.split("T");
    const [eDate] = discount.endsAt.split("T");
    setStartsAtDate(sDate || "");
    setEndsAtDate(eDate || "");
    setStartsAt(discount.startsAt.replace(/\.\d+Z$/, "").replace(/Z$/, ""));
    setEndsAt(discount.endsAt.replace(/\.\d+Z$/, "").replace(/Z$/, ""));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !discountValue || !startsAt || !endsAt) {
      toast.error("Please fill in all required fields");
      return;
    }

    const value = parseFloat(discountValue);
    if (isNaN(value) || value <= 0) {
      toast.error("Discount value must be greater than 0");
      return;
    }

    if (discountType === "PERCENTAGE" && value > 100) {
      toast.error("Percentage discount cannot exceed 100%");
      return;
    }

    const starts = new Date(startsAt);
    const ends = new Date(endsAt);

    if (ends.getTime() < starts.getTime()) {
      toast.error("Ends At date cannot be before Starts At date");
      return;
    }

    if (editingDiscount) {
      updateDiscountMutation.mutate({
        id: editingDiscount.id,
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: value,
        startsAt,
        endsAt,
        isActive,
        ...(maxUsageCount ? { maxUsageCount: parseInt(maxUsageCount, 10) } : {})
      });
    } else {
      createDiscountMutation.mutate({
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: value,
        startsAt,
        endsAt,
        ...(maxUsageCount ? { maxUsageCount: parseInt(maxUsageCount, 10) } : {})
      });
    }
  };

  const getStatusBadge = (discount: Discount) => {
    const now = new Date();
    const ends = new Date(discount.endsAt);

    if (now > ends) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-200 font-dm-sans">
          Expired
        </span>
      );
    }

    if (discount.isActive) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 font-dm-sans">
          Active
        </span>
      );
    }

    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 font-dm-sans">
        Deactivated
      </span>
    );
  };

  const formatDiscount = (discount: Discount) => {
    const val = Number(discount.discountValue);
    return discount.discountType === "PERCENTAGE" ? `${val}% Off` : `₹${val.toFixed(2)} Off`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Discount Coupons</h1>
        <p className="text-sm text-gorola-slate font-dm-sans">
          {isBooking
            ? "Create and manage coupon codes for your services. Coupon codes can be applied during booking checkout for services."
            : "Create and manage coupon codes for your store. Coupon codes can be applied in the cart drawer during checkout."}
        </p>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Create Form */}
        <div className="bg-white border border-gorola-mint/15 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-gorola-mint/10 pb-4">
            <Ticket className="h-5 w-5 text-gorola-pine" />
            <h2 className="text-lg font-bold text-gorola-charcoal font-heading">
              {editingDiscount ? "Edit Discount Code" : "Create Code"}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Coupon Code */}
            <div className="space-y-1">
              <label htmlFor="discount-code" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Discount Code
              </label>
              <input
                id="discount-code"
                type="text"
                placeholder="e.g. SUMMER50"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="w-full px-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans uppercase font-bold"
              />
            </div>

            {/* Discount Type */}
            <div className="space-y-1">
              <label htmlFor="discount-type" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Discount Type
              </label>
              <select
                id="discount-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "PERCENTAGE" | "FLAT")}
                className="w-full px-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal font-dm-sans"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>

            {/* Discount Value */}
            <div className="space-y-1">
              <label htmlFor="discount-value" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Discount Value
              </label>
              <div className="relative">
                <input
                  id="discount-value"
                  type="number"
                  placeholder="e.g. 10"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
                />
                {discountType === "PERCENTAGE" ? (
                  <Percent className="absolute left-3 top-3.5 h-4 w-4 text-gorola-slate" />
                ) : (
                  <span className="absolute left-4 top-3.5 text-gorola-slate text-sm font-bold select-none">₹</span>
                )}
              </div>
            </div>

            {/* Optional Max Usage Limit */}
            <div className="space-y-1">
              <label htmlFor="discount-maxUsage" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Max Usage Limit (Optional)
              </label>
              <input
                id="discount-maxUsage"
                type="number"
                placeholder="e.g. 100"
                value={maxUsageCount}
                onChange={(e) => setMaxUsageCount(e.target.value)}
                className="w-full px-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
              />
            </div>

            {/* Starts At */}
            <div className="space-y-1">
              <label htmlFor="discount-startsAt" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Starts At
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startsAtDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setStartsAtDate(newDate);
                    setStartsAt(`${newDate}T00:00`);
                  }}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
                />
                <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-gorola-slate" />
              </div>
              <input
                id="discount-startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  if (e.target.value) {
                    const [d] = e.target.value.split("T");
                    setStartsAtDate(d || "");
                  }
                }}
                style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", border: 0 }}
              />
            </div>

            {/* Ends At */}
            <div className="space-y-1">
              <label htmlFor="discount-endsAt" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Ends At
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endsAtDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setEndsAtDate(newDate);
                    setEndsAt(`${newDate}T23:59`);
                  }}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
                />
                <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-gorola-slate" />
              </div>
              <input
                id="discount-endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  if (e.target.value) {
                    const [d] = e.target.value.split("T");
                    setEndsAtDate(d || "");
                  }
                }}
                style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", border: 0 }}
              />
            </div>

            {/* Active Status Checkbox (Only in Edit Mode) */}
            {editingDiscount && (
              <div className="flex items-center gap-2 py-2">
                <input
                  id="discount-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gorola-mint/20 text-gorola-pine focus:ring-gorola-pine h-4 w-4"
                />
                <label htmlFor="discount-active" className="text-xs font-bold text-gorola-slate uppercase tracking-wider select-none cursor-pointer">
                  Active Status
                </label>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-2">
              {editingDiscount && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-5 py-3.5 border border-gorola-mint/20 hover:bg-gorola-mint/5 text-gorola-charcoal rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={createDiscountMutation.isPending || updateDiscountMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-gorola-pine/15 transition-all disabled:opacity-50"
              >
                {createDiscountMutation.isPending || updateDiscountMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {editingDiscount ? "Saving..." : "Creating..."}
                  </>
                ) : (
                  <>
                    {editingDiscount ? (
                      <>
                        <Plus className="h-4 w-4 rotate-45" />
                        Save Changes
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Discount Code
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Discounts List */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div data-testid="discounts-loading-skeleton" className="bg-white border border-gorola-mint/15 rounded-3xl p-6 space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gorola-mint/5 last:border-0">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-gorola-charcoal/10 rounded" />
                    <div className="h-3 w-20 bg-gorola-charcoal/10 rounded" />
                  </div>
                  <div className="h-8 w-24 bg-gorola-charcoal/10 rounded-lg" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 bg-white border border-gorola-mint/15 rounded-3xl p-8">
              <div className="h-14 w-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-gorola-charcoal font-heading">Failed to load discounts</h2>
              <p className="text-xs text-gorola-slate max-w-xs font-dm-sans">
                An error occurred while loading your discounts. Please try refreshing.
              </p>
              <button
                onClick={() => void refetch()}
                className="px-4 py-2 border border-gorola-pine/20 hover:bg-gorola-pine/5 text-gorola-pine text-xs font-bold uppercase rounded-lg"
              >
                Retry Connection
              </button>
            </div>
          ) : discountsResponse?.data && discountsResponse.data.length > 0 ? (
            <div className="bg-white border border-gorola-mint/15 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15">
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Code</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Type</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Value</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Used / Max</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Valid Until</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Status</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-right font-heading">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountsResponse.data.map((discount) => {
                      const isExpired = new Date() > new Date(discount.endsAt);
                      const canDeactivate = discount.isActive && !isExpired;

                      return (
                        <tr
                          key={discount.id}
                          className={`border-b border-gorola-mint/10 last:border-0 hover:bg-gorola-mint/5 transition-colors duration-150 ${(!discount.isActive || isExpired) ? "opacity-60" : ""}`}
                        >
                          <td className="p-4 font-heading text-sm font-black text-gorola-pine tracking-wider uppercase">
                            {discount.code}
                          </td>
                          <td className="p-4 font-dm-sans text-xs text-gorola-slate">
                            {discount.discountType}
                          </td>
                          <td className="p-4 font-dm-sans text-sm font-bold text-gorola-charcoal">
                            {formatDiscount(discount)}
                          </td>
                          <td className="p-4 font-dm-sans text-sm text-gorola-slate">
                            {discount.usedCount} / {discount.maxUsageCount ?? "∞"}
                          </td>
                          <td className="p-4 text-xs text-gorola-slate font-dm-sans">
                            {formatDate(discount.endsAt)}
                          </td>
                          <td className="p-4">
                            {getStatusBadge(discount)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              {/* Edit Button */}
                              <button
                                onClick={() => handleEditClick(discount)}
                                data-testid={`edit-discount-${discount.id}`}
                                className="p-2 border border-gorola-mint/20 hover:bg-gorola-mint/5 rounded-lg text-gorola-pine transition-all"
                                title="Edit Coupon"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              {/* Deactivate Button */}
                              {canDeactivate && (
                                <button
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to deactivate this discount code?")) {
                                      deactivateDiscountMutation.mutate(discount.id);
                                    }
                                  }}
                                  disabled={deactivateDiscountMutation.isPending}
                                  data-testid={`deactivate-discount-${discount.id}`}
                                  className="p-2 border border-rose-200 hover:bg-rose-50 rounded-lg text-rose-500 transition-all disabled:opacity-50"
                                  title="Deactivate Coupon"
                                >
                                  <PowerOff className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gorola-mint/15 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
              <div className="h-16 w-16 bg-gorola-mint/20 text-gorola-pine rounded-full flex items-center justify-center">
                <Ticket className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-gorola-charcoal font-heading">No discount codes found</h3>
              <p className="text-sm text-gorola-slate max-w-xs font-dm-sans">
                {isBooking
                  ? "No discount codes found. Create a coupon code to allow clients to redeem discounts on bookings."
                  : "No discount codes found. Create a coupon code to allow buyers to redeem discounts on products."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
