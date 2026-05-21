import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Edit2,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type Variant = {
  id: string;
  label: string;
  price: number;
  stockQty: number;
  unit: string;
  lowStockThreshold?: number | null;
};

type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  subCategoryId: string;
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);
  const limit = 10;

  // 1. Fetch Products Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["store", "products", { search, page }],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const url = `/api/v1/store/products?page=${page}&limit=${limit}${
        search ? `&search=${encodeURIComponent(search)}` : ""
      }`;
      const res = await api.get<ProductsEnvelope>(url);
      return res.data;
    }
  });

  // 2. Delete Product Mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.delete(`/api/v1/store/products/${productId}`);
    },
    onSuccess: () => {
      toast.success("Product deleted successfully");
      setProductToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["store", "products"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to delete product";
      toast.error(errMsg);
    }
  });

  const handleDeleteConfirm = () => {
    if (productToDelete) {
      deleteProductMutation.mutate(productToDelete.id);
    }
  };

  const hasLowStock = (product: Product): boolean => {
    return product.variants.some((v) => {
      const threshold = v.lowStockThreshold ?? 5;
      return v.stockQty <= threshold;
    });
  };

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
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
      <div className="flex bg-white border border-gorola-mint/15 rounded-2xl p-3 shadow-sm items-center gap-3">
        <Search className="h-5 w-5 text-gorola-slate" />
        <input
          type="text"
          placeholder="Search by product name or keywords..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 bg-transparent border-0 outline-none text-sm text-gorola-charcoal placeholder-gorola-slate/60 font-dm-sans"
          id="product-search-input"
        />
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
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider">Product Info</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider">Sub-category</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider">Variants</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider">Stock Status</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((product) => (
                  <tr
                    key={product.id}
                    data-testid={`product-row-${product.id}`}
                    className="border-b border-gorola-mint/10 last:border-0 hover:bg-gorola-mint/5 transition-colors duration-150"
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
                      <div className="space-y-1">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-gorola-pine/10 text-gorola-pine">
                          {product.variants.length} {product.variants.length === 1 ? "variant" : "variants"}
                        </span>
                        <div className="text-[10px] text-gorola-slate font-medium">
                          {product.variants.map((v) => `${v.label} (${formatCurrency(v.price)})`).join(", ")}
                        </div>
                      </div>
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
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => navigate(getScopedPath(`/store/products/${product.id}/edit`, "store", isSubdomainMode))}
                          className="p-2 border border-gorola-mint/20 hover:border-gorola-pine/35 hover:bg-gorola-mint/10 rounded-lg text-gorola-slate hover:text-gorola-pine transition-all"
                          title="Edit Product"
                          data-testid={`edit-product-${product.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setProductToDelete(product)}
                          className="p-2 border border-rose-100 hover:border-rose-350 hover:bg-rose-50 rounded-lg text-gorola-slate hover:text-rose-600 transition-all"
                          title="Delete Product"
                          data-testid={`delete-product-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div
          className="fixed inset-0 bg-gorola-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setProductToDelete(null)}
          data-testid="delete-confirm-modal"
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gorola-charcoal font-heading">Delete Product?</h3>
                <p className="text-xs text-gorola-slate mt-1 font-dm-sans">
                  This action is irreversible and will soft-delete "{productToDelete.name}" and all its active variants.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setProductToDelete(null)}
                className="flex-1 px-4 py-3 border border-gorola-mint/20 hover:bg-gorola-mint/10 rounded-xl text-xs font-bold text-gorola-slate transition-all"
              >
                Keep Product
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteProductMutation.isPending}
                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                data-testid="confirm-delete-btn"
              >
                {deleteProductMutation.isPending ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
