import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Loader2,
  Pencil,
  Percent,
  Plus,
  PowerOff,
  Tag} from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

type Offer = {
  id: string;
  storeId: string;
  title: string;
  description: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
};

type OffersEnvelope = {
  success: boolean;
  data: Offer[];
};

function getDefaultDateTimeString(daysOffset = 0, timeStr = "00:00") {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${timeStr}`;
}

export function StoreOffersPage(): ReactElement {
  const queryClient = useQueryClient();

  // Form states
  const [title, setTitle] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  
  // Date states (only dates are editable in the UI)
  const [startsAtDate, setStartsAtDate] = useState(() => getDefaultDateTimeString(0, "00:00").split("T")[0]);
  const [endsAtDate, setEndsAtDate] = useState(() => getDefaultDateTimeString(30, "23:59").split("T")[0]);

  // Unified backing states for testing / API
  const [startsAt, setStartsAt] = useState(() => getDefaultDateTimeString(0, "00:00"));
  const [endsAt, setEndsAt] = useState(() => getDefaultDateTimeString(30, "23:59"));

  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");

  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [isActive, setIsActive] = useState(true);

  // 1. Fetch Offers Query
  const { data: offersResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ["store", "offers"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<OffersEnvelope>("/api/v1/store/offers");
      return res.data;
    }
  });

  const resetForm = () => {
    setEditingOffer(null);
    setTitle("");
    setDiscountType("PERCENTAGE");
    setDiscountValue("");
    setMinOrderAmount("");
    setMaxDiscount("");
    setIsActive(true);
    
    const defaultStarts = getDefaultDateTimeString(0, "00:00");
    const defaultEnds = getDefaultDateTimeString(30, "23:59");
    
    setStartsAtDate(defaultStarts.split("T")[0]);
    setEndsAtDate(defaultEnds.split("T")[0]);
    
    setStartsAt(defaultStarts);
    setEndsAt(defaultEnds);
  };

  // 2. Submit Offer Mutation
  const createOfferMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      discountType: "PERCENTAGE" | "FLAT";
      discountValue: number;
      startsAt: string;
      endsAt: string;
      minOrderAmount?: number;
      maxDiscount?: number;
    }) => {
      if (!api) throw new Error("API helper not initialized");
      const formattedPayload = {
        ...payload,
        startsAt: new Date(payload.startsAt).toISOString(),
        endsAt: new Date(payload.endsAt).toISOString()
      };
      const res = await api.post<OffersEnvelope>("/api/v1/store/offers", formattedPayload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Offer created successfully");
      resetForm();
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", "offers"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to create offer";
      toast.error(errMsg);
    }
  });

  // 2.5. Update Offer Mutation
  const updateOfferMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      title: string;
      discountType: "PERCENTAGE" | "FLAT";
      discountValue: number;
      startsAt: string;
      endsAt: string;
      isActive: boolean;
      minOrderAmount?: number;
      maxDiscount?: number;
    }) => {
      if (!api) throw new Error("API helper not initialized");
      const formattedPayload = {
        ...payload,
        startsAt: new Date(payload.startsAt).toISOString(),
        endsAt: new Date(payload.endsAt).toISOString()
      };
      const res = await api.put<OffersEnvelope>(`/api/v1/store/offers/${payload.id}`, formattedPayload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Offer updated successfully");
      resetForm();
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", "offers"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to update offer";
      toast.error(errMsg);
    }
  });

  // 3. Deactivate Offer Mutation
  const deactivateOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/offers/${offerId}/deactivate`);
    },
    onSuccess: () => {
      toast.success("Offer deactivated successfully");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", "offers"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to deactivate offer";
      toast.error(errMsg);
    }
  });



  const handleEditClick = (offer: Offer) => {
    setEditingOffer(offer);
    setTitle(offer.title);
    setDiscountType(offer.discountType);
    setDiscountValue(offer.discountValue.toString());
    setMinOrderAmount(offer.minOrderAmount ? offer.minOrderAmount.toString() : "");
    setMaxDiscount(offer.maxDiscount ? offer.maxDiscount.toString() : "");
    setIsActive(offer.isActive);

    const [sDate] = offer.startsAt.split("T");
    const [eDate] = offer.endsAt.split("T");
    setStartsAtDate(sDate || "");
    setEndsAtDate(eDate || "");
    setStartsAt(offer.startsAt.replace(/\.\d+Z$/, "").replace(/Z$/, ""));
    setEndsAt(offer.endsAt.replace(/\.\d+Z$/, "").replace(/Z$/, ""));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !discountValue || !startsAt || !endsAt) {
      toast.error("Please fill in all required offer fields");
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

    if (editingOffer) {
      updateOfferMutation.mutate({
        id: editingOffer.id,
        title: title.trim(),
        discountType,
        discountValue: value,
        startsAt,
        endsAt,
        isActive,
        ...(minOrderAmount ? { minOrderAmount: parseFloat(minOrderAmount) } : {}),
        ...(maxDiscount ? { maxDiscount: parseFloat(maxDiscount) } : {})
      });
    } else {
      createOfferMutation.mutate({
        title: title.trim(),
        discountType,
        discountValue: value,
        startsAt,
        endsAt,
        ...(minOrderAmount ? { minOrderAmount: parseFloat(minOrderAmount) } : {}),
        ...(maxDiscount ? { maxDiscount: parseFloat(maxDiscount) } : {})
      });
    }
  };

  const getStatusBadge = (offer: Offer) => {
    const now = new Date();
    const ends = new Date(offer.endsAt);

    if (now > ends) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-200 font-dm-sans">
          Expired
        </span>
      );
    }

    if (offer.isActive) {
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

  const formatDiscount = (offer: Offer) => {
    const val = Number(offer.discountValue);
    return offer.discountType === "PERCENTAGE" ? `${val}% Off` : `₹${val.toFixed(2)} Off`;
  };

  const formatDateRange = (starts: string, ends: string) => {
    try {
      return `${format(new Date(starts), "dd MMM yyyy, hh:mm a")} - ${format(new Date(ends), "dd MMM yyyy, hh:mm a")}`;
    } catch {
      return `${starts} - ${ends}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Store Offers</h1>
        <p className="text-sm text-gorola-slate font-dm-sans">
          Create and manage promotional offers for your store. Offers apply automatically at checkout based on rules.
        </p>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Create Form */}
        <div className="bg-white border border-gorola-mint/15 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-gorola-mint/10 pb-4">
            <Tag className="h-5 w-5 text-gorola-pine" />
            <h2 className="text-lg font-bold text-gorola-charcoal font-heading">
              {editingOffer ? "Edit Offer" : "Create Offer"}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <label htmlFor="offer-title" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Offer Title
              </label>
              <input
                id="offer-title"
                type="text"
                placeholder="e.g. 10% Off Dairy"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
              />
            </div>

            {/* Discount Type */}
            <div className="space-y-1">
              <label htmlFor="offer-discountType" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Discount Type
              </label>
              <select
                id="offer-discountType"
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
              <label htmlFor="offer-discountValue" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Discount Value
              </label>
              <div className="relative">
                <input
                  id="offer-discountValue"
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
                  <span className="absolute left-4 top-3 text-gorola-slate text-sm font-bold select-none">₹</span>
                )}
              </div>
            </div>

            {/* Starts At */}
            <div className="space-y-1">
              <label htmlFor="offer-startsAt" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
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
                id="offer-startsAt"
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
              <label htmlFor="offer-endsAt" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
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
                id="offer-endsAt"
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

            {/* Optional Minimum Order Amount */}
            <div className="space-y-1">
              <label htmlFor="offer-minOrder" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Min Order Amount (Optional)
              </label>
              <input
                id="offer-minOrder"
                type="number"
                placeholder="e.g. 500"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
              />
            </div>

            {/* Optional Maximum Discount */}
            <div className="space-y-1">
              <label htmlFor="offer-maxDiscount" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Max Discount (Optional)
              </label>
              <input
                id="offer-maxDiscount"
                type="number"
                placeholder="e.g. 200"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                className="w-full px-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
              />
            </div>

            {/* Active Status Checkbox (Only in Edit Mode) */}
            {editingOffer && (
              <div className="flex items-center gap-2 py-2">
                <input
                  id="offer-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gorola-mint/20 text-gorola-pine focus:ring-gorola-pine h-4 w-4"
                />
                <label htmlFor="offer-active" className="text-xs font-bold text-gorola-slate uppercase tracking-wider select-none cursor-pointer">
                  Active Status
                </label>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-2">
              {editingOffer && (
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
                disabled={createOfferMutation.isPending || updateOfferMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-gorola-pine/15 transition-all disabled:opacity-50"
              >
                {createOfferMutation.isPending || updateOfferMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {editingOffer ? "Saving..." : "Creating..."}
                  </>
                ) : (
                  <>
                    {editingOffer ? (
                      <>
                        <Plus className="h-4 w-4 rotate-45" />
                        Save Changes
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Submit Offer
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Offers List */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div data-testid="offers-loading-skeleton" className="bg-white border border-gorola-mint/15 rounded-3xl p-6 space-y-4 animate-pulse">
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
              <h2 className="text-lg font-bold text-gorola-charcoal font-heading">Failed to load offers</h2>
              <p className="text-xs text-gorola-slate max-w-xs font-dm-sans">
                An error occurred while loading your offers. Please try refreshing.
              </p>
              <button
                onClick={() => void refetch()}
                className="px-4 py-2 border border-gorola-pine/20 hover:bg-gorola-pine/5 text-gorola-pine text-xs font-bold uppercase rounded-lg"
              >
                Retry Connection
              </button>
            </div>
          ) : offersResponse?.data && offersResponse.data.length > 0 ? (
            <div className="bg-white border border-gorola-mint/15 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15">
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Title</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Discount</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Date Range</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider font-heading">Status</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-right font-heading">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offersResponse.data.map((offer) => {
                      const isExpired = new Date() > new Date(offer.endsAt);
                      const canDeactivate = offer.isActive && !isExpired;

                      return (
                        <tr
                          key={offer.id}
                          className={`border-b border-gorola-mint/10 last:border-0 hover:bg-gorola-mint/5 transition-colors duration-150 ${(!offer.isActive || isExpired) ? "opacity-60" : ""}`}
                        >
                          <td className="p-4">
                            <h4 className="font-heading text-sm font-black text-gorola-charcoal">{offer.title}</h4>
                            {offer.description && offer.description !== offer.title && (
                              <p className="text-xs text-gorola-slate font-dm-sans mt-0.5">{offer.description}</p>
                            )}
                            {(offer.minOrderAmount || offer.maxDiscount) && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {offer.minOrderAmount && Number(offer.minOrderAmount) > 0 && (
                                  <span className="inline-flex px-1.5 py-0.5 rounded bg-gorola-mint/20 text-gorola-pine text-[10px] font-bold font-dm-sans border border-gorola-pine/10">
                                    Min Order: ₹{Number(offer.minOrderAmount).toFixed(0)}
                                  </span>
                                )}
                                {offer.maxDiscount && Number(offer.maxDiscount) > 0 && (
                                  <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold font-dm-sans border border-amber-150">
                                    Max Discount: ₹{Number(offer.maxDiscount).toFixed(0)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4 font-dm-sans text-sm font-bold text-gorola-pine">
                            {formatDiscount(offer)}
                          </td>
                          <td className="p-4 text-xs text-gorola-slate font-dm-sans">
                            {formatDateRange(offer.startsAt, offer.endsAt)}
                          </td>
                          <td className="p-4">
                            {getStatusBadge(offer)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditClick(offer)}
                                data-testid={`edit-offer-${offer.id}`}
                                className="p-2 border border-gorola-mint/20 hover:bg-gorola-mint/5 rounded-lg text-gorola-pine transition-all"
                                title="Edit Offer"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              {canDeactivate && (
                                <button
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to deactivate this offer?")) {
                                      deactivateOfferMutation.mutate(offer.id);
                                    }
                                  }}
                                  disabled={deactivateOfferMutation.isPending}
                                  data-testid={`deactivate-offer-${offer.id}`}
                                  className="p-2 border border-rose-250/20 hover:bg-rose-50 rounded-lg text-rose-500 transition-all disabled:opacity-50"
                                  title="Deactivate Offer"
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
                <Tag className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-gorola-charcoal font-heading">No offers found</h3>
              <p className="text-sm text-gorola-slate max-w-xs font-dm-sans">
                You haven't created any offers yet. Use the form on the left to launch your first deal!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
