import { useQuery } from "@tanstack/react-query";
import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ProductGrid } from "@/components/buyer/ProductGrid";
import { api } from "@/lib/api";

type SearchResultItem = {
  id: string;
  name: string;
  slug?: string;
  categorySlug?: string;
  imageUrl?: string | null;
  price?: string;
  unit?: string;
};

type SearchResult = {
  categories: SearchResultItem[];
  subCategories: SearchResultItem[];
  products: SearchResultItem[];
};

async function fetchSearchResults(query: string): Promise<SearchResult | null> {
  if (api === null || !query.trim()) {
    return null;
  }

  const response = await api.get<{ success?: boolean; data?: SearchResult }>(
    `/api/v1/search?q=${encodeURIComponent(query)}`
  );
  
  const payload = response.data;
  if (payload.success !== true || payload.data === undefined) {
    return null;
  }
  
  return payload.data;
}

export function SearchResultsPage(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(queryParam);
  const navigate = useNavigate();

  useEffect(() => {
    setSearchInput(queryParam);
  }, [queryParam]);

  const searchQuery = useQuery({
    enabled: api !== null && queryParam.trim().length > 0,
    queryKey: ["buyer-search", queryParam],
    queryFn: () => fetchSearchResults(queryParam)
  });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() });
    } else {
      searchParams.delete("q");
      setSearchParams(searchParams);
    }
  };

  const results = searchQuery.data;
  const hasResults = results && (
    results.categories.length > 0 || 
    results.subCategories.length > 0 || 
    results.products.length > 0
  );

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/70 px-6 py-8 shadow-sm backdrop-blur-md">
        <h1 className="font-playfair text-3xl text-gorola-charcoal mb-4">Search</h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search for categories, or products..."
            className="flex-1 rounded-xl border border-gorola-slate-mist bg-white px-4 py-3 font-dm-sans text-sm focus:border-gorola-pine focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-gorola-saffron px-6 py-3 font-dm-sans font-semibold text-gorola-charcoal transition hover:bg-yellow-400"
          >
            Search
          </button>
        </form>
      </div>

      {searchQuery.isLoading && (
        <div className="rounded-2xl bg-white/70 px-6 py-8">
          <p className="font-dm-sans text-sm text-gorola-slate">Searching...</p>
        </div>
      )}

      {queryParam && !searchQuery.isLoading && !hasResults && (
        <div className="rounded-2xl bg-white/70 px-6 py-8 text-center">
          <p className="font-dm-sans text-lg text-gorola-charcoal">No results found for "{queryParam}"</p>
          <p className="font-dm-sans text-sm text-gorola-slate mt-2">Try checking your spelling or using different keywords</p>
        </div>
      )}

      {hasResults && (
        <div className="space-y-6" data-testid="search-results-grid">
          {results.categories.length > 0 && (
            <div className="rounded-2xl bg-white/70 px-6 py-8">
              <h2 className="font-playfair text-xl text-gorola-charcoal mb-4">Categories</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {results.categories.map((cat) => (
                  <button
                    key={`cat-${cat.id}`}
                    data-testid="search-result-category"
                    onClick={() => navigate(`/categories/${cat.slug}`)}
                    className="flex flex-col items-center justify-center rounded-2xl border border-gorola-pine/10 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.name} className="mb-3 h-16 w-16 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gorola-saffron/20">
                        <span className="text-2xl">📦</span>
                      </div>
                    )}
                    <span className="font-dm-sans font-semibold text-gorola-charcoal">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.subCategories.length > 0 && (
            <div className="rounded-2xl bg-white/70 px-6 py-8">
              <h2 className="font-playfair text-xl text-gorola-charcoal mb-4">Sub-Categories</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {results.subCategories.map((sub) => (
                  <button
                    key={`sub-${sub.id}`}
                    data-testid="search-result-subcategory"
                    onClick={() => {
                      if (sub.categorySlug && sub.slug) {
                        navigate(`/categories/${sub.categorySlug}/${sub.slug}`);
                      } else {
                        navigate(`/search?q=${sub.name}`);
                      }
                    }}
                    className="flex flex-col items-center justify-center rounded-2xl border border-gorola-pine/10 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    {sub.imageUrl ? (
                      <img src={sub.imageUrl} alt={sub.name} className="mb-3 h-16 w-16 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gorola-saffron/20">
                        <span className="text-2xl">🏷️</span>
                      </div>
                    )}
                    <span className="font-dm-sans font-semibold text-gorola-charcoal">{sub.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.products.length > 0 && (
            <div className="rounded-2xl bg-white/70 px-6 py-8">
              <h2 className="font-playfair text-xl text-gorola-charcoal mb-4">Products</h2>
              <ProductGrid search={queryParam} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
