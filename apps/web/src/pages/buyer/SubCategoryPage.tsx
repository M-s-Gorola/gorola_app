import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";

import { ProductGrid } from "@/components/buyer/ProductGrid";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function SubCategoryPage(): ReactElement {
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);
  const { categorySlug, subCategorySlug } = useParams<{ categorySlug: string; subCategorySlug: string }>();
  const heading = subCategorySlug !== undefined ? toTitleCase(subCategorySlug) : "Sub-Category";

  const subCategoryQuery = useQuery({
    enabled: !isBootstrapPending && categorySlug !== undefined && subCategorySlug !== undefined,
    queryKey: ["buyer-subcategory-by-slug", categorySlug, subCategorySlug],
    queryFn: async () => {
      if (api === null || categorySlug === undefined || subCategorySlug === undefined) {
        return null;
      }
      const response = await api.get<{ success?: boolean; data?: Array<{ id: string; slug: string }> }>(
        `/api/v1/categories/${categorySlug}/sub-categories`
      );
      const payload = response.data;
      if (payload.success !== true || payload.data === undefined) {
        return null;
      }
      const subCategory = payload.data.find((item) => item.slug === subCategorySlug);
      return subCategory?.id ?? null;
    }
  });

  return (
    <section className="space-y-4 rounded-2xl bg-white/70 p-3 sm:p-6 md:p-8">
      <h1 className="font-playfair text-3xl text-gorola-charcoal">{heading}</h1>
      {subCategoryQuery.isLoading ? (
        <p className="font-dm-sans text-sm text-gorola-slate">Resolving sub-category...</p>
      ) : null}
      {typeof subCategoryQuery.data === "string" ? <ProductGrid subCategoryId={subCategoryQuery.data} /> : null}
    </section>
  );
}
