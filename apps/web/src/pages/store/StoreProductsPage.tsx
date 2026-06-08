import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Edit2,
  History,
  Plus,
  Search} from "lucide-react";
import type { ReactElement } from "react";
import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { read, utils, write } from "xlsx";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type BulkProductRow = {
  productName: string;
  subCategoryName: string;
  description: string;
  imageUrl: string;
  variants: {
    label: string;
    price: number;
    stockQty: number;
    unit: string;
    lowStockThreshold?: number;
  }[];
};

type BulkProductConflict =
  | { row: number; type: "PRODUCT_NAME_EXISTS"; productName: string }
  | { row: number; type: "SUBCATEGORY_NOT_FOUND"; subCategoryName: string }
  | { row: number; type: "COMMERCE_TYPE_MISMATCH"; subCategoryName: string; commerceType: string }
  | { row: number; type: "DUPLICATE_VARIANT_LABEL"; label: string };

type BulkValidateProductsResponse = {
  valid: boolean;
  conflicts: BulkProductConflict[];
  totalRows: number;
  totalVariantRows: number;
};

type BulkRestockRow = {
  productName: string;
  variantLabel: string;
  newStockQty: number;
};

type BulkRestockConflict =
  | { row: number; type: "PRODUCT_NOT_FOUND"; productName: string }
  | { row: number; type: "AMBIGUOUS_PRODUCT_NAME"; productName: string }
  | { row: number; type: "VARIANT_NOT_FOUND"; productName: string; variantLabel: string };

type BulkValidateRestockResponse = {
  valid: boolean;
  conflicts: BulkRestockConflict[];
  totalRows: number;
};

