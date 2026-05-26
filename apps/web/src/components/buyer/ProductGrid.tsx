import { useInfiniteQuery } from "@tanstack/react-query";
import gsap from "gsap";
import type { ReactElement } from "react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { syncBuyerCartFromServer } from "@/lib/buyer-cart-sync";
import { enqueueCartVariantMutation } from "@/lib/cart-variant-mutation-queue";
import { initGorolaGsapOnce } from "@/lib/gsap";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";

type ProductGridProps = {
  categoryId?: string;
  subCategoryId?: string;
  storeId?: string;
  search?: string;
};

type ProductListItem = {
  id: string;
  productId: string;
  name: string;
  imageUrl: string;
  storeId: string;
  storeName: string;
  storeType?: string;
  categoryId: string;
  highestPricedVariantId: string;
  price: string;
  unit: string;
};

type ProductPageEnvelope = {
  success?: boolean;
  data?: {
    items?: ProductListItem[];
    nextCursor?: string | null;
  };
};

type ProductPage = {
  items: ProductListItem[];
  nextCursor: string | null;
};

async function fetchProducts({
  categoryId,
  subCategoryId,
  storeId,
  search,
  cursor
}: {
  categoryId?: string;
  subCategoryId?: string;
  storeId?: string;
  search?: string;
  cursor?: string;
}): Promise<ProductPage> {
  if (api === null) {
    throw new Error("API client is not configured");
  }

  const response = await api.get<ProductPageEnvelope>("/api/v1/products", {
    params: {
      categoryId,
      subCategoryId,
      storeId,
      search,
      cursor,
      limit: 20
    }
  });
  const payload = response.data;
  if (payload.success !== true || payload.data?.items === undefined) {
    throw new Error("Invalid product response");
  }

  return {
    items: payload.data.items,
    nextCursor: payload.data.nextCursor ?? null
  };
}

