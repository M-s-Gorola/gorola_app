import type { ReactElement } from "react";
import { useParams } from "react-router-dom";

import { SubCategoryGrid } from "@/components/buyer/SubCategoryGrid";

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function CategoryPage(): ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const heading = slug !== undefined ? toTitleCase(slug) : "Category";

  return (
    <section className="space-y-4 rounded-2xl bg-white/70 p-3 sm:p-6 md:p-8">
      <h1 className="font-playfair text-3xl text-gorola-charcoal">{heading}</h1>
      {slug !== undefined ? <SubCategoryGrid categorySlug={slug} /> : null}
    </section>
  );
}
