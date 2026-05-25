import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Plus } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AddressMapPicker, type MapCoordinates, MUSSOORIE_AREA_CENTER } from "@/components/buyer/AddressMapPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  // Address creation form state
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [landmark, setLandmark] = useState("");
  const [flatRoom, setFlatRoom] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [mapCoords, setMapCoords] = useState<MapCoordinates | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await api!.post<{ success: boolean; data: { id: string } }>("/api/v1/addresses", body);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success("Address added successfully");
      setIsFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["buyer-addresses"] });
      if (res?.data?.id) {
        setSelectedAddressId(res.data.id);
      }
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const body = err.response?.data;
        if (typeof body === "object" && body !== null && "error" in body) {
          setFormError((body as { error: { message: string } }).error.message);
          return;
        }
      }
      setFormError("An unexpected error occurred. Please try again.");
    }
  });

  const handleSaveAddress = () => {
    setFormError(null);
    const trimmedLabel = label.trim();
    const trimmedLandmark = landmark.trim();
    
    if (trimmedLabel.length === 0) {
      setFormError("Label is required.");
      return;
    }
    if (trimmedLandmark.length < 10) {
      setFormError("Landmark must be at least 10 characters so drivers can find you.");
      return;
    }

    const payload: Record<string, unknown> = {
      label: trimmedLabel,
      landmarkDescription: trimmedLandmark,
      isDefault,
    };

    if (flatRoom.trim().length > 0) {
      payload.flatRoom = flatRoom.trim();
    }
    if (mapCoords) {
      payload.lat = mapCoords.lat;
      payload.lng = mapCoords.lng;
    }

    createMutation.mutate(payload);
  };

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

  const [addressDefaultSet, setAddressDefaultSet] = useState(false);
  useEffect(() => {
    if (addressDefaultSet) return;
    if (!addressQuery.isSuccess) return;
    if (addresses.length > 0) {
      const defaultAddr = addresses.find(a => a.isDefault);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        setAddressDefaultSet(true);
      }
    }
  }, [addressDefaultSet, addresses, addressQuery.isSuccess]);

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
      navigate(`/bookings/${res.data.data.orderId}`, { replace: true });
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
        <div className="flex items-center justify-between">
          <h3 className="font-playfair text-lg font-bold text-gorola-charcoal">Select Address</h3>
          <Button
            onClick={() => {
              setLabel("");
              setLandmark("");
              setFlatRoom("");
              setIsDefault(false);
              setMapCoords(null);
              setFormError(null);
              setIsFormOpen(true);
            }}
            size="sm"
            variant="outline"
            className="rounded-full border-gorola-pine/20 text-gorola-pine hover:bg-gorola-pine/5 flex items-center gap-1 font-dm-sans text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5" /> Add New
          </Button>
        </div>

        {addresses.length === 0 ? (
          <div className="text-center py-4 space-y-3">
            <p className="font-dm-sans text-sm text-gorola-slate">
              No saved addresses found.
            </p>
            <Button
              onClick={() => {
                setLabel("");
                setLandmark("");
                setFlatRoom("");
                setIsDefault(false);
                setMapCoords(null);
                setFormError(null);
                setIsFormOpen(true);
              }}
              size="sm"
              className="rounded-full bg-gorola-pine text-white"
            >
              <Plus className="mr-1 h-4 w-4" /> Add your first address
            </Button>
          </div>
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

      {/* Address Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md gap-6">
          <DialogHeader>
            <DialogTitle className="font-playfair text-xl">Add New Address</DialogTitle>
            <DialogDescription>
              Add a new location for your appointment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-left">
            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Label (e.g., Home, Work)</span>
              <input
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                name="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Home"
              />
            </label>
            
            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Flat / room (optional)</span>
              <input
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={flatRoom}
                onChange={(e) => setFlatRoom(e.target.value)}
                placeholder="Apt 4B"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Landmark (required)</span>
              <textarea
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                name="landmarkDescription"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="E.g. — near the red gate, behind Hotel Padmini"
                rows={3}
              />
            </label>

            <label className="flex items-center gap-2 font-dm-sans text-sm text-gorola-charcoal">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Set as default address
            </label>

            <div className="space-y-1 pt-2">
              <p className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Pinpoint location (optional)</p>
              <div className="h-48 overflow-hidden rounded-xl border border-gorola-pine/20">
                <AddressMapPicker
                  center={mapCoords ?? MUSSOORIE_AREA_CENTER}
                  onCoordinatesChange={setMapCoords}
                />
              </div>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button className="bg-gorola-pine text-white" onClick={handleSaveAddress} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
