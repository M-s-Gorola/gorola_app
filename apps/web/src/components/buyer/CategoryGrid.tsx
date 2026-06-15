import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  productCount: number;
  commerceType?: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
};

type CategoriesEnvelope = {
  success?: boolean;
  data?: CategoryDto[];
};

async function fetchCategories(): Promise<CategoryDto[]> {
  if (api === null) {
    throw new Error("API client is not configured");
  }

  const response = await api.get<CategoriesEnvelope>("/api/v1/categories");
  const payload = response.data;
  if (payload.success !== true || payload.data === undefined) {
    throw new Error("Invalid category response");
  }
  return payload.data;
}

export function CategoryGrid(): ReactElement {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["buyer-categories"],
    queryFn: fetchCategories
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const { quickCommerceCategories, bookingCommerceCategories } = useMemo(() => {
    const quick: CategoryDto[] = [];
    const booking: CategoryDto[] = [];
    for (const category of categories) {
      if (category.commerceType === "BOOKING_COMMERCE") {
        booking.push(category);
      } else {
        quick.push(category);
      }
    }
    return { quickCommerceCategories: quick, bookingCommerceCategories: booking };
  }, [categories]);

  useEffect(() => {
    if (categories.length === 0) {
      return;
    }
    const root = rootRef.current;
    if (root === null) {
      return;
    }

    const ctx = gsap.context(() => {
      const hasScrollTrigger =
        typeof (gsap as { core?: { globals?: () => Record<string, unknown> } }).core?.globals ===
          "function"
          ? Boolean((gsap as { core?: { globals?: () => Record<string, unknown> } }).core?.globals?.().ScrollTrigger)
          : false;

      const toVars: {
        y: number;
        opacity: number;
        duration: number;
        stagger: number;
        scrollTrigger?: {
          trigger: HTMLElement;
          start: string;
        };
      } = {
        y: 0,
        opacity: 1,
        duration: 0.45,
        stagger: 0.12
      };
      if (hasScrollTrigger) {
        /** String selector misses `root` itself (`.category-grid` is on `root`), yields “element not found” after navigation. */
        toVars.scrollTrigger = {
          trigger: root,
          start: "top 85%"
        };
      }

      gsap.fromTo(
        ".category-card",
        { y: 18, opacity: 0 },
        toVars
      );
    }, root);

    return () => {
      ctx.revert();
    };
  }, [categories.length]);

  if (categoriesQuery.isLoading) {
    return (
      <section aria-label="Category grid" className="space-y-3">
        <p className="font-dm-sans text-sm text-gorola-slate">Loading categories...</p>
        <div className="grid gap-3 grid-cols-2">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
        </div>
      </section>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <section aria-label="Category grid" className="space-y-3">
        <p className="font-dm-sans text-sm text-gorola-charcoal">Couldn't load categories - tap to retry</p>
        <button
          type="button"
          onClick={() => {
            void categoriesQuery.refetch();
          }}
          className="rounded-full bg-gorola-saffron px-4 py-2 text-sm font-semibold text-gorola-charcoal"
        >
          Retry
        </button>
      </section>
    );
  }

  if (categories.length === 0) {
    return (
      <section aria-label="Category grid">
        <p className="font-dm-sans text-sm text-gorola-slate">No categories available</p>
      </section>
    );
  }

  const renderCategoryCard = (category: CategoryDto) => (
    <button
      key={category.id}
      type="button"
      data-testid="category-card"
      className={cn(
        "category-card flex flex-col rounded-2xl border border-gorola-pine/10 bg-white p-2 sm:p-4 text-center shadow-sm group transition-all duration-300 w-full min-w-0 overflow-hidden",
        "hover:-translate-y-1 hover:shadow-md hover:border-gorola-pine/20 hover:bg-gradient-to-br hover:from-white hover:to-gorola-saffron/5"
      )}
      onClick={() => {
        navigate(`/categories/${category.slug}`);
      }}
    >
      <div className="mb-2 sm:mb-3 aspect-square w-full overflow-hidden rounded-xl bg-gorola-slate-mist/20 shrink-0">
        {category.imageUrl ? (
          <img 
            src={category.imageUrl} 
            alt={`${category.name} category`} 
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src !== "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") {
                img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
              }
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-gorola-saffron/10 border border-gorola-saffron/20 shadow-sm shrink-0">
            <span className="text-3xl">📦</span>
          </div>
        )}
      </div>
      <div className="min-w-0 w-full">
        <p className="font-dm-sans text-xs sm:text-base font-semibold text-gorola-charcoal group-hover:text-gorola-saffron transition-colors line-clamp-2 overflow-hidden leading-tight text-center">
          {category.name}
        </p>
      </div>
    </button>
  );

  return (
    <div ref={rootRef} className="space-y-10">
      {quickCommerceCategories.length > 0 && (
        <section aria-label="Instant Delivery categories" className="space-y-4">
          <div className="flex items-center gap-3 border-b border-gorola-pine/10 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gorola-saffron/10 text-xl shadow-inner">
              ⚡
            </div>
            <div>
              <h3 className="font-playfair text-xl font-bold text-gorola-charcoal">Instant Delivery</h3>
              <p className="font-dm-sans text-xs text-gorola-slate">Everyday essentials delivered to your doorstep in minutes</p>
            </div>
          </div>
          <div className="category-grid grid gap-4 grid-cols-4">
            {quickCommerceCategories.map(renderCategoryCard)}
          </div>
        </section>
      )}

      {bookingCommerceCategories.length > 0 && (
        <section aria-label="Book a Service categories" className="space-y-4">
          <div className="flex items-center gap-3 border-b border-gorola-pine/10 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gorola-pine/10 text-xl shadow-inner">
              📅
            </div>
            <div>
              <h3 className="font-playfair text-xl font-bold text-gorola-charcoal">Book a Service</h3>
              <p className="font-dm-sans text-xs text-gorola-slate">Expert doorstep repairs and diagnostic medical tests scheduled at your convenience</p>
            </div>
          </div>
          <div className="category-grid grid gap-4 grid-cols-4">
            {bookingCommerceCategories.map(renderCategoryCard)}
          </div>
        </section>
      )}
    </div>
  );
}
