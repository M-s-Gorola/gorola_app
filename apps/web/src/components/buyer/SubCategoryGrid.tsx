import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type SubCategoryDto = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
};

type SubCategoriesEnvelope = {
  success?: boolean;
  data?: SubCategoryDto[];
};

async function fetchSubCategories(categorySlug: string): Promise<SubCategoryDto[]> {
  if (api === null) {
    throw new Error("API client is not configured");
  }

  const response = await api.get<SubCategoriesEnvelope>(`/api/v1/categories/${categorySlug}/sub-categories`);
  const payload = response.data;
  if (payload.success !== true || payload.data === undefined) {
    throw new Error("Invalid sub-category response");
  }
  return payload.data;
}

export function SubCategoryGrid({ categorySlug }: { categorySlug: string }): ReactElement {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement | null>(null);

  const subCategoriesQuery = useQuery({
    queryKey: ["buyer-sub-categories", categorySlug],
    queryFn: () => fetchSubCategories(categorySlug)
  });

  const subCategories = useMemo(() => subCategoriesQuery.data ?? [], [subCategoriesQuery.data]);

  useEffect(() => {
    if (subCategories.length === 0) {
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
        toVars.scrollTrigger = {
          trigger: root,
          start: "top 85%"
        };
      }

      gsap.fromTo(
        ".subcategory-card",
        { y: 18, opacity: 0 },
        toVars
      );
    }, root);

    return () => {
      ctx.revert();
    };
  }, [subCategories.length]);

  useEffect(() => {
    if (subCategories.length === 1 && subCategories[0]?.slug) {
      navigate(`/categories/${categorySlug}/${subCategories[0].slug}`, { replace: true });
    }
  }, [subCategories, categorySlug, navigate]);

  if (subCategoriesQuery.isLoading) {
    return (
      <section aria-label="SubCategory grid" className="space-y-3">
        <p className="font-dm-sans text-sm text-gorola-slate">Loading sub-categories...</p>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
        </div>
      </section>
    );
  }

  if (subCategoriesQuery.isError) {
    return (
      <section aria-label="SubCategory grid" className="space-y-3">
        <p className="font-dm-sans text-sm text-gorola-charcoal">Couldn't load sub-categories - tap to retry</p>
        <button
          type="button"
          onClick={() => {
            void subCategoriesQuery.refetch();
          }}
          className="rounded-full bg-gorola-saffron px-4 py-2 text-sm font-semibold text-gorola-charcoal"
        >
          Retry
        </button>
      </section>
    );
  }

  if (subCategories.length === 0) {
    return (
      <section aria-label="SubCategory grid">
        <p className="font-dm-sans text-sm text-gorola-slate">No sub-categories available</p>
      </section>
    );
  }

  return (
    <section ref={rootRef} aria-label="SubCategory grid" className="subcategory-grid grid gap-4 grid-cols-4">
      {subCategories.map((subCategory) => (
        <button
          key={subCategory.id}
          type="button"
          data-testid="subcategory-card"
          className={cn(
            "subcategory-card flex flex-col rounded-2xl border border-gorola-pine/10 bg-white p-2 sm:p-4 text-center shadow-sm group transition-all duration-300 w-full min-w-0 overflow-hidden",
            "hover:-translate-y-1 hover:shadow-md hover:border-gorola-pine/20 hover:bg-gradient-to-br hover:from-white hover:to-gorola-saffron/5"
          )}
          onClick={() => {
            navigate(`/categories/${categorySlug}/${subCategory.slug}`);
          }}
        >
          <div className="mb-2 sm:mb-3 aspect-square w-full overflow-hidden rounded-xl bg-gorola-slate-mist/20 shrink-0">
            {subCategory.imageUrl ? (
              <img 
                src={subCategory.imageUrl} 
                alt={`${subCategory.name} sub-category`} 
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (img.src !== "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") {
                    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                  }
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-gorola-saffron/20 border border-gorola-saffron/30 shadow-sm shrink-0">
                <span className="text-3xl">🏷️</span>
              </div>
            )}
          </div>
          <div className="min-w-0 w-full">
            <p className="font-dm-sans text-xs sm:text-base font-semibold text-gorola-charcoal group-hover:text-gorola-saffron transition-colors line-clamp-2 overflow-hidden leading-tight text-center">
              {subCategory.name}
            </p>
          </div>
        </button>
      ))}
    </section>
  );
}
