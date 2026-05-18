import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";

type Address = {
  id: string;
  label: string;
  landmarkDescription: string;
  flatRoom: string | null;
  isDefault: boolean;
};

type ProductVariant = {
  id: string;
  label: string;
  price: string;
  requiresFasting: boolean;
  allowedTimeslots: string[];
};

type ProductDetail = {
  id: string;
  name: string;
  description: string;
  store: {
    id: string;
    name: string;
    bookingLeadDays?: number;
  };
  variants: ProductVariant[];
};

export function BookingTimeslotPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("productId") ?? "";
  const variantId = searchParams.get("variantId") ?? "";

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTimeslot, setSelectedTimeslot] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch product detail to get variants and timeslot configurations
  const productQuery = useQuery({
    queryKey: ["booking-product-detail", productId],
    queryFn: async (): Promise<ProductDetail> => {
      if (!productId) throw new Error("Missing product ID");
      const res = await api!.get<{ success: boolean; data: ProductDetail }>(
        `/api/v1/products/${productId}`
      );
      return res.data.data;
    },
    enabled: !!productId,
  });

  // Fetch user's saved addresses
  const addressQuery = useQuery({
    queryKey: ["buyer-addresses"],
    queryFn: async (): Promise<Address[]> => {
      const res = await api!.get<{ success: boolean; data?: { addresses: Address[] } }>(
        "/api/v1/addresses"
      );
      return res.data.data?.addresses ?? [];
    },
  });

  const product = productQuery.data;
  const variant = product?.variants.find((v) => v.id === variantId);
  const addresses = addressQuery.data ?? [];

  // Enforce fasting timeslot locks when component mounts or variant loads
  useEffect(() => {
    if (variant?.requiresFasting) {
      setSelectedTimeslot("06:00-09:00");
    } else {
      setSelectedTimeslot("");
    }
  }, [variant]);

  if (productQuery.isLoading || addressQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center font-dm-sans text-sm text-gorola-slate">
        Loading booking details...
      </div>
    );
  }

  if (productQuery.isError || !product || !variant) {
    return (
      <div className="rounded-xl bg-red-50 p-4 font-dm-sans text-sm text-red-700">
        Could not load booking details. Please try again.
      </div>
    );
  }

  // Calculate the minimum allowable scheduledDate based on bookingLeadDays
  const bookingLeadDays = product.store.bookingLeadDays ?? 1;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + bookingLeadDays);
  const minDateStr = tomorrow.toISOString().split("T")[0];

  const handlePlaceBooking = async (): Promise<void> => {
    if (!selectedDate || !selectedTimeslot || !selectedAddressId) return;
    setIsSubmitting(true);
    try {
      // API call matching Phase 7.3 specifications
      const res = await api!.post<{ success: boolean; data: { orderId: string } }>(
        "/api/v1/bookings",
        {
          storeId: product.store.id,
          items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
          scheduledDate: new Date(selectedDate).toISOString(),
          timeslot: selectedTimeslot,
          addressId: selectedAddressId,
        }
      );
      toast.success("Booking placed successfully!");
      navigate(`/bookings/${res.data.data.orderId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to place booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormComplete = selectedDate && selectedTimeslot && selectedAddressId && !isSubmitting;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      {/* Product Detail Card */}
      <div className="rounded-2xl border border-gorola-pine/10 bg-white p-5 shadow-sm text-left">
        <h1 className="font-playfair text-2xl font-bold text-gorola-charcoal">{product.name}</h1>
        <p className="mt-1 font-dm-sans text-sm font-semibold text-gorola-pine">{product.store.name}</p>
        <p className="mt-2 font-dm-sans text-sm text-gorola-slate leading-relaxed">{product.description}</p>
        <div className="mt-3 inline-flex rounded-full bg-gorola-saffron/10 px-3 py-1 font-dm-sans text-xs font-semibold text-gorola-charcoal">
          Variant: {variant.label} — Rs {variant.price}
        </div>
      </div>

      {/* Date Picker Section */}
      <div className="rounded-2xl border border-gorola-pine/10 bg-white p-5 shadow-sm text-left space-y-3">
        <label htmlFor="booking-date" className="block font-playfair text-lg font-bold text-gorola-charcoal">
          Select Date
        </label>
        <input
          id="booking-date"
          type="date"
          min={minDateStr}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full rounded-xl border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm outline-none focus:border-gorola-pine"
        />
      </div>

      {/* Timeslot Selector Section */}
      <div className="rounded-2xl border border-gorola-pine/10 bg-white p-5 shadow-sm text-left space-y-4">
        <h3 className="font-playfair text-lg font-bold text-gorola-charcoal">Select Timeslot</h3>
        
        {variant.requiresFasting && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 font-dm-sans text-sm text-amber-800">
            ⚠️ This test requires fasting. Please schedule for early morning.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {variant.allowedTimeslots.map((slot) => {
            const isDisabled = variant.requiresFasting && slot !== "06:00-09:00";
            const isSelected = selectedTimeslot === slot;
            return (
              <button
                key={slot}
                type="button"
                disabled={isDisabled}
                onClick={() => setSelectedTimeslot(slot)}
                className={`rounded-full border px-4 py-2 font-dm-sans text-sm font-semibold transition-all duration-200 ${
                  isSelected
                    ? "border-gorola-saffron bg-gorola-saffron/10 text-gorola-charcoal"
                    : isDisabled
                    ? "border-gorola-slate-mist/10 bg-gorola-slate-mist/5 text-gorola-slate/30 cursor-not-allowed"
                    : "border-gorola-pine/20 text-gorola-slate hover:border-gorola-pine/40"
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      {/* Address Selector Section */}
      <div className="rounded-2xl border border-gorola-pine/10 bg-white p-5 shadow-sm text-left space-y-4">
        <h3 className="font-playfair text-lg font-bold text-gorola-charcoal">Select Address</h3>
        {addresses.length === 0 ? (
          <p className="font-dm-sans text-sm text-gorola-slate">
            No saved addresses found. Please save an address in your profile first.
          </p>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => {
              const isSelected = selectedAddressId === addr.id;
              return (
                <label
                  key={addr.id}
                  className={`relative flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                    isSelected ? "border-gorola-pine bg-gorola-fog/30" : "border-gorola-pine/15"
                  }`}
                >
                  <input
                    type="radio"
                    name="booking-address"
                    value={addr.id}
                    checked={isSelected}
                    onChange={() => setSelectedAddressId(addr.id)}
                    className="mt-1 accent-gorola-pine"
                    aria-label={`Address option: ${addr.landmarkDescription}`}
                  />
                  <div className="space-y-1">
                    <span className="font-dm-sans font-bold text-sm text-gorola-charcoal">
                      {addr.label}
                    </span>
                    <p className="font-dm-sans text-xs text-gorola-slate leading-relaxed">
                      {addr.flatRoom ? `${addr.flatRoom}, ` : ""}
                      {addr.landmarkDescription}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Booking CTA */}
      <button
        type="button"
        disabled={!isFormComplete}
        onClick={handlePlaceBooking}
        className="w-full rounded-full bg-gorola-saffron py-3 font-dm-sans text-base font-bold text-gorola-charcoal shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Placing Booking..." : "Confirm Booking"}
      </button>
    </div>
  );
}