export function ProductGrid(props: ProductGridProps): ReactElement {
  const [searchInput, setSearchInput] = useState(props.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(props.search ?? "");
  const addOrMergeLine = useCartStore((state) => state.addOrMergeLine);
  const setQty = useCartStore((state) => state.setQty);
  const lines = useCartStore((state) => state.lines);
  const accessToken = useAuthStore((state) => state.accessToken);
  const nextPageSentinelRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchInput]);

  const query = useInfiniteQuery({
    queryKey: ["buyer-products", props.categoryId ?? null, props.subCategoryId ?? null, props.storeId ?? null, debouncedSearch, props.search ?? null],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const search = debouncedSearch.length > 0 ? debouncedSearch : undefined;
      return fetchProducts({
        ...(props.categoryId !== undefined ? { categoryId: props.categoryId } : {}),
        ...(props.subCategoryId !== undefined ? { subCategoryId: props.subCategoryId } : {}),
        ...(props.storeId !== undefined ? { storeId: props.storeId } : {}),
        ...(search !== undefined ? { search } : {}),
        ...(pageParam !== undefined ? { cursor: pageParam } : {})
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data?.pages]
  );

  useEffect(() => {
    if (query.hasNextPage !== true || query.isFetchingNextPage) {
      return;
    }
    const sentinel = nextPageSentinelRef.current;
    if (sentinel === null) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first?.isIntersecting === true) {
        void query.fetchNextPage();
      }
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  useEffect(() => {
    if (items.length === 0 || gridRef.current === null) {
      return;
    }
    if (import.meta.env.MODE === "test") {
      return;
    }
    initGorolaGsapOnce();
    const grid = gridRef.current;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-product-card='true']"));
    const pending = cards.filter((card) => card.dataset.gsapAnimated !== "true");
    if (pending.length === 0) {
      return;
    }

    pending.forEach((card) => {
      card.dataset.gsapAnimated = "true";
    });

    const context = gsap.context(() => {
      pending.forEach((card, index) => {
        gsap.fromTo(
          card,
          { y: 12, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            delay: index * 0.06,
            duration: 0.45,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 92%",
              once: true
            }
          }
        );
      });
    }, grid);

    return () => {
      context.revert();
    };
  }, [items]);

  function syncAddCartItem(productVariantId: string, quantity: number): void {
    if (api === null || accessToken === null) {
      return;
    }
    void enqueueCartVariantMutation(productVariantId, async () => {
      await api!.post("/api/v1/cart/items", {
        productVariantId,
        quantity
      });
    });
    void syncBuyerCartFromServer();
  }

  function syncQtyChange(productVariantId: string, quantity: number): void {
    if (api === null || accessToken === null) {
      return;
    }
    void enqueueCartVariantMutation(productVariantId, async () => {
      if (quantity <= 0) {
        await api!.delete(`/api/v1/cart/items/${productVariantId}`);
      } else {
        await api!.put(`/api/v1/cart/items/${productVariantId}`, {
          quantity
        });
      }
    });
    void syncBuyerCartFromServer();
  }

  if (query.isLoading) {
    const skeletonCards = Array.from({ length: 12 }, (_, index) => (
      <article
        key={`skeleton-${index}`}
        data-testid="product-skeleton-card"
        className="h-36 rounded-2xl border border-gorola-pine/10 bg-white p-4 skeleton"
      />
    ));

    return (
      <section className="space-y-3" aria-label="Product grid">
        <input
          value={searchInput}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchInput(event.target.value);
          }}
          placeholder="Search products"
          className="w-full rounded-xl border border-gorola-slate-mist bg-white px-4 py-2 font-dm-sans text-sm"
        />
        <p className="font-dm-sans text-sm text-gorola-slate">Loading products...</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{skeletonCards}</div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="space-y-3" aria-label="Product grid">
        <input
          value={searchInput}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchInput(event.target.value);
          }}
          placeholder="Search products"
          className="w-full rounded-xl border border-gorola-slate-mist bg-white px-4 py-2 font-dm-sans text-sm"
        />
        <p className="font-dm-sans text-sm text-gorola-charcoal">Couldn't load products</p>
        <button
          type="button"
          onClick={() => {
            void query.refetch();
          }}
          className="rounded-full bg-gorola-saffron px-4 py-2 text-sm font-semibold text-gorola-charcoal"
        >
          Retry
        </button>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="space-y-3" aria-label="Product grid">
        <input
          value={searchInput}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchInput(event.target.value);
          }}
          placeholder="Search products"
          className="w-full rounded-xl border border-gorola-slate-mist bg-white px-4 py-2 font-dm-sans text-sm"
        />
        <p className="font-dm-sans text-sm text-gorola-slate">Nothing here yet - check back soon</p>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="Product grid">
      <input
        value={searchInput}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setSearchInput(event.target.value);
        }}
        placeholder="Search products"
        className="w-full rounded-xl border border-gorola-slate-mist bg-white px-4 py-2 font-dm-sans text-sm"
      />
      <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.id}
            data-product-card="true"
            data-testid="product-card"
            className="flex flex-col rounded-2xl border border-gorola-pine/10 bg-white p-4 shadow-sm"
          >
            <Link to={`/products/${item.productId}`} className="group block cursor-pointer">
              <div className="mb-3 h-32 w-full overflow-hidden rounded-xl bg-gorola-slate-mist/20">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "https://picsum.photos/400/400?grayscale";
                  }}
                />
              </div>
              <p className="font-dm-sans text-base font-semibold text-gorola-charcoal group-hover:text-gorola-saffron transition-colors" data-testid="product-name">
                {item.name}
              </p>
            </Link>
            <p className="mt-1 font-dm-sans text-sm text-gorola-slate">{item.storeName}</p>
            <div className="mt-auto pt-2">
              <p className="font-dm-sans text-sm text-gorola-charcoal">Rs {item.price}</p>
              <p className="mt-1 font-dm-sans text-xs text-gorola-slate">Unit: {item.unit}</p>
            </div>
            {(() => {
              if (item.storeType === "BOOKING_COMMERCE") {
                return (
                  <Link
                    to={`/bookings/new?productId=${item.productId}&variantId=${item.highestPricedVariantId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="mt-3 inline-block text-center rounded-full bg-gorola-saffron px-4 py-2 text-sm font-semibold text-gorola-charcoal"
                  >
                    Book
                  </Link>
                );
              }

              const line = lines.find(
                (candidate) => candidate.productVariantId === item.highestPricedVariantId
              );
              const quantity = line?.quantity ?? 0;
              if (quantity > 0) {
                return (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = quantity - 1;
                        setQty(item.highestPricedVariantId, next);
                        syncQtyChange(item.highestPricedVariantId, next);
                      }}
                      className="h-8 w-8 rounded-full border border-gorola-pine/20 text-sm font-semibold text-gorola-charcoal"
                    >
                      -
                    </button>
                    <span className="min-w-4 text-center font-dm-sans text-sm text-gorola-charcoal">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = quantity + 1;
                        setQty(item.highestPricedVariantId, next);
                        syncQtyChange(item.highestPricedVariantId, next);
                      }}
                      className="h-8 w-8 rounded-full border border-gorola-pine/20 text-sm font-semibold text-gorola-charcoal"
                    >
                      +
                    </button>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  aria-label={`Add ${item.name} to cart`}
                  onClick={(e) => {
                    e.stopPropagation();
                    addOrMergeLine({
                      productVariantId: item.highestPricedVariantId,
                      quantity: 1,
                      productName: item.name,
                      unitPrice: Number(item.price),
                      variantLabel: item.unit
                    });
                    syncAddCartItem(item.highestPricedVariantId, 1);
                  }}
                  className="mt-3 rounded-full bg-gorola-saffron px-4 py-2 text-sm font-semibold text-gorola-charcoal"
                >
                  Add
                </button>
              );
            })()}
          </article>
        ))}
      </div>
      {query.hasNextPage === true ? <div ref={nextPageSentinelRef} aria-hidden="true" className="h-4 w-full" /> : null}
    </section>
  );
}
