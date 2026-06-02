import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";

import { ProductGrid } from "@/components/buyer/ProductGrid";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

type Offer = {
  id: string;
  title: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  minOrderAmount: number | null;
};

type StoreProfile = {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  isAcceptingOrders: boolean;
};

type StoreProfileEnvelope = {
  success?: boolean;
  data?: StoreProfile;
};

export function StoreDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);

  const storeQuery = useQuery({
    enabled: !isBootstrapPending && id !== undefined && api !== null,
    queryKey: ["buyer-store-profile", id],
    queryFn: async () => {
      if (api === null || id === undefined) {
        return null;
      }
      const response = await api.get<StoreProfileEnvelope>(`/api/v1/stores/${id}`);
      const payload = response.data;
      if (payload.success !== true || payload.data === undefined) {
        return null;
      }
      return payload.data;
    }
  });

  // Fetch active store offers so the buyer can see them on the store page
  const offersQuery = useQuery({
    enabled: !isBootstrapPending && id !== undefined && api !== null,
    queryKey: ["buyer-store-offers", id],
    queryFn: async (): Promise<Offer[]> => {
      if (api === null || id === undefined) return [];
      const res = await api.get<{ success: boolean; data: Offer[] }>(
        `/api/v1/promotions/store/${id}/offers`
      );
      return res.data.data ?? [];
    }
  });

  console.log("STORE DETAIL PAGE:", {
    isBootstrapPending,
    storeQueryIsLoading: storeQuery.isLoading,
    storeQueryError: storeQuery.error,
    storeQueryData: storeQuery.data,
    offersQueryIsLoading: offersQuery.isLoading,
    offersQueryError: offersQuery.error,
    offersQueryData: offersQuery.data,
  });

  if (isBootstrapPending || storeQuery.isLoading) {
    return (
      <section className="space-y-6">
        <div className="h-48 rounded-3xl bg-white skeleton" />
      </section>
    );
  }

  const store = storeQuery.data;
  const activeOffers = offersQuery.data ?? [];
  if (!store) {
    return (
      <section className="rounded-2xl bg-white/70 p-6 text-center shadow-sm">
        <h1 className="font-playfair text-2xl text-gorola-charcoal">Store not found</h1>
        <p className="mt-2 font-dm-sans text-sm text-gorola-slate">The store you are looking for does not exist or has been removed.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Store Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white/80 p-6 shadow-xl backdrop-blur-md border border-white/20 sm:p-8">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-3">
            <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-gorola-charcoal" data-testid="store-name">
              {store.name}
            </h1>
            {store.description && (
              <p className="font-dm-sans text-sm sm:text-base leading-relaxed text-gorola-charcoal/80 max-w-2xl">
                {store.description}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gorola-slate font-dm-sans">
              {store.phone && <span>📞 {store.phone}</span>}
              {store.address && <span>📍 {store.address}</span>}
            </div>
            {/* Active Offers Pills */}
            {activeOffers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {activeOffers.map((offer) => (
                  <span
                    key={offer.id}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-dm-sans"
                  >
                    🏷️ {offer.title}
                    {offer.discountType === "PERCENTAGE"
                      ? ` — ${offer.discountValue}% off`
                      : ` — ₹${offer.discountValue} off`}
                    {offer.minOrderAmount !== null && offer.minOrderAmount !== undefined && offer.minOrderAmount > 0
                      ? ` (min ₹${offer.minOrderAmount})`
                      : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Offline Banner */}
        {!store.isAcceptingOrders && (
          <div className="mt-6 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 font-dm-sans text-sm flex items-center gap-2 shadow-sm animate-pulse">
            <span>⚠️</span>
            <span data-testid="store-offline-banner">Store is currently offline and not accepting orders</span>
          </div>
        )}
      </div>

      {/* Product List */}
      {store.isAcceptingOrders && (
        <div className="rounded-2xl bg-white/70 p-4 sm:p-6 md:p-8 shadow-sm">
          <h2 className="font-playfair text-2xl text-gorola-charcoal mb-6">Browse Products</h2>
          <ProductGrid storeId={store.id} />
        </div>
      )}
    </section>
  );
}
