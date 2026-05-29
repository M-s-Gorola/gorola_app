import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Plus,
  Trash2
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

// Zod Schema
const rawProductFormSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  subCategoryId: z.string().min(1, "Sub-category is required"),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().min(1, "Image path or URL is required"),
  variants: z
    .array(
      z.object({
        id: z.string().optional(), // Present only in edit mode for existing variants
        label: z.string().trim().min(1, "Variant label is required"),
        price: z.coerce.number().positive("Price must be a positive number"),
        stockQty: z.coerce.number().int().nonnegative("Stock quantity must be non-negative").default(0),
        unit: z.string().trim().min(1, "Unit is required"),
        lowStockThreshold: z.coerce.number().int().nonnegative().optional(),
        isActive: z.boolean().optional().default(true),
        isAvailableForBooking: z.boolean().optional().default(true)
      })
    )
    .min(1, "At least one variant is required")
});

const productFormSchema = rawProductFormSchema.refine(
  (data) => {
    const labels = data.variants.map((v) => v.label.trim().toLowerCase());
    return new Set(labels).size === labels.length;
  },
  {
    message: "Variant labels must be unique under the same product",
    path: ["variants"]
  }
);

type ProductFormValues = z.infer<typeof rawProductFormSchema>;

type Category = {
  id: string;
  name: string;
  subCategories: {
    id: string;
    name: string;
  }[];
};

type CategoriesEnvelope = {
  success: boolean;
  data: Category[];
};

type ProductDetailEnvelope = {
  success: boolean;
  data: {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
    subCategoryId: string;
    variants: {
      id: string;
      label: string;
      price: number;
      stockQty: number;
      unit: string;
      lowStockThreshold?: number | null;
      isActive?: boolean;
      isAvailableForBooking?: boolean;
    }[];
  };
};

