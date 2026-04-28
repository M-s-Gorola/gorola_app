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
  emoji: string;
  productCount: number;
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
  return payload.data.filter((category) => category.slug === "groceries" || category.slug === "medical");
}

export function CategoryGrid(): ReactElement {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["buyer-categories"],
    queryFn: fetchCategories
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  useEffect(() => {
    if (categories.length === 0) {
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
          trigger: string;
          start: string;
        };
      } = {
        y: 0,
        opacity: 1,
        duration: 0.45,
        stagger: 0.12
      };
      if (hasScrollTrigger) {
        toVars.scrollTrigger = {
          trigger: ".category-grid",
          start: "top 85%"
        };
      }

      gsap.fromTo(
        ".category-card",
        { y: 18, opacity: 0 },
        toVars
      );
    }, rootRef);

    return () => {
      ctx.revert();
    };
  }, [categories.length]);

  if (categoriesQuery.isLoading) {
    return (
      <section aria-label="Category grid" className="space-y-3">
        <p className="font-dm-sans text-sm text-gorola-slate">Loading categories...</p>
        <div className="grid gap-3 sm:grid-cols-2">
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

  return (
    <section ref={rootRef} aria-label="Category grid" className="category-grid grid gap-4 sm:grid-cols-2">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={cn(
            "category-card rounded-2xl border border-gorola-pine/10 bg-white px-4 py-5 text-left shadow-sm transition",
            "hover:-translate-y-1 hover:shadow-md"
          )}
          onClick={() => {
            navigate(`/categories/${category.slug}`);
          }}
        >
          <p className="text-2xl" aria-hidden>
            {category.emoji}
          </p>
          <p className="mt-2 font-dm-sans text-lg font-semibold text-gorola-charcoal">{category.name}</p>
          <p className="mt-1 font-dm-sans text-sm text-gorola-slate">{category.productCount} products</p>
        </button>
      ))}
    </section>
  );
}
