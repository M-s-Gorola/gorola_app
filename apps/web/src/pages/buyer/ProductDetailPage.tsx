import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "@/lib/api";
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
  const userId = useAuthStore((state) => state.userId);
  const addOrMergeLine = useCartStore((state) => state.addOrMergeLine);
  const containerRef = useRef<HTMLElement | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const query = useQuery({
    queryKey: ["buyer-product-detail", id ?? null],
    queryFn: async () => {
      if (id === undefined) {
        throw new Error("Missing product id");
      }
      return fetchProductDetail(id);
    }
  });

  useEffect(() => {
    setSelectedVariantIndex(0);
    setQuantity(1);
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
      setQuantity(0);
      return;
    }
    setQuantity((current) => Math.min(Math.max(current, 1), selected.stockQty));
  }, [query.data, selectedVariantIndex]);

  useEffect(() => {
    if (containerRef.current === null || query.data === undefined || import.meta.env.MODE === "test") {
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

  const variants = query.data.variants;
  const selected = variants[selectedVariantIndex] ?? variants[0];
  const maxQty = Math.max(selected?.stockQty ?? 0, 0);
  const canAddToCart = selected !== undefined && selected.stockQty > 0 && quantity > 0;

  return (
    <section ref={containerRef} className="space-y-4 rounded-2xl bg-white/70 p-6">
      <h1 className="font-playfair text-3xl text-gorola-charcoal">{query.data.name}</h1>
      <p className="font-dm-sans text-sm text-gorola-slate">{query.data.store.name}</p>
      <p className="font-dm-sans text-sm text-gorola-slate">{query.data.store.phone}</p>
      <p className="font-dm-sans text-sm text-gorola-charcoal">{query.data.description}</p>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant, index) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => {
              setSelectedVariantIndex(index);
            }}
            className="rounded-full border border-gorola-pine/20 px-3 py-1 font-dm-sans text-sm text-gorola-charcoal"
          >
            {variant.label}
          </button>
        ))}
      </div>
      <p className="font-dm-sans text-base font-semibold text-gorola-charcoal">Rs {selected?.price ?? "0.00"}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => {
            setQuantity((current) => {
              if (maxQty <= 0) {
                return 0;
              }
              return Math.max(1, current - 1);
            });
          }}
          disabled={maxQty <= 0 || quantity <= 1}
          className="h-8 w-8 rounded-full border border-gorola-pine/20 text-sm font-semibold"
        >
          -
        </button>
        <span className="font-dm-sans text-sm text-gorola-charcoal">{quantity}</span>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => {
            if (maxQty <= 0) {
              return;
            }
            setQuantity((current) => Math.min(current + 1, maxQty));
          }}
          disabled={maxQty <= 0 || quantity >= maxQty}
          className="h-8 w-8 rounded-full border border-gorola-pine/20 text-sm font-semibold"
        >
          +
        </button>
      </div>
      <button
        type="button"
        aria-label="Add to cart"
        onClick={() => {
          if (selected === undefined || api === null || selected.stockQty <= 0 || quantity <= 0) {
            return;
          }
          addOrMergeLine({
            productVariantId: selected.id,
            quantity,
            productName: query.data.name,
            unitPrice: Number(selected.price),
            variantLabel: selected.label
          });
          if (userId === null) {
            return;
          }
          void api.post("/api/v1/cart/items", {
            userId,
            productVariantId: selected.id,
            quantity
          });
        }}
        disabled={!canAddToCart}
        className="w-full rounded-full bg-gorola-saffron px-5 py-2 font-dm-sans text-sm font-semibold text-gorola-charcoal sm:w-auto"
      >
        Add to cart
      </button>
    </section>
  );
}