export function StoreProductsPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showLowStockOnly, setShowLowStockOnly] = useState(searchParams.get("lowStock") === "true");
  const [page, setPage] = useState(1);

  // Bulk operation states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkProductRow[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [validationResult, setValidationResult] = useState<BulkValidateProductsResponse | null>(null);

  // Restock states
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedRestockFile, setSelectedRestockFile] = useState<File | null>(null);
  const [parsedRestockRows, setParsedRestockRows] = useState<BulkRestockRow[]>([]);
  const [isValidatingRestock, setIsValidatingRestock] = useState(false);
  const [isConfirmingRestock, setIsConfirmingRestock] = useState(false);
  const [restockValidationResult, setRestockValidationResult] = useState<BulkValidateRestockResponse | null>(null);

  const handleDownloadSample = () => {
    const ws = utils.json_to_sheet([
      {
        "Product Name": "Amul Butter",
        "Sub-Category Name": "Butter & Spread",
        "Description": "Delicious salted butter",
        "Image URL": "https://example.com/butter.jpg",
        "Variant Label": "100g",
        "Price": 55,
        "Stock Qty": 50,
        "Unit": "packet",
        "Low Stock Threshold": 5
      },
      {
        "Product Name": "Amul Butter",
        "Sub-Category Name": "Butter & Spread",
        "Description": "Delicious salted butter",
        "Image URL": "https://example.com/butter.jpg",
        "Variant Label": "500g",
        "Price": 250,
        "Stock Qty": 30,
        "Unit": "packet",
        "Low Stock Threshold": 5
      }
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Products");
    const out = write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_sample.xlsx";
    a.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          toast.error("Excel sheet is empty");
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          toast.error("Invalid sheet format");
          return;
        }
        const jsonData = utils.sheet_to_json<Record<string, string>>(worksheet);

        const productMap = new Map<string, {
          productName: string;
          subCategoryName: string;
          description: string;
          imageUrl: string;
          variants: {
            label: string;
            price: number;
            stockQty: number;
            unit: string;
            lowStockThreshold?: number;
          }[];
        }>();

        for (const row of jsonData) {
          const pNameVal = row["Product Name"];
          const pName = pNameVal ? String(pNameVal).trim() : "";
          if (!pName) continue;

          const subCatVal = row["Sub-Category Name"];
          const subCat = subCatVal ? String(subCatVal).trim() : "";

          const descVal = row["Description"];
          const desc = descVal ? String(descVal).trim() : "";

          const imgVal = row["Image URL"];
          const img = imgVal ? String(imgVal).trim() : "";

          const varLabelVal = row["Variant Label"];
          const varLabel = varLabelVal ? String(varLabelVal).trim() : "";

          const priceVal = row["Price"];
          const price = priceVal ? parseFloat(String(priceVal).trim()) : 0;

          const stockVal = row["Stock Qty"];
          const stock = stockVal ? parseInt(String(stockVal).trim(), 10) : 0;

          const unitVal = row["Unit"];
          const unit = unitVal ? String(unitVal).trim() : "";

          const thresholdVal = row["Low Stock Threshold"];
          const threshold = (thresholdVal !== undefined && thresholdVal !== null && String(thresholdVal).trim() !== "")
            ? parseInt(String(thresholdVal).trim(), 10)
            : undefined;

          if (!productMap.has(pName)) {
            productMap.set(pName, {
              productName: pName,
              subCategoryName: subCat,
              description: desc,
              imageUrl: img,
              variants: []
            });
          }

          const productObj = productMap.get(pName)!;
          if (varLabel) {
            productObj.variants.push({
              label: varLabel,
              price,
              stockQty: stock,
              unit,
              ...(threshold !== undefined ? { lowStockThreshold: threshold } : {})
            });
          }
        }

        setParsedRows(Array.from(productMap.values()));
      } catch {
        toast.error("Failed to parse Excel file");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleValidate = async () => {
    if (!api) return;
    setIsValidating(true);
    try {
      const res = await api.post<{ success: boolean; data: BulkValidateProductsResponse }>("/api/v1/store/bulk/products/validate", {
        rows: parsedRows
      });
      setValidationResult(res.data.data);
    } catch (err: unknown) {
      let errMsg = "Validation failed";
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      errMsg = errorResponse?.response?.data?.error?.message || errMsg;
      toast.error(errMsg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirm = async (mode: "strict" | "skip") => {
    if (!api) return;
    setIsConfirming(true);
    try {
      const res = await api.post<{ success: boolean; data: { inserted: number; skipped: number } }>(
        `/api/v1/store/bulk/products/confirm?mode=${mode}`,
        { rows: parsedRows }
      );
      const info = res.data.data;
      toast.success(`Import complete: ${info.inserted} products added, ${info.skipped} skipped`);
      setIsBulkModalOpen(false);
      setSelectedFile(null);
      setParsedRows([]);
      setValidationResult(null);
      await queryClient.invalidateQueries({ queryKey: ["store", "products"] });
      await queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] });
    } catch (err: unknown) {
      let errMsg = "Import failed";
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      errMsg = errorResponse?.response?.data?.error?.message || errMsg;
      toast.error(errMsg);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDownloadRestockSample = () => {
    const ws = utils.json_to_sheet([
      {
        "Product Name": "Amul Butter",
        "Variant Label": "100g",
        "New Stock Qty": 150
      },
      {
        "Product Name": "Amul Butter",
        "Variant Label": "500g",
        "New Stock Qty": 90
      }
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Restock");
    const out = write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "restock_sample.xlsx";
    a.click();
  };

  const handleRestockFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedRestockFile(file);
    setRestockValidationResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          toast.error("Excel sheet is empty");
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          toast.error("Invalid sheet format");
          return;
        }
        const jsonData = utils.sheet_to_json<Record<string, string>>(worksheet);

        const rowsList: BulkRestockRow[] = [];

        for (const row of jsonData) {
          const pNameVal = row["Product Name"];
          const pName = pNameVal ? String(pNameVal).trim() : "";
          if (!pName) continue;

          const varLabelVal = row["Variant Label"];
          const varLabel = varLabelVal ? String(varLabelVal).trim() : "";

          const qtyVal = row["New Stock Qty"];
          const qty = qtyVal ? parseInt(String(qtyVal).trim(), 10) : 0;

          rowsList.push({
            productName: pName,
            variantLabel: varLabel,
            newStockQty: qty
          });
        }

        setParsedRestockRows(rowsList);
      } catch {
        toast.error("Failed to parse Excel file");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleValidateRestock = async () => {
    if (!api) return;
    setIsValidatingRestock(true);
    try {
      const res = await api.post<{ success: boolean; data: BulkValidateRestockResponse }>("/api/v1/store/bulk/restock/validate", {
        rows: parsedRestockRows
      });
      setRestockValidationResult(res.data.data);
    } catch (err: unknown) {
      let errMsg = "Validation failed";
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      errMsg = errorResponse?.response?.data?.error?.message || errMsg;
      toast.error(errMsg);
    } finally {
      setIsValidatingRestock(false);
    }
  };

  const handleConfirmRestock = async (mode: "strict" | "skip") => {
    if (!api) return;
    setIsConfirmingRestock(true);
    try {
      const res = await api.post<{ success: boolean; data: { updated: number; skipped: number } }>(
        `/api/v1/store/bulk/restock/confirm?mode=${mode}`,
        { rows: parsedRestockRows }
      );
      const info = res.data.data;
      toast.success(`Restock complete: ${info.updated} variants updated, ${info.skipped} skipped`);
      setIsRestockModalOpen(false);
      setSelectedRestockFile(null);
      setParsedRestockRows([]);
      setRestockValidationResult(null);
      await queryClient.invalidateQueries({ queryKey: ["store", "products"] });
      await queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] });
    } catch (err: unknown) {
      let errMsg = "Restock failed";
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      errMsg = errorResponse?.response?.data?.error?.message || errMsg;
      toast.error(errMsg);
    } finally {
      setIsConfirmingRestock(false);
    }
  };

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
  const isBooking = storeType === "BOOKING_COMMERCE";
  const term = isBooking ? "Service" : "Product";
  const termPlural = isBooking ? "Services" : "Products";

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
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Store {termPlural}</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Manage your store catalog, track variants, {isBooking ? "" : "stock status "}and pricing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            data-testid="bulk-import-products-btn"
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 text-gorola-pine hover:bg-gorola-fog rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all font-dm-sans"
          >
            Bulk Import
          </Button>

          {!isBooking && (
            <Button
              data-testid="bulk-restock-products-btn"
              onClick={() => setIsRestockModalOpen(true)}
              className="px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 text-gorola-pine hover:bg-gorola-fog rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all font-dm-sans"
            >
              Bulk Restock
            </Button>
          )}

          <button
            onClick={() => navigate(getScopedPath("/store/products/new", "store", isSubdomainMode))}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-3 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-md shadow-gorola-pine/15 transition-all font-dm-sans"
            id="add-product-btn"
          >
            <Plus className="h-4 w-4" />
            Add {term}
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row bg-white border border-gorola-mint/15 rounded-2xl p-3 shadow-sm items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 px-1">
          <Search className="h-5 w-5 text-gorola-slate shrink-0" />
          <input
            type="text"
            placeholder={`Search by ${term.toLowerCase()} name or keywords...`}
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
        {!isBooking && (
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
        )}
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
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">{term} Info</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">Sub-category</th>
                  <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">Variants</th>
                  {storeType === "QUICK_COMMERCE" && (
                    <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-left">Stock Status</th>
                  )}
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
                      {storeType === "QUICK_COMMERCE" && (
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
                      )}
                      {storeType === "QUICK_COMMERCE" && (
                        <td className="p-4 text-left">
                          <button
                            onClick={() => navigate(getScopedPath(`/store/products/${product.id}/stock-history`, "store", isSubdomainMode))}
                            className="p-2 border border-gorola-mint/20 hover:border-gorola-pine/35 hover:bg-gorola-mint/10 rounded-lg text-gorola-slate hover:text-gorola-pine transition-all"
                            title="Stock History"
                            data-testid={`stock-history-${product.id}`}
                          >
                            <History className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            onClick={() => navigate(getScopedPath(`/store/products/${product.id}/edit`, "store", isSubdomainMode))}
                            className="p-2 border border-gorola-mint/20 hover:border-gorola-pine/35 hover:bg-gorola-mint/10 rounded-lg text-gorola-slate hover:text-gorola-pine transition-all"
                            title={`Edit ${term}`}
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
          <h3 className="text-lg font-bold text-gorola-charcoal font-heading">No {termPlural.toLowerCase()} registered</h3>
          <p className="text-sm text-gorola-slate max-w-xs font-dm-sans">
            Start expanding your catalog by registering your first {term.toLowerCase()} variants today.
          </p>
          <button
            onClick={() => navigate(getScopedPath("/store/products/new", "store", isSubdomainMode))}
            className="px-4 py-2.5 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
          >
            Create {term}
          </button>
        </div>
      )}

      {/* Bulk Product Import Modal */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent data-testid="bulk-import-products-modal" className="sm:max-w-2xl gap-6 max-h-[85vh] overflow-y-auto w-full">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Import {termPlural}</DialogTitle>
            <DialogDescription>
              Upload a spreadsheet to bulk import {termPlural.toLowerCase()} and their variants.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gorola-fog p-4 rounded-xl border border-gorola-charcoal/5">
              <span className="text-xs text-gorola-slate font-dm-sans">
                Need a template? Download the sample structure.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSample}
                className="text-xs font-bold font-dm-sans border-gorola-mint/30"
              >
                Download Sample
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="font-dm-sans text-sm font-semibold text-gorola-charcoal block">
                Select Excel File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                data-testid="bulk-products-file-input"
                onChange={handleFileChange}
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
              />
              {selectedFile && parsedRows.length > 0 && (
                <p className="text-xs text-emerald-600 font-bold font-dm-sans">
                  Parsed {parsedRows.length} {termPlural.toLowerCase()} from file.
                </p>
              )}
            </div>

            {/* Validation State Display */}
            {validationResult && (
              <div className="space-y-4">
                {validationResult.valid ? (
                  <div
                    data-testid="bulk-validation-success"
                    className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-dm-sans flex items-center gap-2"
                  >
                    <span>✓</span> All rows are valid! You can safely import them.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm font-dm-sans">
                      ⚠️ Validation failed: {validationResult.conflicts.length} conflict(s) found.
                    </div>

                    <div className="border border-gorola-charcoal/10 rounded-xl overflow-x-auto shadow-sm w-full">
                      <table data-testid="bulk-conflict-table" className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15">
                            <th className="p-3 font-bold text-gorola-charcoal">Row</th>
                            <th className="p-3 font-bold text-gorola-charcoal">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationResult.conflicts.map((conflict, index) => (
                            <tr key={index} className="border-b border-gorola-mint/10 last:border-0">
                              <td className="p-3 font-mono font-bold text-gorola-slate">Row {conflict.row}</td>
                              <td className="p-3 text-red-600 font-bold font-dm-sans break-words whitespace-normal">
                                {conflict.type === "PRODUCT_NAME_EXISTS" && `Product '${conflict.productName}' already exists in your store.`}
                                {conflict.type === "SUBCATEGORY_NOT_FOUND" && `Sub-category '${conflict.subCategoryName}' was not found in the system.`}
                                {conflict.type === "COMMERCE_TYPE_MISMATCH" && `Sub-category '${conflict.subCategoryName}' is for ${conflict.commerceType === "BOOKING_COMMERCE" ? "Booking" : "Quick"} Commerce and cannot be added to this store.`}
                                {conflict.type === "DUPLICATE_VARIANT_LABEL" && `Duplicate variant label '${conflict.label}' found in row ${conflict.row}.`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="sm:flex-wrap sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setSelectedFile(null);
                  setParsedRows([]);
                  setValidationResult(null);
                }}
                disabled={isValidating || isConfirming}
              >
                Cancel
              </Button>

              {/* Validate action */}
              {(!validationResult || !validationResult.valid) && (
                <Button
                  type="button"
                  onClick={handleValidate}
                  disabled={!selectedFile || parsedRows.length === 0 || isValidating || isConfirming}
                  className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                >
                  {isValidating ? "Validating..." : "Validate"}
                </Button>
              )}

              {/* Conflict choices */}
              {validationResult && !validationResult.valid && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsBulkModalOpen(false);
                      setSelectedFile(null);
                      setParsedRows([]);
                      setValidationResult(null);
                    }}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Fix my file
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleConfirm("skip")}
                    disabled={isConfirming}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {isConfirming ? "Importing..." : "Skip conflicts & continue"}
                  </Button>
                </>
              )}

              {/* Pure success confirm */}
              {validationResult && validationResult.valid && (
                <Button
                  type="button"
                  onClick={() => handleConfirm("strict")}
                  disabled={isConfirming}
                  className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                >
                  {isConfirming ? "Importing..." : "Confirm & Import"}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Restock Modal */}
      {!isBooking && (
        <Dialog open={isRestockModalOpen} onOpenChange={setIsRestockModalOpen}>
          <DialogContent data-testid="bulk-restock-products-modal" className="sm:max-w-2xl gap-6 max-h-[85vh] overflow-y-auto w-full">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">Bulk Restock</DialogTitle>
              <DialogDescription>
                Upload a spreadsheet to update variant stock quantities.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gorola-fog p-4 rounded-xl border border-gorola-charcoal/5">
                <span className="text-xs text-gorola-slate font-dm-sans">
                  Need a template? Download the sample restock structure.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadRestockSample}
                  className="text-xs font-bold font-dm-sans border-gorola-mint/30"
                >
                  Download Sample
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="font-dm-sans text-sm font-semibold text-gorola-charcoal block">
                  Select Excel File
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  data-testid="bulk-restock-file-input"
                  onChange={handleRestockFileChange}
                  className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                />
                {selectedRestockFile && parsedRestockRows.length > 0 && (
                  <p className="text-xs text-emerald-600 font-bold font-dm-sans">
                    Parsed {parsedRestockRows.length} restock rows from file.
                  </p>
                )}
              </div>

              {/* Validation State Display */}
              {restockValidationResult && (
                <div className="space-y-4">
                  {restockValidationResult.valid ? (
                    <div
                      data-testid="bulk-restock-validation-success"
                      className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-dm-sans flex items-center gap-2"
                    >
                      <span>✓</span> All rows are valid! You can safely update them.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm font-dm-sans">
                        ⚠️ Validation failed: {restockValidationResult.conflicts.length} conflict(s) found.
                      </div>

                      <div className="border border-gorola-charcoal/10 rounded-xl overflow-x-auto shadow-sm w-full">
                        <table data-testid="bulk-restock-conflict-table" className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15">
                              <th className="p-3 font-bold text-gorola-charcoal">Row</th>
                              <th className="p-3 font-bold text-gorola-charcoal">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {restockValidationResult.conflicts.map((conflict, index) => (
                              <tr key={index} className="border-b border-gorola-mint/10 last:border-0">
                                <td className="p-3 font-mono font-bold text-gorola-slate">Row {conflict.row}</td>
                                <td className="p-3 text-red-600 font-bold font-dm-sans break-words whitespace-normal">
                                  {conflict.type === "PRODUCT_NOT_FOUND" && `Product '${conflict.productName}' was not found in your store.`}
                                  {conflict.type === "AMBIGUOUS_PRODUCT_NAME" && `Multiple products share the name '${conflict.productName}'. Match is ambiguous.`}
                                  {conflict.type === "VARIANT_NOT_FOUND" && `Variant '${conflict.variantLabel}' was not found under product '${conflict.productName}'.`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="sm:flex-wrap sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsRestockModalOpen(false);
                    setSelectedRestockFile(null);
                    setParsedRestockRows([]);
                    setRestockValidationResult(null);
                  }}
                  disabled={isValidatingRestock || isConfirmingRestock}
                >
                  Cancel
                </Button>

                {/* Validate action */}
                {(!restockValidationResult || !restockValidationResult.valid) && (
                  <Button
                    type="button"
                    onClick={handleValidateRestock}
                    disabled={!selectedRestockFile || parsedRestockRows.length === 0 || isValidatingRestock || isConfirmingRestock}
                    className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                  >
                    {isValidatingRestock ? "Validating..." : "Validate"}
                  </Button>
                )}

                {/* Conflict choices */}
                {restockValidationResult && !restockValidationResult.valid && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsRestockModalOpen(false);
                        setSelectedRestockFile(null);
                        setParsedRestockRows([]);
                        setRestockValidationResult(null);
                      }}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Fix my file
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleConfirmRestock("skip")}
                      disabled={isConfirmingRestock}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {isConfirmingRestock ? "Updating..." : "Skip conflicts & continue"}
                    </Button>
                  </>
                )}

                {/* Pure success confirm */}
                {restockValidationResult && restockValidationResult.valid && (
                  <Button
                    type="button"
                    onClick={() => handleConfirmRestock("strict")}
                    disabled={isConfirmingRestock}
                    className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                  >
                    {isConfirmingRestock ? "Updating..." : "Confirm & Restock"}
                  </Button>
                )}
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
