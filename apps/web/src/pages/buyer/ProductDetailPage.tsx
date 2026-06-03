import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate,useParams } from "react-router-dom";

import { api } from "@/lib/api";
import { syncBuyerCartFromServer } from "@/lib/buyer-cart-sync";
import { enqueueCartVariantMutation } from "@/lib/cart-variant-mutation-queue";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";

type ProductVariant = {
  id: string;
  label: string;
  price: string;
  unit: string;
  stockQty: number;
};

type ProductDetail = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  store: {
    id: string;
    name: string;
    phone: string;
    storeType: string;
  };
  variants: ProductVariant[];
};

type ProductDetailEnvelope = {
  success?: boolean;
  data?: ProductDetail;
};

async function fetchProductDetail(id: string): Promise<ProductDetail> {
  if (api === null) {
    throw new Error("API client is not configured");
  }
  const response = await api.get<ProductDetailEnvelope>(`/api/v1/products/${id}`);
  const payload = response.data;
  if (payload.success !== true || payload.data === undefined) {
    throw new Error("Invalid product detail response");
  }
  return payload.data;
}

export function ProductDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const addOrMergeLine = useCartStore((state) => state.addOrMergeLine);
  const setCartQty = useCartStore((state) => state.setQty);
  const cartLines = useCartStore((state) => state.lines);
  const containerRef = useRef<HTMLElement | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [localQuantity, setLocalQuantity] = useState(1);

  const query = useQuery({
    queryKey: ["buyer-product-detail", id ?? null],
    queryFn: async () => {
      if (id === undefined) {
        throw new Error("Missing product id");
      }
      return fetchProductDetail(id);
    }
  });

  const variants = query.data?.variants ?? [];
  const selected = variants[selectedVariantIndex];
  const cartItem = cartLines.find((l) => l.productVariantId === selected?.id);
  const quantityInCart = cartItem?.quantity ?? 0;
  const prevQuantityInCart = useRef(quantityInCart);

  useEffect(() => {
    if (prevQuantityInCart.current > 0 && quantityInCart === 0) {
      setLocalQuantity(1);
    }
    prevQuantityInCart.current = quantityInCart;
  }, [quantityInCart]);

  useEffect(() => {
    setSelectedVariantIndex(0);
    setLocalQuantity(1);
  }, [query.data?.id]);

  useEffect(() => {
    if (query.data === undefined) {
      return;
    }
    const selected = query.data.variants[selectedVariantIndex];
    if (selected === undefined) {
      return;
    }
    if (selected.stockQty <= 0) {
      setLocalQuantity(0);
      return;
    }
    setLocalQuantity((current) => Math.min(Math.max(current, 1), selected.stockQty));
  }, [query.data, selectedVariantIndex]);

  useEffect(() => {
    if (containerRef.current === null || query.data === undefined || import.meta.env.MODE === "test" || (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).isE2E)) {
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
      );
    }, containerRef);
    return () => {
      ctx.revert();
    };
  }, [query.data]);

  if (query.isLoading) {
    return <section data-testid="product-detail-skeleton" className="h-64 rounded-2xl bg-white skeleton" />;
  }

  if (query.isError || query.data === undefined) {
    return <p className="font-dm-sans text-sm text-gorola-charcoal">Could not load product details</p>;
  }

  const activeQuantity = quantityInCart > 0 ? quantityInCart : localQuantity;
  const maxQty = Math.max(selected?.stockQty ?? 0, 0);
  const canAddToCart = selected !== undefined && selected.stockQty > 0 && localQuantity > 0;

  const itemTotal = (Number(selected?.price ?? 0) * activeQuantity).toFixed(2);

  return (
    <section ref={containerRef} className="grid gap-6 rounded-3xl bg-white/80 p-6 shadow-xl md:grid-cols-2 md:p-8 md:gap-8">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gorola-slate-mist/10">
        <img
          src={query.data.imageUrl}
          alt={query.data.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src !== "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") {
              img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            }
          }}
        />
      </div>
      <div className="flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <div>
            <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-gorola-charcoal">{query.data.name}</h1>
            <p className="mt-2 font-dm-sans text-base sm:text-lg font-medium text-gorola-pine">{query.data.store.name}</p>
            <p className="font-dm-sans text-xs sm:text-sm text-gorola-slate">{query.data.store.phone}</p>
          </div>
          
          <div className="h-px w-full bg-gorola-slate-mist/30" />
          
          <p className="font-dm-sans text-sm sm:text-base leading-relaxed text-gorola-charcoal/80">
            {query.data.description}
          </p>

          {/* Desktop-only Variant Selector */}
          <div className="hidden md:flex flex-wrap gap-2 py-2">
            {variants.map((variant, index) => (
              <button
                key={variant.id}
                type="button"
                data-testid="variant-pill"
                onClick={() => {
                  setSelectedVariantIndex(index);
                }}
                className={`rounded-full border px-4 py-1.5 font-dm-sans text-sm transition-all duration-200 ${
                  selectedVariantIndex === index
                    ? "border-gorola-saffron bg-gorola-saffron/10 text-gorola-charcoal font-semibold"
                    : "border-gorola-pine/20 text-gorola-slate hover:border-gorola-pine/40"
                }`}
              >
                {variant.label}
              </button>
            ))}
          </div>
        </div>
 
        <div className="space-y-6">
          {/* Mobile-only Variant + Price Row */}
          <div className="flex md:hidden items-center justify-between gap-4 py-3 border-y border-gorola-slate-mist/20">
            <div className="flex flex-wrap gap-2">
              {variants.map((variant, index) => (
                <button
                  key={variant.id}
                  type="button"
                  data-testid="variant-pill"
                  onClick={() => {
                    setSelectedVariantIndex(index);
                  }}
                  className={`rounded-full border px-4 py-1.5 font-dm-sans text-sm transition-all duration-200 ${
                    selectedVariantIndex === index
                      ? "border-gorola-saffron bg-gorola-saffron/10 text-gorola-charcoal font-semibold"
                      : "border-gorola-pine/20 text-gorola-slate hover:border-gorola-pine/40"
                  }`}
                >
                  {variant.label}
                </button>
              ))}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-dm-sans text-2xl sm:text-3xl font-bold text-gorola-charcoal">
                Rs {selected?.price ?? "0.00"}
              </p>
              {query.data.store.storeType !== "BOOKING_COMMERCE" && activeQuantity > 1 && (
                <p className="font-dm-sans text-xs sm:text-sm text-gorola-slate mt-0.5">
                  (Total: Rs {itemTotal})
                </p>
              )}
            </div>
          </div>

          {/* Desktop-only Price Block */}
          <div className="hidden md:flex items-baseline gap-3 pt-2">
            <p className="font-dm-sans text-3xl font-bold text-gorola-charcoal" data-testid="product-price">
              Rs {selected?.price ?? "0.00"}
            </p>
            {query.data.store.storeType !== "BOOKING_COMMERCE" && activeQuantity > 1 && (
              <p className="font-dm-sans text-lg text-gorola-slate">
                (Total: Rs {itemTotal})
              </p>
            )}
          </div>
          <div className="pt-2">
          {query.data.store.storeType === "BOOKING_COMMERCE" ? (
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Book Now"
                onClick={() => {
                  if (selected === undefined) return;
                  navigate(`/bookings/new?productId=${query.data.id}&variantId=${selected.id}`);
                }}
                className="flex-1 rounded-full bg-gorola-saffron px-8 py-3 font-dm-sans text-base font-bold text-gorola-charcoal shadow-lg transition-transform hover:scale-[1.02] active:scale-95 sm:flex-none"
              >
                Book Now
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => {
                    if (quantityInCart > 0) {
                      const next = quantityInCart - 1;
                      setCartQty(selected!.id, next);
                      if (api !== null && accessToken !== null) {
                        void enqueueCartVariantMutation(selected!.id, async () => {
                          if (next <= 0) {
                            await api!.delete(`/api/v1/cart/items/${selected!.id}`);
                          } else {
                            await api!.put(`/api/v1/cart/items/${selected!.id}`, {
                              quantity: next
                            });
                          }
                        });
                        void syncBuyerCartFromServer();
                      }
                    } else {
                      setLocalQuantity((current) => Math.max(1, current - 1));
                    }
                  }}
                  disabled={maxQty <= 0 || (quantityInCart === 0 && localQuantity <= 1) || activeQuantity <= 0}
                  className="h-10 w-10 rounded-full border border-gorola-pine/20 text-lg font-semibold transition-colors hover:bg-gorola-pine/5 disabled:opacity-30"
                >
                  -
                </button>
                <span className="min-w-[2rem] text-center font-dm-sans text-lg font-bold text-gorola-charcoal">
                  {activeQuantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => {
                    if (quantityInCart > 0) {
                      const next = quantityInCart + 1;
                      if (next > maxQty) return;
                      setCartQty(selected!.id, next);
                      if (api !== null && accessToken !== null) {
                        void enqueueCartVariantMutation(selected!.id, async () => {
                          await api!.put(`/api/v1/cart/items/${selected!.id}`, {
                            quantity: next
                          });
                        });
                        void syncBuyerCartFromServer();
                      }
                    } else {
                      setLocalQuantity((current) => Math.min(current + 1, maxQty));
                    }
                  }}
                  disabled={maxQty <= 0 || activeQuantity >= maxQty}
                  className="h-10 w-10 rounded-full border border-gorola-pine/20 text-lg font-semibold transition-colors hover:bg-gorola-pine/5 disabled:opacity-30"
                >
                  +
                </button>
              </div>

              {quantityInCart === 0 ? (
                <button
                  type="button"
                  aria-label="Add to cart"
                  onClick={() => {
                    if (selected === undefined || api === null || selected.stockQty <= 0 || localQuantity <= 0) {
                      return;
                    }
                    addOrMergeLine({
                      productVariantId: selected.id,
                      quantity: localQuantity,
                      productName: query.data.name,
                      unitPrice: Number(selected.price),
                      variantLabel: selected.label,
                      storeId: query.data.store.id
                    });
                    if (accessToken === null) {
                      return;
                    }
                    void enqueueCartVariantMutation(selected.id, async () => {
                      await api!.post("/api/v1/cart/items", {
                        productVariantId: selected.id,
                        quantity: localQuantity
                      });
                    });
                    void syncBuyerCartFromServer();
                  }}
                  disabled={!canAddToCart}
                  className="flex-1 rounded-full bg-gorola-saffron px-8 py-3 font-dm-sans text-base font-bold text-gorola-charcoal shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 sm:flex-none"
                >
                  Add to cart
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    useCartStore.getState().open();
                  }}
                  className="flex-1 rounded-full bg-gorola-pine px-8 py-3 font-dm-sans text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 sm:flex-none"
                >
                  View in Cart
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