export function StoreProductFormPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: productId } = useParams<{ id: string }>();
  const isEditMode = !!productId;

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  // 0. Fetch Store Owner Profile
  const { data: profileData } = useQuery({
    queryKey: ["store", "profile"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ data: { storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE" } }>("/api/v1/store/profile");
      return res.data;
    }
  });

  const storeType = profileData?.data?.storeType || "QUICK_COMMERCE";

  // Modal states
  const [restockVariant, setRestockVariant] = useState<{ id: string; label: string; stockQty: number } | null>(null);
  const [adjustVariant, setAdjustVariant] = useState<{ id: string; label: string; stockQty: number } | null>(null);

  // Form states for modals
  const [restockQty, setRestockQty] = useState<string>("10");
  const [restockNote, setRestockNote] = useState<string>("");
  const [adjustQty, setAdjustQty] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjustReasonError, setAdjustReasonError] = useState<string>("");

  // Restock Mutation
  const restockMutation = useMutation({
    mutationFn: async ({ variantId, addQty, note }: { variantId: string; addQty: number; note: string }) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/products/${productId}/variants/${variantId}/stock`, { addQty, note });
    },
    onSuccess: () => {
      toast.success("Inventory restocked successfully");
      setRestockVariant(null);
      setRestockQty("10");
      setRestockNote("");
      queryClient.invalidateQueries({ queryKey: ["store", "products", productId] });
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(ax.response?.data?.error?.message || "Failed to restock variant");
    }
  });

  // Adjust Mutation
  const adjustMutation = useMutation({
    mutationFn: async ({ variantId, setQty, reason }: { variantId: string; setQty: number; reason: string }) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/store/products/${productId}/variants/${variantId}/stock/adjust`, { setQty, reason });
    },
    onSuccess: () => {
      toast.success("Stock quantity adjusted successfully");
      setAdjustVariant(null);
      setAdjustQty("");
      setAdjustReason("");
      setAdjustReasonError("");
      queryClient.invalidateQueries({ queryKey: ["store", "products", productId] });
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(ax.response?.data?.error?.message || "Failed to adjust variant stock");
    }
  });

  // 1. Fetch Categories & Subcategories for Dropdown
  const { data: categoriesData, isLoading: isLoadingCats } = useQuery({
    queryKey: ["store", "categories"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<CategoriesEnvelope>("/api/v1/store/categories");
      return res.data;
    }
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(productFormSchema) as any,
    defaultValues: {
      name: "",
      subCategoryId: "",
      description: "",
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300",
      variants: [{ label: "", price: 0, stockQty: 0, unit: "kg", isActive: true, isAvailableForBooking: true }]
    },
    mode: "onSubmit"
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants"
  });

  const watchVariants = watch("variants");

  // 2. Fetch Product Data (if in Edit Mode)
  const { data: productDetail, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["store", "products", productId],
    queryFn: async () => {
      if (!api || !productId) return null;
      const res = await api.get<ProductDetailEnvelope>(`/api/v1/store/products/${productId}`);
      return res.data;
    },
    enabled: isEditMode
  });

  // Populate form in edit mode
  useEffect(() => {
    if (isEditMode && productDetail?.data) {
      const p = productDetail.data;
      reset({
        name: p.name,
        subCategoryId: p.subCategoryId,
        description: p.description || "",
        imageUrl: p.imageUrl,
        variants: p.variants.map((v) => ({
          id: v.id,
          label: v.label,
          price: v.price,
          stockQty: v.stockQty,
          unit: v.unit,
          lowStockThreshold: v.lowStockThreshold ?? undefined,
          isActive: v.isActive ?? true,
          isAvailableForBooking: v.isAvailableForBooking !== false
        }))
      });
    }
  }, [isEditMode, productDetail, reset]);

  // 3. Submit Handler
  const onSubmit = handleSubmit(async (vals) => {
    if (!api) {
      toast.error("API client not configured.");
      return;
    }

    try {
      if (isEditMode && productId) {
        // Edit Mode:
        // Update product attributes
        await api.put(`/api/v1/store/products/${productId}`, {
          name: vals.name,
          subCategoryId: vals.subCategoryId,
          description: vals.description,
          imageUrl: vals.imageUrl
        });

        // Update pre-existing variants in parallel
        const updateVariantPromises = vals.variants
          .filter((v) => !!v.id) // only update pre-existing variants
          .map((v) => {
            if (!api) throw new Error("API helper not initialized");
            return api.put(`/api/v1/store/products/${productId}/variants/${v.id}`, {
              label: v.label,
              price: v.price,
              stockQty: v.stockQty,
              unit: v.unit,
              lowStockThreshold: (v.lowStockThreshold === undefined || v.lowStockThreshold === null || String(v.lowStockThreshold).trim() === "" || Number(v.lowStockThreshold) === 0) ? undefined : Number(v.lowStockThreshold),
              isActive: v.isActive !== false,
              isAvailableForBooking: v.isAvailableForBooking !== false
            });
          });

        // Create newly added variants in parallel
        const createVariantPromises = vals.variants
          .filter((v) => !v.id) // newly added variants don't have id
          .map((v) => {
            if (!api) throw new Error("API helper not initialized");
            return api.post(`/api/v1/store/products/${productId}/variants`, {
              label: v.label,
              price: v.price,
              stockQty: v.stockQty,
              unit: v.unit,
              lowStockThreshold: (v.lowStockThreshold === undefined || v.lowStockThreshold === null || String(v.lowStockThreshold).trim() === "" || Number(v.lowStockThreshold) === 0) ? undefined : Number(v.lowStockThreshold),
              isAvailableForBooking: v.isAvailableForBooking !== false
            });
          });

        await Promise.all([...updateVariantPromises, ...createVariantPromises]);

        toast.success("Product and variants updated successfully!");
      } else {
        // Create Mode:
        await api.post("/api/v1/store/products", {
          name: vals.name,
          subCategoryId: vals.subCategoryId,
          description: vals.description || "",
          imageUrl: vals.imageUrl,
          variants: vals.variants.map((v) => ({
            label: v.label,
            price: v.price,
            stockQty: v.stockQty,
            unit: v.unit,
            lowStockThreshold: (v.lowStockThreshold === undefined || v.lowStockThreshold === null || String(v.lowStockThreshold).trim() === "" || Number(v.lowStockThreshold) === 0) ? undefined : Number(v.lowStockThreshold),
            isAvailableForBooking: v.isAvailableForBooking !== false
          }))
        });

        toast.success("Product created successfully!");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["store", "dashboard"] })
      ]);
      navigate(getScopedPath("/store/products", "store", isSubdomainMode));
    } catch (err) {
      const ax = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = ax.response?.data?.error?.message || "An error occurred during submission.";
      toast.error(msg);
    }
  });

  const isLoading = isLoadingCats || (isEditMode && isLoadingProduct);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-gorola-charcoal/10 rounded" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white border border-gorola-mint/15 rounded-3xl p-6 space-y-4">
            <div className="h-4 w-28 bg-gorola-charcoal/10 rounded" />
            <div className="h-10 w-full bg-gorola-charcoal/10 rounded-xl" />
            <div className="h-4 w-28 bg-gorola-charcoal/10 rounded" />
            <div className="h-10 w-full bg-gorola-charcoal/10 rounded-xl" />
          </div>
          <div className="bg-white border border-gorola-mint/15 rounded-3xl p-6 space-y-4">
            <div className="h-4 w-28 bg-gorola-charcoal/10 rounded" />
            <div className="h-20 w-full bg-gorola-charcoal/10 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div>
        <button
          onClick={() => navigate(getScopedPath("/store/products", "store", isSubdomainMode))}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gorola-pine hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </button>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">
          {isEditMode ? "Edit Product" : "New Catalog Entry"}
        </h1>
        <p className="text-sm text-gorola-slate font-dm-sans">
          Configure product properties and individual pricing, unit, and stock metrics.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-12">
        {/* Left Side: Product Metadata */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white border border-gorola-mint/15 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/75 mb-2">
              General Information
            </h3>

            {/* Name */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gorola-charcoal" htmlFor="product-name">
                Product Name
              </label>
              <Input
                id="product-name"
                type="text"
                placeholder="Fresh Organic Apples"
                {...register("name")}
                aria-invalid={errors.name ? "true" : undefined}
                className="rounded-xl border-gorola-mint/20 placeholder-gorola-slate/50"
              />
              {errors.name && (
                <p className="text-rose-600 text-xs font-semibold" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Subcategory selection */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gorola-charcoal" htmlFor="product-subcategory">
                Sub-category Selection
              </label>
              <select
                id="product-subcategory"
                {...register("subCategoryId")}
                aria-invalid={errors.subCategoryId ? "true" : undefined}
                className="flex h-10 w-full rounded-xl border border-gorola-mint/20 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select subcategory...</option>
                {categoriesData?.data?.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    {cat.subCategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.subCategoryId && (
                <p className="text-rose-600 text-xs font-semibold" role="alert">
                  {errors.subCategoryId.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gorola-charcoal" htmlFor="product-description">
                Catalog Description
              </label>
              <textarea
                id="product-description"
                placeholder="Provide a detailed description of origin, size, and shelf-life..."
                rows={4}
                {...register("description")}
                className="flex w-full rounded-xl border border-gorola-mint/20 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 placeholder-gorola-slate/50 resize-none"
              />
            </div>

            {/* Image URL */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gorola-charcoal" htmlFor="product-imageUrl">
                Product Image Path / URL
              </label>
              <Input
                id="product-imageUrl"
                type="text"
                placeholder="http://example.com/fresh-apples.png"
                {...register("imageUrl")}
                aria-invalid={errors.imageUrl ? "true" : undefined}
                className="rounded-xl border-gorola-mint/20 placeholder-gorola-slate/50"
              />
              {errors.imageUrl && (
                <p className="text-rose-600 text-xs font-semibold" role="alert">
                  {errors.imageUrl.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Variants List */}
        <div className="md:col-span-7 space-y-6">
          <div className="bg-white border border-gorola-mint/15 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-gorola-slate/75">
                  Product Variants
                </h3>
                <p className="text-[10px] text-gorola-slate mt-0.5 font-dm-sans">
                  Enforces unique labeling (e.g. "Pack of 3", "1kg", "500g").
                </p>
              </div>
              <button
                type="button"
                onClick={() => append({ label: "", price: 0, stockQty: 0, unit: "kg", isActive: true, isAvailableForBooking: true })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gorola-pine/20 hover:bg-gorola-pine/5 text-gorola-pine rounded-xl text-xs font-bold"
                id="add-variant-btn"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Variant
              </button>
            </div>

            {errors.variants?.root && (
              <p className="text-rose-600 text-xs font-bold bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-2" role="alert">
                <AlertTriangle className="h-4 w-4" />
                {errors.variants.root.message}
              </p>
            )}

            {errors.variants && !Array.isArray(errors.variants) && (
              <p className="text-rose-600 text-xs font-bold bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-2" role="alert">
                <AlertTriangle className="h-4 w-4" />
                {errors.variants.message}
              </p>
            )}

            <div className="space-y-4">
              {fields.map((field, index) => {
                const isVariantActive = watchVariants?.[index]?.isActive !== false;
                const hasId = !!(field as Record<string, unknown>).id;

                return (
                  <div
                    key={field.id}
                    data-testid="variant-card"
                    className={`bg-gorola-mint/5 border border-gorola-mint/10 rounded-2xl p-4 space-y-3 relative shadow-inner transition-all duration-200 ${
                      !isVariantActive ? "opacity-60 bg-gray-50 border-gray-200 shadow-none" : ""
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold uppercase text-gorola-pine">
                        Variant #{index + 1}
                      </span>
                      {hasId ? (
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-gorola-slate cursor-pointer select-none flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              id={`variant-active-${index}`}
                              {...register(`variants.${index}.isActive`)}
                              className="h-3.5 w-3.5 rounded border-gorola-mint/30 text-gorola-pine focus:ring-gorola-pine/20 cursor-pointer"
                              aria-label="Active status"
                            />
                            Active status
                          </label>
                        </div>
                      ) : (
                        fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-rose-600 hover:text-rose-800 text-xs font-bold inline-flex items-center gap-1"
                            data-testid={`remove-variant-${index}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        )
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Variant Label */}
                      <div className="flex flex-col gap-1.5">
                        <label
                          className="text-[10px] font-bold text-gorola-charcoal"
                          htmlFor={`variant-label-${index}`}
                        >
                          Unique Label
                        </label>
                        <Input
                          id={`variant-label-${index}`}
                          placeholder="e.g. 500g Pack"
                          {...register(`variants.${index}.label`)}
                          disabled={!isVariantActive}
                          aria-invalid={errors.variants?.[index]?.label ? "true" : undefined}
                          className="rounded-xl border-gorola-mint/15 bg-white h-9 text-xs"
                        />
                        {errors.variants?.[index]?.label && (
                          <p className="text-rose-600 text-[10px] font-semibold" role="alert">
                            {errors.variants[index].label.message}
                          </p>
                        )}
                      </div>

                      {/* Variant Unit */}
                      <div className="flex flex-col gap-1.5">
                        <label
                          className="text-[10px] font-bold text-gorola-charcoal"
                          htmlFor={`variant-unit-${index}`}
                        >
                          Standard Unit
                        </label>
                        <Input
                          id={`variant-unit-${index}`}
                          placeholder="e.g. kg, pieces, pack"
                          {...register(`variants.${index}.unit`)}
                          disabled={!isVariantActive}
                          aria-invalid={errors.variants?.[index]?.unit ? "true" : undefined}
                          className="rounded-xl border-gorola-mint/15 bg-white h-9 text-xs"
                        />
                        {errors.variants?.[index]?.unit && (
                          <p className="text-rose-600 text-[10px] font-semibold" role="alert">
                            {errors.variants[index].unit.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {storeType === "QUICK_COMMERCE" ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        {/* Variant Price */}
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="text-[10px] font-bold text-gorola-charcoal"
                            htmlFor={`variant-price-${index}`}
                          >
                            Price (INR)
                          </label>
                          <Input
                            id={`variant-price-${index}`}
                            type="number"
                            step="0.01"
                            placeholder="49.99"
                            {...register(`variants.${index}.price`)}
                            disabled={!isVariantActive}
                            aria-invalid={errors.variants?.[index]?.price ? "true" : undefined}
                            className="rounded-xl border-gorola-mint/15 bg-white h-9 text-xs"
                          />
                          {errors.variants?.[index]?.price && (
                            <p className="text-rose-600 text-[10px] font-semibold" role="alert">
                              {errors.variants[index].price.message}
                            </p>
                          )}
                        </div>

                        {/* Variant Stock */}
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="text-[10px] font-bold text-gorola-charcoal"
                            htmlFor={`variant-stockQty-${index}`}
                          >
                            Stock Quantity
                          </label>
                          {!watchVariants?.[index]?.id ? (
                            <Input
                              id={`variant-stockQty-${index}`}
                              type="number"
                              placeholder="50"
                              {...register(`variants.${index}.stockQty`)}
                              disabled={!isVariantActive}
                              aria-invalid={errors.variants?.[index]?.stockQty ? "true" : undefined}
                              className="rounded-xl border-gorola-mint/15 bg-white h-9 text-xs"
                            />
                          ) : (
                            <div className="flex flex-col gap-2">
                              <Input
                                id={`variant-stockQty-${index}`}
                                type="number"
                                placeholder="50"
                                {...register(`variants.${index}.stockQty`)}
                                disabled={true}
                                aria-invalid={errors.variants?.[index]?.stockQty ? "true" : undefined}
                                className="rounded-xl border-gorola-mint/15 bg-gray-50 h-9 text-xs w-full"
                              />
                              {isEditMode && (
                                <div className="flex justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const variant = watchVariants?.[index];
                                      if (variant?.id) {
                                        setRestockVariant({
                                          id: variant.id,
                                          label: variant.label || "",
                                          stockQty: variant.stockQty || 0
                                        });
                                      }
                                    }}
                                    className="px-2.5 py-1.5 bg-gorola-pine/10 hover:bg-gorola-pine/20 text-gorola-pine rounded-lg text-[10px] font-bold transition-colors shrink-0"
                                    data-testid={`restock-button-${index}`}
                                  >
                                    Restock
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const variant = watchVariants?.[index];
                                      if (variant?.id) {
                                        setAdjustVariant({
                                          id: variant.id,
                                          label: variant.label || "",
                                          stockQty: variant.stockQty || 0
                                        });
                                      }
                                    }}
                                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-[10px] font-bold transition-colors shrink-0"
                                    data-testid={`adjust-button-${index}`}
                                  >
                                    Adjust
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {errors.variants?.[index]?.stockQty && (
                            <p className="text-rose-600 text-[10px] font-semibold" role="alert">
                              {errors.variants[index].stockQty.message}
                            </p>
                          )}
                        </div>

                        {/* Variant Low Stock Threshold */}
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="text-[10px] font-bold text-gorola-charcoal"
                            htmlFor={`variant-lowStockThreshold-${index}`}
                          >
                            Low Stock Alert
                          </label>
                          <Input
                            id={`variant-lowStockThreshold-${index}`}
                            type="number"
                            placeholder="5"
                            {...register(`variants.${index}.lowStockThreshold`)}
                            disabled={!isVariantActive}
                            className="rounded-xl border-gorola-mint/15 bg-white h-9 text-xs"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* Variant Price */}
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="text-[10px] font-bold text-gorola-charcoal"
                            htmlFor={`variant-price-${index}`}
                          >
                            Price (INR)
                          </label>
                          <Input
                            id={`variant-price-${index}`}
                            type="number"
                            step="0.01"
                            placeholder="49.99"
                            {...register(`variants.${index}.price`)}
                            disabled={!isVariantActive}
                            aria-invalid={errors.variants?.[index]?.price ? "true" : undefined}
                            className="rounded-xl border-gorola-mint/15 bg-white h-9 text-xs"
                          />
                          {errors.variants?.[index]?.price && (
                            <p className="text-rose-600 text-[10px] font-semibold" role="alert">
                              {errors.variants[index].price.message}
                            </p>
                          )}
                        </div>

                        {/* Service Availability Toggle */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-gorola-charcoal">Available for Booking</span>
                          <div className="flex items-center gap-2 h-9">
                            <input
                              type="checkbox"
                              role="switch"
                              aria-label="Available for Booking"
                              {...register(`variants.${index}.isAvailableForBooking`)}
                              disabled={!isVariantActive}
                              className="h-4 w-4 rounded border-gorola-mint/30 text-gorola-pine focus:ring-gorola-pine/20 cursor-pointer"
                              data-testid={`variant-availability-toggle-${index}`}
                            />
                            <span className="text-[10px] text-gorola-slate font-dm-sans">Show service to customers</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Form Actions Footer Panel */}
        <div className="col-span-12 flex justify-end gap-3 pt-6 border-t border-gorola-mint/15">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(getScopedPath("/store/products", "store", isSubdomainMode))}
            className="rounded-xl border border-gorola-mint/15 text-gorola-slate px-5 py-3 h-auto text-xs font-bold uppercase"
          >
            Cancel Changes
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-gorola-pine hover:bg-gorola-pine/90 text-white px-6 py-3 h-auto text-xs font-bold uppercase tracking-wider shadow-md shadow-gorola-pine/15"
            id="save-product-btn"
          >
            {isSubmitting ? "Saving..." : isEditMode ? "Save Changes" : "Create Product"}
          </Button>
        </div>
      </form>

      {/* Restock Modal */}
      {restockVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gorola-mint/20 space-y-4 animate-in fade-in zoom-in duration-200">
            <div>
              <h3 className="text-base font-bold text-gorola-charcoal">Restock Variant</h3>
              <p className="text-xs text-gorola-slate mt-1">
                Add stock to variant <strong className="text-gorola-pine">{restockVariant.label}</strong> (Current: {restockVariant.stockQty})
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gorola-charcoal" htmlFor="restock-qty-input">Quantity to Add</label>
                <Input
                  id="restock-qty-input"
                  type="number"
                  placeholder="10"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="rounded-xl border-gorola-mint/15 bg-white text-xs h-10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gorola-charcoal" htmlFor="restock-note-input">Optional Note</label>
                <Input
                  id="restock-note-input"
                  type="text"
                  placeholder="e.g. Weekly delivery"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  className="rounded-xl border-gorola-mint/15 bg-white text-xs h-10"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRestockVariant(null);
                  setRestockQty("10");
                  setRestockNote("");
                }}
                className="rounded-xl border border-gorola-mint/15 text-gorola-slate px-4 py-2 h-auto text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={restockMutation.isPending || !restockQty || parseInt(restockQty) <= 0}
                onClick={() => {
                  restockMutation.mutate({
                    variantId: restockVariant.id,
                    addQty: parseInt(restockQty),
                    note: restockNote
                  });
                }}
                className="rounded-xl bg-gorola-pine hover:bg-gorola-pine/90 text-white px-4 py-2 h-auto text-xs font-bold"
              >
                {restockMutation.isPending ? "Restocking..." : "Confirm Restock"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gorola-mint/20 space-y-4 animate-in fade-in zoom-in duration-200">
            <div>
              <h3 className="text-base font-bold text-gorola-charcoal">Adjust Stock Level</h3>
              <p className="text-xs text-gorola-slate mt-1">
                Manually override stock for variant <strong className="text-gorola-pine">{adjustVariant.label}</strong> (Current: {adjustVariant.stockQty})
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gorola-charcoal" htmlFor="adjust-qty-input">New Stock Level</label>
                <Input
                  id="adjust-qty-input"
                  type="number"
                  placeholder="Enter exact stock count"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="rounded-xl border-gorola-mint/15 bg-white text-xs h-10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gorola-charcoal" htmlFor="adjust-reason-input">Reason for Adjustment</label>
                <Input
                  id="adjust-reason-input"
                  type="text"
                  placeholder="e.g. Audit correction, damaged goods (Required)"
                  value={adjustReason}
                  onChange={(e) => {
                    setAdjustReason(e.target.value);
                    if (e.target.value.trim().length >= 3) {
                      setAdjustReasonError("");
                    }
                  }}
                  className="rounded-xl border-gorola-mint/15 bg-white text-xs h-10"
                />
                {adjustReasonError && (
                  <p className="text-rose-600 text-[10px] font-semibold" role="alert">
                    {adjustReasonError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAdjustVariant(null);
                  setAdjustQty("");
                  setAdjustReason("");
                  setAdjustReasonError("");
                }}
                className="rounded-xl border border-gorola-mint/15 text-gorola-slate px-4 py-2 h-auto text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={adjustMutation.isPending || !adjustQty || parseInt(adjustQty) < 0}
                onClick={() => {
                  if (adjustReason.trim().length < 3) {
                    setAdjustReasonError("A valid reason (at least 3 characters) is required for audit logs.");
                    return;
                  }
                  adjustMutation.mutate({
                    variantId: adjustVariant.id,
                    setQty: parseInt(adjustQty),
                    reason: adjustReason
                  });
                }}
                className="rounded-xl bg-gorola-pine hover:bg-gorola-pine/90 text-white px-4 py-2 h-auto text-xs font-bold"
              >
                {adjustMutation.isPending ? "Adjusting..." : "Confirm Adjustment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
