import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Edit2,
  History,
  Plus,
  Search} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type Variant = {
  id: string;
  label: string;
  price: number;
  stockQty: number;
  unit: string;
  isActive: boolean;
  isAvailableForBooking?: boolean;
  lowStockThreshold?: number | null;
};

type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  subCategoryId: string;
  isActive: boolean;
  subCategory?: {
    id: string;
    name: string;
  } | null;
  variants: Variant[];
};

type ProductsEnvelope = {
  success: boolean;
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export function StoreProductsPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showLowStockOnly, setShowLowStockOnly] = useState(searchParams.get("lowStock") === "true");
  const [page, setPage] = useState(1);

  // Synchronize state with URL search params (e.g. from Dashboard deep-links)
  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setShowLowStockOnly(searchParams.get("lowStock") === "true");
    setPage(1);
  }, [searchParams]);

  // Store Profile Query — same cache key as StoreLayout/StoreDashboardPage.
  // All three MUST return res.data.data (the unwrapped profile object) so they
  // share a consistent cache shape. Returning res.data (the envelope) here
  // corrupts the cache and makes StoreLayout show the wrong sidebar menu.
  // Note: staleTime:0 is NOT needed here — the ?? null default below already
  // prevents the QUICK_COMMERCE flash while loading.
  const { data: profileData } = useQuery({
    queryKey: ["store", "profile"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: { storeType: string } }>("/api/v1/store/profile");
      return res.data.data;
    }
  });

  // Keep null while the profile is loading so store-type-gated UI (e.g. Stock History column)
  // is never shown prematurely for BOOKING_COMMERCE stores.
  const storeType = profileData?.storeType ?? null;

  // Modals & form states
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);
  const limit = 10;

  const toggleLowStockFilter = () => {
    const nextVal = !showLowStockOnly;
    setShowLowStockOnly(nextVal);
    setPage(1);

    const newParams: Record<string, string> = {};
    if (search) newParams.search = search;
    if (nextVal) newParams.lowStock = "true";
    setSearchParams(newParams);
  };

  // 1. Fetch Products Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["store", "products", { search, page, lowStock: showLowStockOnly }],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const url = `/api/v1/store/products?page=${page}&limit=${limit}${
        search ? `&search=${encodeURIComponent(search)}` : ""
      }${showLowStockOnly ? `&lowStock=true` : ""}`;
      const res = await api.get<ProductsEnvelope>(url);
      return res.data;
    }
  });

  // 2. Toggle Product Status Mutation
  const toggleProductStatusMutation = useMutation({
    mutationFn: async ({ productId, isActive }: { productId: string; isActive: boolean }) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/products/${productId}/status`, { isActive });
    },
    onSuccess: () => {
      toast.success("Product status updated successfully");
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] })
      ]);
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to update product status";
      toast.error(errMsg);
    }
  });

  const hasLowStock = (product: Product): boolean => {
    return product.variants.some((v) => {
      if (v.isActive === false) return false;
      const threshold = v.lowStockThreshold ?? 5;
      return v.stockQty <= threshold;
    });
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Store Products</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Manage your store catalog, track variants, stock status and pricing.
          </p>
        </div>
        <button
          onClick={() => navigate(getScopedPath("/store/products/new", "store", isSubdomainMode))}
          className="inline-flex items-center gap-2 px-5 py-3 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-gorola-pine/15 transition-all"
          id="add-product-btn"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row bg-white border border-gorola-mint/15 rounded-2xl p-3 shadow-sm items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 px-1">
          <Search className="h-5 w-5 text-gorola-slate shrink-0" />
          <input
            type="text"
            placeholder="Search by product name or keywords..."
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              setPage(1);
              const newParams: Record<string, string> = {};
              if (val) newParams.search = val;
              if (showLowStockOnly) newParams.lowStock = "true";
              setSearchParams(newParams);
            }}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-gorola-charcoal placeholder-gorola-slate/60 font-dm-sans"
            id="product-search-input"
          />
        </div>

        {/* Low Stock Filter Button Toggle */}
        <button
          onClick={toggleLowStockFilter}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
            showLowStockOnly
              ? "bg-red-50 text-red-600 border-red-200 shadow-sm shadow-red-50"
              : "bg-transparent text-gorola-slate border-gorola-mint/20 hover:bg-gorola-mint/10 hover:text-gorola-charcoal"
          }`}
          id="low-stock-filter-toggle"
        >
          <AlertTriangle className={`h-4 w-4 ${showLowStockOnly ? "animate-pulse" : ""}`} />
          {showLowStockOnly ? "Showing Low Stock Only" : "Filter Low Stock"}
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white border border-gorola-mint/15 rounded-2xl p-6 space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} data-testid="product-row-skeleton" className="flex items-center justify-between py-3 border-b border-gorola-mint/5 last:border-0">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-gorola-charcoal/10 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-gorola-charcoal/10 rounded" />
                  <div className="h-3 w-20 bg-gorola-charcoal/10 rounded" />
                </div>
              </div>
              <div className="h-8 w-24 bg-gorola-charcoal/10 rounded-lg" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 bg-white border border-gorola-mint/15 rounded-3xl p-8">
          <div className="h-14 w-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-gorola-charcoal font-heading">Failed to load products</h2>
          <p className="text-xs text-gorola-slate max-w-xs font-dm-sans">
            An error occurred while communicating with the catalog service. Please try refreshing.
          </p>
          <button
            onClick={() => void refetch()}
            className="px-4 py-2 border border-gorola-pine/20 hover:bg-gorola-pine/5 text-gorola-pine text-xs font-bold uppercase rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="bg-white border border-gorola-mint/15 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15">
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">Product Info</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">Sub-category</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">Variants</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">Stock Status</th>
                  {storeType === "QUICK_COMMERCE" && (
                    <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">Stock History</th>
                  )}
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((product) => {
                  return (
                    <tr
                      key={product.id}
                      data-testid={`product-row-${product.id}`}
                      className={`border-b border-gorola-mint/10 last:border-0 hover:bg-gorola-mint/5 transition-colors duration-150 ${
                        !product.isActive ? "opacity-60 bg-gray-50/50 dark:bg-muted/10 grayscale-[30%]" : ""
                      }`}
                    >
                      <td className="p-4 flex items-center gap-4">
                        <img
                          src={product.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=120"}
                          alt={product.name}
                          className="h-12 w-12 rounded-xl object-cover border border-gorola-mint/15 shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=120";
                          }}
                        />
                        <div>
                          <h4 className="font-heading text-sm font-black text-gorola-charcoal">{product.name}</h4>
                          <p className="text-xs text-gorola-slate truncate max-w-xs font-dm-sans">{product.description || "No description provided."}</p>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-semibold text-gorola-charcoal font-dm-sans">
                        {product.subCategory?.name || "Uncategorized"}
                      </td>
                      <td className="p-4">
                        <span
                          className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-gorola-pine/10 text-gorola-pine font-dm-sans"
                          data-testid={`variants-summary-${product.id}`}
                        >
                          {product.variants.filter((v) => v.isActive !== false).length} active out of {product.variants.length}
                        </span>
                      </td>
                      <td className="p-4">
                        {hasLowStock(product) ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200"
                            data-testid={`low-stock-badge-${product.id}`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200"
                            data-testid={`in-stock-badge-${product.id}`}
                          >
                            In Stock
                          </span>
                        )}
                      </td>
                      {storeType === "QUICK_COMMERCE" && (
                        <td className="p-4 text-left">
                          <button
                            onClick={() => navigate(getScopedPath(`/store/products/${product.id}/stock-history`, "store", isSubdomainMode))}
                            className="p-1.5 border border-gorola-mint/20 hover:border-gorola-pine/35 hover:bg-gorola-mint/10 rounded-lg text-gorola-slate hover:text-gorola-pine transition-all inline-flex items-center gap-1.5"
                            title="Stock History"
                            data-testid={`stock-history-${product.id}`}
                          >
                            <History className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold">View History</span>
                          </button>
                        </td>
                      )}
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            onClick={() => navigate(getScopedPath(`/store/products/${product.id}/edit`, "store", isSubdomainMode))}
                            className="p-2 border border-gorola-mint/20 hover:border-gorola-pine/35 hover:bg-gorola-mint/10 rounded-lg text-gorola-slate hover:text-gorola-pine transition-all"
                            title="Edit Product"
                            data-testid={`edit-product-${product.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          
                          <label className="relative inline-flex items-center cursor-pointer" title="Toggle Active Status">
                            <input
                              type="checkbox"
                              checked={product.isActive}
                              disabled={toggleProductStatusMutation.isPending}
                              onChange={(e) => {
                                toggleProductStatusMutation.mutate({
                                  productId: product.id,
                                  isActive: e.target.checked
                                });
                              }}
                              className="sr-only peer"
                              data-testid={`status-toggle-${product.id}`}
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-gorola-pine"></div>
                          </label>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
 
          {/* Pagination bar */}
          {data.meta && data.meta.total > limit && (
            <div className="flex justify-between items-center bg-gorola-mint/5 border-t border-gorola-mint/15 px-6 py-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-4 py-2 bg-white border border-gorola-mint/15 hover:border-gorola-pine/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-gorola-slate font-dm-sans">
                Page {page} of {Math.ceil(data.meta.total / limit)}
              </span>
              <button
                disabled={!data.meta.hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 bg-white border border-gorola-mint/15 hover:border-gorola-pine/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gorola-mint/15 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="h-16 w-16 bg-gorola-mint/20 text-gorola-pine rounded-full flex items-center justify-center">
            <Plus className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-gorola-charcoal font-heading">No products registered</h3>
          <p className="text-sm text-gorola-slate max-w-xs font-dm-sans">
            Start expanding your catalog by registering your first product variants today.
          </p>
          <button
            onClick={() => navigate(getScopedPath("/store/products/new", "store", isSubdomainMode))}
            className="px-4 py-2.5 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
          >
            Create Product
          </button>
        </div>
      )}
    </div>
  );
}
