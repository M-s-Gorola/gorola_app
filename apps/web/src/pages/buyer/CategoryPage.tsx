import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";

import { ProductGrid } from "@/components/buyer/ProductGrid";
import { api } from "@/lib/api";

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function CategoryPage(): ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const heading = slug !== undefined ? toTitleCase(slug) : "Category";
  const categoryQuery = useQuery({
    enabled: api !== null && slug !== undefined,
    queryKey: ["buyer-category-by-slug", slug ?? null],
    queryFn: async () => {
      if (api === null || slug === undefined) {
        return null;
      }
      const response = await api.get<{ success?: boolean; data?: Array<{ id: string; slug: string }> }>(
        "/api/v1/categories"
      );
      const payload = response.data;
      if (payload.success !== true || payload.data === undefined) {
        return null;
      }
      const category = payload.data.find((item) => item.slug === slug);
      return category?.id ?? null;
    }
  });

  return (
    <section className="space-y-4 rounded-2xl bg-white/70 px-6 py-8">
      <h1 className="font-playfair text-3xl text-gorola-charcoal">{heading}</h1>
      {categoryQuery.isLoading ? (
        <p className="font-dm-sans text-sm text-gorola-slate">Resolving category...</p>
      ) : null}
      {typeof categoryQuery.data === "string" ? <ProductGrid categoryId={categoryQuery.data} /> : null}
    </section>
  );
}
