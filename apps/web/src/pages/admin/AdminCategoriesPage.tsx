import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit2,
  FolderPlus,
  GripVertical,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

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

type SubCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  categoryId: string;
  productCount: number;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  commerceType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
  productCount: number;
  subCategories: SubCategory[];
};

type CategoriesListResponse = {
  success: boolean;
  data: Category[];
};

export function AdminCategoriesPage(): ReactElement {
  const queryClient = useQueryClient();

  // Active commerceType tab
  const [activeTab, setActiveTab] = useState<"QUICK_COMMERCE" | "BOOKING_COMMERCE">("QUICK_COMMERCE");

  // Local state for categories (supports native drag & drop reordering)
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});

  // Modals & Dialog state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [subCategoryParentSlug, setSubCategoryParentSlug] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] = useState<"category" | "subcategory">("category");

  // Form states
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catImageUrl, setCatImageUrl] = useState("");
  const [catCommerceType, setCatCommerceType] = useState<"QUICK_COMMERCE" | "BOOKING_COMMERCE">("QUICK_COMMERCE");
  const [catIsActive, setCatIsActive] = useState(true);

  const [subName, setSubName] = useState("");
  const [subSlug, setSubSlug] = useState("");
  const [subImageUrl, setSubImageUrl] = useState("");
  const [subIsActive, setSubIsActive] = useState(true);

  const [formError, setFormError] = useState<string | null>(null);

  // Dragging states
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [draggingSubCategoryId, setDraggingSubCategoryId] = useState<string | null>(null);

  // Fetch categories query
  const { data: categoriesData, isLoading, isError, isFetching, refetch } = useQuery<Category[]>({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<CategoriesListResponse>("/api/v1/admin/categories");
      return res.data.data;
    },
    staleTime: 10000,
  });

  // Sync query data to local state
  useEffect(() => {
    if (categoriesData) {
      setLocalCategories(categoriesData);
    }
  }, [categoriesData]);

  // Generate slug helpers
  const handleCatNameChange = (val: string) => {
    setCatName(val);
    if (!editingCategory) {
      setCatSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
    }
  };

  const handleSubNameChange = (val: string) => {
    setSubName(val);
    if (!editingSubCategory) {
      setSubSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
    }
  };

  // MUTATIONS
  // Create Category
  const createCategoryMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.post("/api/v1/admin/categories", body);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Category created successfully");
      setIsCategoryModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to create category";
      setFormError(msg);
      toast.error(msg);
    },
  });

  // Update Category
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put(`/api/v1/admin/categories/${id}`, body);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Category updated successfully");
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update category";
      setFormError(msg);
      toast.error(msg);
    },
  });

  // Reorder Categories
  const reorderCategoriesMutation = useMutation({
    mutationFn: async (payload: { id: string; displayOrder: number }[]) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put("/api/v1/admin/categories/reorder", payload);
    },
    onSuccess: () => {
      toast.success("Categories order updated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to reorder categories";
      toast.error(msg);
      if (categoriesData) setLocalCategories(categoriesData); // revert
    },
  });

  // Delete Category
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.delete(`/api/v1/admin/categories/${id}`);
    },
    onSuccess: async () => {
      toast.success("Category deleted successfully");
      setDeleteConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to delete category";
      toast.error(msg);
      setDeleteConfirmId(null);
    },
  });

  // Create Subcategory
  const createSubCategoryMutation = useMutation({
    mutationFn: async ({ categorySlug, body }: { categorySlug: string; body: Record<string, unknown> }) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.post(`/api/v1/admin/categories/${categorySlug}/sub-categories`, body);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Subcategory created successfully");
      setIsSubCategoryModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to create subcategory";
      setFormError(msg);
      toast.error(msg);
    },
  });

  // Update Subcategory
  const updateSubCategoryMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put(`/api/v1/admin/sub-categories/${id}`, body);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Subcategory updated successfully");
      setIsSubCategoryModalOpen(false);
      setEditingSubCategory(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update subcategory";
      setFormError(msg);
      toast.error(msg);
    },
  });

  // Reorder Subcategories
  const reorderSubCategoriesMutation = useMutation({
    mutationFn: async (payload: { id: string; displayOrder: number }[]) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put("/api/v1/admin/sub-categories/reorder", payload);
    },
    onSuccess: () => {
      toast.success("Subcategories order updated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to reorder subcategories";
      toast.error(msg);
      if (categoriesData) setLocalCategories(categoriesData); // revert
    },
  });

  // Delete Subcategory (API is not present directly as admin endpoint, wait!
  // Let's verify if there is a delete subcategory endpoint. In registerAdminRoutes:
  // Wait, there's create subcategory and update subcategory, but NO delete subcategory? Let's check!
  // Yes! The endpoints we registered were:
  // - GET /api/v1/admin/categories
  // - POST /api/v1/admin/categories
  // - PUT /api/v1/admin/categories/:id
  // - DELETE /api/v1/admin/categories/:id
  // - PUT /api/v1/admin/categories/reorder
  // - POST /api/v1/admin/categories/:slug/sub-categories
  // - PUT /api/v1/admin/sub-categories/:id
  // - PUT /api/v1/admin/sub-categories/reorder
  // Wait! There is no DELETE /api/v1/admin/sub-categories/:id in admin.controller.ts!
  // To soft-delete / disable a subcategory, we toggle its active status: `isActive = false` using PUT /api/v1/admin/sub-categories/:id.
  // Let's explain this to the user or design the UI to toggle status instead of delete, or use update status.
  // Wait, let's keep the Delete button for categories since we have the DELETE endpoint.
  // For subcategories, since there's no delete route, we can let users toggle its `isActive` status or we can delete it if we define a DELETE endpoint, but let's stick to the endpoints that are defined in admin.controller.ts to prevent 404 errors!
  // So we only toggle subcategory `isActive` to disable/hide it, which is fully supported by PUT /api/v1/admin/sub-categories/:id.

  // Toggle Category Status (Active/Inactive)
  const handleToggleCategoryStatus = (category: Category) => {
    updateCategoryMutation.mutate({
      id: category.id,
      body: { isActive: !category.isActive },
    });
  };

  // Toggle Subcategory Status
  const handleToggleSubCategoryStatus = (subCategory: SubCategory) => {
    updateSubCategoryMutation.mutate({
      id: subCategory.id,
      body: { isActive: !subCategory.isActive },
    });
  };

  // Modal Open Handlers
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatName("");
    setCatSlug("");
    setCatImageUrl("");
    setCatCommerceType(activeTab);
    setCatIsActive(true);
    setFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCatName(category.name);
    setCatSlug(category.slug);
    setCatImageUrl(category.imageUrl || "");
    setCatCommerceType(category.commerceType);
    setCatIsActive(category.isActive);
    setFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenAddSubCategory = (category: Category) => {
    setEditingSubCategory(null);
    setSubCategoryParentSlug(category.slug);
    setSubName("");
    setSubSlug("");
    setSubImageUrl("");
    setSubIsActive(true);
    setFormError(null);
    setIsSubCategoryModalOpen(true);
  };

  const handleOpenEditSubCategory = (subCategory: SubCategory) => {
    setEditingSubCategory(subCategory);
    setSubCategoryParentSlug(null);
    setSubName(subCategory.name);
    setSubSlug(subCategory.slug);
    setSubImageUrl(subCategory.imageUrl || "");
    setSubIsActive(subCategory.isActive);
    setFormError(null);
    setIsSubCategoryModalOpen(true);
  };

  // Submits
  const handleCategorySubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!catName.trim()) {
      setFormError("Category name is required");
      return;
    }
    if (!catSlug.trim()) {
      setFormError("Category slug is required");
      return;
    }

    const body = {
      name: catName.trim(),
      slug: catSlug.trim(),
      imageUrl: catImageUrl.trim() || null,
      isActive: catIsActive,
      commerceType: catCommerceType,
    };

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, body });
    } else {
      createCategoryMutation.mutate(body);
    }
  };

  const handleSubCategorySubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!subName.trim()) {
      setFormError("Subcategory name is required");
      return;
    }
    if (!subSlug.trim()) {
      setFormError("Subcategory slug is required");
      return;
    }

    const body = {
      name: subName.trim(),
      slug: subSlug.trim(),
      imageUrl: subImageUrl.trim() || null,
      isActive: subIsActive,
    };

    if (editingSubCategory) {
      updateSubCategoryMutation.mutate({ id: editingSubCategory.id, body });
    } else if (subCategoryParentSlug) {
      createSubCategoryMutation.mutate({ categorySlug: subCategoryParentSlug, body });
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirmId) return;
    if (deleteConfirmType === "category") {
      deleteCategoryMutation.mutate(deleteConfirmId);
    }
  };

  // NATIVE DRAG & DROP FOR CATEGORIES
  const handleCategoryDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggingCategoryId(categoryId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCategoryDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    if (!draggingCategoryId || draggingCategoryId === categoryId) return;

    const currentLocal = [...localCategories];
    const dragIndex = currentLocal.findIndex((c) => c.id === draggingCategoryId);
    const hoverIndex = currentLocal.findIndex((c) => c.id === categoryId);

    if (dragIndex === -1 || hoverIndex === -1) return;

    // Swap items locally
    const draggedItem = currentLocal.splice(dragIndex, 1)[0];
    if (draggedItem) {
      currentLocal.splice(hoverIndex, 0, draggedItem);
    }

    // Filter display order logic (only swap order for matching tab commerceTypes)
    setLocalCategories(currentLocal);
  };

  const handleCategoryDragEnd = () => {
    setDraggingCategoryId(null);

    // Recalculate displayOrders based on current localCategories list
    const updatedOrders = localCategories
      .filter((c) => c.commerceType === activeTab)
      .map((c, index) => ({
        id: c.id,
        displayOrder: index,
      }));

    reorderCategoriesMutation.mutate(updatedOrders);
  };

  // NATIVE DRAG & DROP FOR SUBCATEGORIES WITHIN A CATEGORY
  const handleSubCategoryDragStart = (e: React.DragEvent, subCategoryId: string) => {
    setDraggingSubCategoryId(subCategoryId);
    e.dataTransfer.effectAllowed = "move";
    e.stopPropagation();
  };

  const handleSubCategoryDragOver = (e: React.DragEvent, categoryId: string, subCategoryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingSubCategoryId || draggingSubCategoryId === subCategoryId) return;

    const currentLocal = [...localCategories];
    const categoryIndex = currentLocal.findIndex((c) => c.id === categoryId);
    if (categoryIndex === -1) return;

    const category = currentLocal[categoryIndex];
    if (!category) return;

    const subList = [...category.subCategories];
    const dragIndex = subList.findIndex((sc) => sc.id === draggingSubCategoryId);
    const hoverIndex = subList.findIndex((sc) => sc.id === subCategoryId);

    if (dragIndex === -1 || hoverIndex === -1) return;

    // Swap locally
    const draggedItem = subList.splice(dragIndex, 1)[0];
    if (draggedItem) {
      subList.splice(hoverIndex, 0, draggedItem);
    }

    category.subCategories = subList;
    setLocalCategories(currentLocal);
  };

  const handleSubCategoryDragEnd = (categoryId: string) => {
    setDraggingSubCategoryId(null);

    const category = localCategories.find((c) => c.id === categoryId);
    if (!category) return;

    const updatedOrders = category.subCategories.map((sc, index) => ({
      id: sc.id,
      displayOrder: index,
    }));

    reorderSubCategoriesMutation.mutate(updatedOrders);
  };

  const toggleExpandCategory = (id: string) => {
    setExpandedCategoryIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (isLoading && !categoriesData) {
    return (
      <div data-testid="categories-loading-skeleton" className="space-y-6 animate-pulse">
        <div className="h-10 bg-gorola-charcoal/10 rounded-xl w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-20 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
          <div className="h-20 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
          <div className="h-20 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
        </div>
        <div className="h-96 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load platform categories</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
          Try Again
        </button>
      </div>
    );
  }

  const allCategories = localCategories || [];
  const filteredCategories = allCategories.filter((c) => c.commerceType === activeTab);

  // Compute metrics
  const quickCount = allCategories.filter((c) => c.commerceType === "QUICK_COMMERCE").length;
  const bookingCount = allCategories.filter((c) => c.commerceType === "BOOKING_COMMERCE").length;
  const totalActive = allCategories.filter((c) => c.isActive).length;
  const totalInactive = allCategories.length - totalActive;

  const confirmDeleteCategory = allCategories.find((c) => c.id === deleteConfirmId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Category Management</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Add, reorder, edit, and configure commerce types for categories and subcategories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 font-dm-sans"
          >
            <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
            Sync Lists
          </button>

          <Button
            data-testid="add-category-button"
            onClick={handleOpenAddCategory}
            className="px-4 py-2.5 bg-gorola-pine hover:bg-gorola-pine-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all font-dm-sans"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </header>

      {/* Metrics Banner */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gorola-charcoal/5 shadow-sm space-y-1">
          <h3 className="text-xs text-gorola-slate font-dm-sans font-bold uppercase tracking-wider">Quick Commerce</h3>
          <p className="text-2xl font-black text-gorola-charcoal">{quickCount} <span className="text-xs font-normal text-gorola-slate">Categories</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gorola-charcoal/5 shadow-sm space-y-1">
          <h3 className="text-xs text-gorola-slate font-dm-sans font-bold uppercase tracking-wider">Booking Commerce</h3>
          <p className="text-2xl font-black text-gorola-charcoal">{bookingCount} <span className="text-xs font-normal text-gorola-slate">Categories</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gorola-charcoal/5 shadow-sm space-y-1">
          <h3 className="text-xs text-gorola-slate font-dm-sans font-bold uppercase tracking-wider">Category Statuses</h3>
          <p className="text-2xl font-black text-gorola-charcoal">
            {totalActive} <span className="text-xs font-semibold text-emerald-600">Active</span>
            <span className="text-sm font-normal text-gorola-charcoal/40 mx-2">|</span>
            {totalInactive} <span className="text-xs font-semibold text-rose-600">Inactive</span>
          </p>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gorola-charcoal/10 font-dm-sans text-sm">
        <button
          onClick={() => setActiveTab("QUICK_COMMERCE")}
          className={`px-5 py-3 font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === "QUICK_COMMERCE"
              ? "border-gorola-pine text-gorola-pine"
              : "border-transparent text-gorola-slate hover:text-gorola-charcoal"
          }`}
        >
          Quick Commerce
        </button>
        <button
          onClick={() => setActiveTab("BOOKING_COMMERCE")}
          className={`px-5 py-3 font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === "BOOKING_COMMERCE"
              ? "border-gorola-pine text-gorola-pine"
              : "border-transparent text-gorola-slate hover:text-gorola-charcoal"
          }`}
        >
          Booking Commerce
        </button>
      </div>

      {/* Categories List Container */}
      <div className="space-y-4">
        {filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gorola-charcoal/5 p-12 text-center text-gorola-slate font-dm-sans">
            No categories found for this commerce type. Click "Add Category" to provision one.
          </div>
        ) : (
          filteredCategories.map((category) => {
            const isExpanded = !!expandedCategoryIds[category.id];
            return (
              <div
                key={category.id}
                onDragOver={(e) => handleCategoryDragOver(e, category.id)}
                className={`bg-white rounded-2xl border border-gorola-charcoal/10 shadow-sm transition-all overflow-hidden ${
                  !category.isActive ? "opacity-60 bg-gray-50/50" : ""
                } ${draggingCategoryId === category.id ? "opacity-20 border-dashed border-gorola-pine" : ""}`}
              >
                {/* Category Main Row */}
                <div className="flex items-center justify-between p-4 md:p-5 gap-4">
                  <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    <div
                      draggable
                      onDragStart={(e) => handleCategoryDragStart(e, category.id)}
                      onDragEnd={handleCategoryDragEnd}
                      className="cursor-grab text-gorola-slate/50 hover:text-gorola-charcoal transition-colors p-1"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-5 w-5" />
                    </div>

                    {/* Image / Icon Preview */}
                    <div className="h-12 w-12 rounded-xl bg-gorola-fog border border-gorola-charcoal/5 flex items-center justify-center overflow-hidden shrink-0">
                      {category.imageUrl ? (
                        <img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-gorola-slate/40" />
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gorola-charcoal text-base">{category.name}</h3>
                        <span className="text-[10px] bg-gorola-fog border border-gorola-charcoal/5 text-gorola-charcoal font-mono px-1.5 py-0.5 rounded-md">
                          /{category.slug}
                        </span>
                      </div>
                      <p className="text-xs text-gorola-slate font-dm-sans">
                        Display Order: {category.displayOrder} | Active Products: <span className="font-bold">{category.productCount}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleCategoryStatus(category)}
                      className={`px-3 py-1.5 border rounded-xl text-xs font-bold font-dm-sans transition-all shadow-sm ${
                        category.isActive
                          ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                          : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {category.isActive ? "Disable" : "Enable"}
                    </button>

                    <button
                      onClick={() => handleOpenEditCategory(category)}
                      className="p-2 border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-gorola-pine hover:bg-gorola-fog transition-all"
                      title="Edit Category"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => {
                        setDeleteConfirmType("category");
                        setDeleteConfirmId(category.id);
                      }}
                      className="p-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="Delete Category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => toggleExpandCategory(category.id)}
                      className="flex items-center gap-1.5 pl-3 border-l border-gorola-charcoal/10 text-xs font-bold text-gorola-slate hover:text-gorola-charcoal transition-colors font-dm-sans"
                    >
                      <span>Subcategories ({category.subCategories.length})</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Subcategories (Expanded view) */}
                {isExpanded && (
                  <div className="bg-gorola-fog/40 border-t border-gorola-charcoal/5 p-4 md:p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-heading text-sm font-bold text-gorola-charcoal">
                        Subcategories for {category.name}
                      </h4>
                      <Button
                        onClick={() => handleOpenAddSubCategory(category)}
                        className="px-3 py-1.5 bg-gorola-pine/10 hover:bg-gorola-pine/20 text-gorola-pine hover:text-gorola-pine rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-dm-sans shadow-none border-none"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        Add Subcategory
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {category.subCategories.length === 0 ? (
                        <p className="text-xs text-gorola-slate font-dm-sans py-2">
                          No subcategories added yet.
                        </p>
                      ) : (
                        category.subCategories.map((sub) => (
                          <div
                            key={sub.id}
                            onDragOver={(e) => handleSubCategoryDragOver(e, category.id, sub.id)}
                            className={`flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-gorola-charcoal/5 shadow-sm transition-all ${
                              !sub.isActive ? "opacity-60 bg-gray-50/50" : ""
                            } ${draggingSubCategoryId === sub.id ? "opacity-20 border-dashed border-gorola-pine" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Drag Handle */}
                              <div
                                draggable
                                onDragStart={(e) => handleSubCategoryDragStart(e, sub.id)}
                                onDragEnd={() => handleSubCategoryDragEnd(category.id)}
                                className="cursor-grab text-gorola-slate/40 hover:text-gorola-charcoal transition-colors p-1"
                                title="Drag to reorder"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>

                              {/* Image Preview */}
                              <div className="h-9 w-9 rounded-lg bg-gorola-fog border border-gorola-charcoal/5 flex items-center justify-center overflow-hidden shrink-0">
                                {sub.imageUrl ? (
                                  <img src={sub.imageUrl} alt={sub.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-gorola-slate/30" />
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-gorola-charcoal">{sub.name}</span>
                                  <span className="text-[9px] bg-gorola-fog text-gorola-slate font-mono px-1 rounded-sm">
                                    /{sub.slug}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gorola-slate font-dm-sans">
                                  Display Order: {sub.displayOrder} | Active Products: <span className="font-bold">{sub.productCount}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleSubCategoryStatus(sub)}
                                className={`px-2.5 py-1 border rounded-lg text-[10px] font-black uppercase tracking-wider transition-all font-dm-sans shadow-sm ${
                                  sub.isActive
                                    ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                                }`}
                              >
                                {sub.isActive ? "Disable" : "Enable"}
                              </button>

                              <button
                                onClick={() => handleOpenEditSubCategory(sub)}
                                className="p-1.5 border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-lg text-gorola-pine hover:bg-gorola-fog transition-all"
                                title="Edit Subcategory"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Category Dialog */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-md gap-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {editingCategory ? "Edit Category" : "Add New Category"}
            </DialogTitle>
            <DialogDescription>
              Configure details, slug, image, and commerce classification.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Category Name</span>
              <input
                data-testid="category-name-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={catName}
                onChange={(e) => handleCatNameChange(e.target.value)}
                placeholder="E.g. Fresh Vegetables"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Category Slug</span>
              <input
                data-testid="category-slug-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm font-mono"
                value={catSlug}
                onChange={(e) => setCatSlug(e.target.value)}
                placeholder="fresh-vegetables"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Image URL (Optional)</span>
              <input
                data-testid="category-image-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={catImageUrl}
                onChange={(e) => setCatImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </label>

            <div className="space-y-1.5">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal block">Commerce Type</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-dm-sans text-sm">
                  <input
                    type="radio"
                    name="commerceType"
                    value="QUICK_COMMERCE"
                    checked={catCommerceType === "QUICK_COMMERCE"}
                    onChange={() => setCatCommerceType("QUICK_COMMERCE")}
                    className="accent-gorola-pine"
                  />
                  Quick Commerce (Instant Delivery)
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-dm-sans text-sm">
                  <input
                    type="radio"
                    name="commerceType"
                    value="BOOKING_COMMERCE"
                    checked={catCommerceType === "BOOKING_COMMERCE"}
                    onChange={() => setCatCommerceType("BOOKING_COMMERCE")}
                    className="accent-gorola-pine"
                  />
                  Booking Commerce (Book a Service)
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="catIsActive"
                checked={catIsActive}
                onChange={(e) => setCatIsActive(e.target.checked)}
                className="rounded border-gorola-pine/20 text-gorola-pine focus:ring-gorola-pine h-4 w-4"
              />
              <label htmlFor="catIsActive" className="font-dm-sans text-sm text-gorola-charcoal cursor-pointer select-none">
                Category is active and visible to buyers
              </label>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{formError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCategoryModalOpen(false)}>
                Cancel
              </Button>
              <Button
                data-testid="submit-create-category"
                type="submit"
                className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              >
                {createCategoryMutation.isPending || updateCategoryMutation.isPending ? "Saving..." : "Save Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Subcategory Dialog */}
      <Dialog open={isSubCategoryModalOpen} onOpenChange={setIsSubCategoryModalOpen}>
        <DialogContent className="max-w-md gap-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {editingSubCategory ? "Edit Subcategory" : "Add New Subcategory"}
            </DialogTitle>
            <DialogDescription>
              Provide name, slug, image, and details for this subcategory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubCategorySubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Subcategory Name</span>
              <input
                data-testid="subcategory-name-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={subName}
                onChange={(e) => handleSubNameChange(e.target.value)}
                placeholder="E.g. Leafy Greens"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Subcategory Slug</span>
              <input
                data-testid="subcategory-slug-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm font-mono"
                value={subSlug}
                onChange={(e) => setSubSlug(e.target.value)}
                placeholder="leafy-greens"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Image URL (Optional)</span>
              <input
                data-testid="subcategory-image-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={subImageUrl}
                onChange={(e) => setSubImageUrl(e.target.value)}
                placeholder="https://example.com/sub-image.jpg"
              />
            </label>

            <div className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="subIsActive"
                checked={subIsActive}
                onChange={(e) => setSubIsActive(e.target.checked)}
                className="rounded border-gorola-pine/20 text-gorola-pine focus:ring-gorola-pine h-4 w-4"
              />
              <label htmlFor="subIsActive" className="font-dm-sans text-sm text-gorola-charcoal cursor-pointer select-none">
                Subcategory is active and visible
              </label>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{formError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSubCategoryModalOpen(false)}>
                Cancel
              </Button>
              <Button
                data-testid="submit-create-subcategory"
                type="submit"
                className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                disabled={createSubCategoryMutation.isPending || updateSubCategoryMutation.isPending}
              >
                {createSubCategoryMutation.isPending || updateSubCategoryMutation.isPending ? "Saving..." : "Save Subcategory"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation Dialog */}
      {deleteConfirmId && confirmDeleteCategory && (
        <div
          className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-gorola-charcoal font-heading">
                  Delete Category: {confirmDeleteCategory.name}
                </h3>
                <p className="text-xs text-gorola-slate font-dm-sans leading-relaxed">
                  Are you sure you want to permanently delete this category? All its subcategories will be deleted.
                </p>
                {confirmDeleteCategory.productCount > 0 && (
                  <p className="text-xs bg-rose-50 border border-rose-100 text-rose-700 font-bold px-3 py-2 rounded-lg mt-2">
                    ⚠️ Warning: There are {confirmDeleteCategory.productCount} active products associated with this category.
                    The system will block this deletion at the database layer. You should disable it or reassign products first.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 rounded-xl text-xs font-bold text-gorola-slate transition-all font-dm-sans"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-delete-button"
                onClick={handleDeleteConfirm}
                disabled={deleteCategoryMutation.isPending || (confirmDeleteCategory.productCount > 0)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
                  confirmDeleteCategory.productCount > 0
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
                }`}
              >
                {deleteCategoryMutation.isPending && (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
