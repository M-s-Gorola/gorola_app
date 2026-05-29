import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Filter, History } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

interface StockMovement {
  id: string;
  type: "INITIAL" | "REFILL" | "ADJUSTMENT" | "SALE";
  quantity: number;
  stockQtyBefore: number;
  stockQtyAfter: number;
  note?: string;
  reason?: string;
  createdAt: string;
  productVariant: {
    id: string;
    label: string;
    unit: string;
    product: {
      id: string;
      name: string;
    };
  };
}

interface ProductDetail {
  id: string;
  name: string;
  variants: {
    id: string;
    label: string;
    unit: string;
  }[];
}

export function StoreStockHistoryPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  const [selectedVariantId, setSelectedVariantId] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Fetch product details to get name and variants for filters
  // staleTime: 0 ensures we always get fresh product data on navigation (not stale cache)
  const { data: product, isLoading: isProductLoading } = useQuery<ProductDetail>({
    queryKey: ["store", "stock-history-product", id],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: ProductDetail }>(`/api/v1/store/products/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: true
  });

  // Fetch stock history list
  // staleTime: 0 + refetchOnMount: "always" ensures fresh data is fetched every time
  // the user navigates to this page, bypassing the global 60s stale cache entirely.
  const { data: history = [], isLoading: isHistoryLoading } = useQuery<StockMovement[]>({
    queryKey: ["store", "stock-history", id],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: StockMovement[] }>(
        `/api/v1/store/products/${id}/stock-history`
      );
      return res.data.data ?? [];
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: "always"
  });

  const isLoading = isProductLoading || isHistoryLoading;

  // Filter logic
  const filteredHistory = history.filter((m) => {
    const matchesVariant = selectedVariantId === "ALL" || m.productVariant.id === selectedVariantId;
    const matchesType = selectedType === "ALL" || m.type === selectedType;
    return matchesVariant && matchesType;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(getScopedPath("/store/products", "store", isSubdomainMode))}
            className="h-10 w-10 border border-gorola-mint/20 hover:bg-gorola-mint/10 hover:text-gorola-charcoal text-gorola-slate rounded-full flex items-center justify-center transition-all"
            aria-label="Go Back"
            data-testid="history-back-button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gorola-charcoal font-heading flex items-center gap-2">
              <History className="h-6 w-6 text-gorola-pine" />
              Stock History
            </h1>
            <p className="text-xs text-gorola-slate font-dm-sans">
              {isLoading ? "Loading product..." : product?.name || "Product Log"}
            </p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white border border-gorola-mint/15 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-black text-gorola-slate uppercase">
          <Filter className="h-4 w-4 text-gorola-pine" />
          Filters
        </div>

        <div className="w-full md:w-auto flex-1 flex flex-col md:flex-row gap-3">
          {/* Variant Selector */}
          <div className="flex-1">
            <select
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="w-full bg-gorola-mint/5 border border-gorola-mint/15 rounded-xl p-3 text-xs text-gorola-charcoal outline-none focus:border-gorola-pine transition-all"
              data-testid="variant-filter"
            >
              <option value="ALL">All Variants</option>
              {product?.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} ({v.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Movement Type Selector */}
          <div className="flex-1">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-gorola-mint/5 border border-gorola-mint/15 rounded-xl p-3 text-xs text-gorola-charcoal outline-none focus:border-gorola-pine transition-all"
              data-testid="type-filter"
            >
              <option value="ALL">All Movement Types</option>
              <option value="INITIAL">Initial Stock</option>
              <option value="REFILL">Restock (Refill)</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="SALE">Sale (Delivery)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-16 bg-gorola-mint/10 rounded-2xl animate-pulse"
              data-testid="history-row-skeleton"
            />
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-white border border-gorola-mint/15 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="h-16 w-16 bg-gorola-mint/20 text-gorola-pine rounded-full flex items-center justify-center">
            <History className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-gorola-charcoal font-heading">No movements found</h3>
          <p className="text-sm text-gorola-slate max-w-xs font-dm-sans">
            Try adjusting your filters or verify if this product has logged stock operations.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gorola-mint/15 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gorola-mint/10 bg-gorola-mint/5">
                  <th className="p-4 text-xs font-black uppercase text-gorola-slate">Date</th>
                  <th className="p-4 text-xs font-black uppercase text-gorola-slate">Action</th>
                  <th className="p-4 text-xs font-black uppercase text-gorola-slate">Variant</th>
                  <th className="p-4 text-xs font-black uppercase text-gorola-slate text-center">Change</th>
                  <th className="p-4 text-xs font-black uppercase text-gorola-slate text-center">Result Qty</th>
                  <th className="p-4 text-xs font-black uppercase text-gorola-slate">Notes / Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((m) => {
                  const change = m.stockQtyAfter - m.stockQtyBefore;
                  const isPositive = change >= 0;

                  let typeLabel: string = m.type;
                  let typeBg = "bg-slate-100 text-slate-700";
                  if (m.type === "REFILL") {
                    typeLabel = "RESTOCK";
                    typeBg = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
                  } else if (m.type === "ADJUSTMENT") {
                    typeBg = "bg-amber-50 text-amber-700 border border-amber-200/50";
                  } else if (m.type === "SALE") {
                    typeBg = "bg-blue-50 text-blue-700 border border-blue-200/50";
                  } else if (m.type === "INITIAL") {
                    typeBg = "bg-slate-100 text-slate-700 border border-slate-200/50";
                  }

                  return (
                    <tr
                      key={m.id}
                      className="border-b border-gorola-mint/5 hover:bg-gorola-mint/5 transition-all"
                      data-testid={`movement-row-${m.id}`}
                    >
                      <td className="p-4 text-xs text-gorola-slate font-dm-sans">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-gorola-pine/60" />
                          {new Date(m.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short"
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${typeBg}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-bold text-gorola-charcoal font-dm-sans">
                        {m.productVariant.label}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-xs font-black font-dm-sans ${
                            isPositive ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isPositive ? `+${change}` : change}
                        </span>
                      </td>
                      <td className="p-4 text-center text-xs font-bold text-gorola-charcoal font-dm-sans">
                        {m.stockQtyAfter} <span className="text-[10px] text-gorola-slate font-normal">{m.productVariant.unit}</span>
                      </td>
                      <td className="p-4 text-xs text-gorola-slate font-dm-sans max-w-xs truncate">
                        {m.note || m.reason || <span className="text-gorola-slate/40 italic">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
