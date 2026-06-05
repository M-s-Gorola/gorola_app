import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, EyeOff, Plus, RefreshCw } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type AdminStore = {
  id: string;
  name: string;
  storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
  ownerEmail: string;
  orderCount: number;
  revenue: number;
  productCount: number;
  isActive: boolean;
};

type StoresListResponse = {
  success: boolean;
  data: AdminStore[];
};

export function AdminStoresPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  // Dialog and confirmation states
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [confirmStatusChangeStoreId, setConfirmStatusChangeStoreId] = useState<string | null>(null);

  // Form states
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [storeType, setStoreType] = useState<"QUICK_COMMERCE" | "BOOKING_COMMERCE" | "">("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch stores query
  const { data: stores, isLoading, isError, isFetching, refetch } = useQuery<AdminStore[]>({
    queryKey: ["admin", "stores"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<StoresListResponse>("/api/v1/admin/stores");
      return res.data.data;
    },
    staleTime: 10000,
  });

  // Create store mutation
  const createStoreMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.post("/api/v1/admin/stores", body);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Store successfully created");
      setIsAddFormOpen(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["admin", "stores"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to create store";
      setFormError(msg);
      toast.error(msg);
    },
  });

  // Update store status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ storeId, isActive }: { storeId: string; isActive: boolean }) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put(`/api/v1/admin/stores/${storeId}/status`, { isActive });
      return res.data;
    },
    onSuccess: async (_, variables) => {
      const action = variables.isActive ? "activated" : "suspended";
      toast.success(`Store successfully ${action}`);
      setConfirmStatusChangeStoreId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "stores"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update store status";
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setStoreName("");
    setDescription("");
    setPhone("");
    setAddress("");
    setStoreType("");
    setOwnerEmail("");
    setOwnerPassword("");
    setShowPassword(false);
    setFormError(null);
  };

  const handleOpenAddForm = () => {
    resetForm();
    setIsAddFormOpen(true);
  };

  const handleCreateStoreSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!storeName.trim()) {
      setFormError("Store name is required");
      return;
    }
    if (!phone.trim()) {
      setFormError("Phone is required");
      return;
    }
    if (!address.trim()) {
      setFormError("Address is required");
      return;
    }
    if (!storeType) {
      setFormError("Store type is required");
      return;
    }
    if (!ownerEmail.trim()) {
      setFormError("Owner email is required");
      return;
    }
    if (!ownerPassword || ownerPassword.length < 8) {
      setFormError("Temp password must be at least 8 characters");
      return;
    }

    createStoreMutation.mutate({
      storeName: storeName.trim(),
      description: description.trim(),
      phone: phone.trim(),
      landmarkAddress: address.trim(),
      storeType,
      ownerEmail: ownerEmail.trim(),
      ownerTempPassword: ownerPassword,
    });
  };

  const handleToggleStatusConfirm = () => {
    if (!confirmStatusChangeStoreId) return;
    const store = stores?.find((s) => s.id === confirmStatusChangeStoreId);
    if (!store) return;

    toggleStatusMutation.mutate({
      storeId: confirmStatusChangeStoreId,
      isActive: !store.isActive,
    });
  };

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (isLoading && !stores) {
    return (
      <div data-testid="stores-loading-skeleton" className="space-y-6 animate-pulse">
        <div className="h-10 bg-gorola-charcoal/10 rounded-xl w-48" />
        <div className="h-14 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
        <div className="h-96 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load platform stores</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
          Try Again
        </button>
      </div>
    );
  }

  const items = stores ?? [];
  const confirmStore = items.find((s) => s.id === confirmStatusChangeStoreId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Platform Stores</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Provision and configure merchant stores, toggle statuses, and inspect metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
            Sync List
          </button>

          <Button
            data-testid="add-store-button"
            onClick={handleOpenAddForm}
            className="px-4 py-2.5 bg-gorola-pine hover:bg-gorola-pine-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Store
          </Button>
        </div>
      </header>

      {/* Stores Table */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/5 bg-gorola-charcoal/[0.02]">
                <th className="pl-4 pr-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Store Name</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Type</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Owner Email</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate text-center whitespace-nowrap">Orders</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Revenue</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate text-center whitespace-nowrap">Products</th>
                <th className="pl-3 pr-2 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Active</th>
                <th className="pl-2 pr-4 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gorola-charcoal/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm font-medium text-gorola-slate whitespace-nowrap">
                    No store accounts found.
                  </td>
                </tr>
              ) : (
                items.map((store) => (
                  <tr
                    key={store.id}
                    className={`hover:bg-gorola-charcoal/[0.01] transition-all ${
                      !store.isActive ? "opacity-60 bg-gray-50/50 border-gray-200 grayscale-[25%]" : ""
                    }`}
                  >
                    <td className="pl-4 pr-3 py-4 text-xs font-bold text-gorola-charcoal whitespace-nowrap">
                      <div className="max-w-[140px] truncate" title={store.name}>
                        {store.name}
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          store.storeType === "QUICK_COMMERCE"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                            : "bg-amber-100 text-amber-800 border-amber-200/50"
                        }`}
                      >
                        {store.storeType === "QUICK_COMMERCE" ? "Quick" : "Booking"}
                      </span>
                    </td>
                    <td className="px-3 py-4 font-mono text-xs text-gorola-charcoal whitespace-nowrap">
                      <div className="max-w-[140px] truncate" title={store.ownerEmail}>
                        {store.ownerEmail}
                      </div>
                    </td>
                    <td className="px-3 py-4 font-bold text-center text-gorola-charcoal whitespace-nowrap">{store.orderCount}</td>
                    <td className="px-3 py-4 font-bold text-gorola-charcoal whitespace-nowrap">{formatCurrency(store.revenue)}</td>
                    <td className="px-3 py-4 font-bold text-center text-gorola-charcoal whitespace-nowrap">{store.productCount}</td>
                    <td className="pl-3 pr-2 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          store.isActive
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                            : "bg-rose-100 text-rose-800 border-rose-200/50"
                        }`}
                      >
                        {store.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="pl-2 pr-4 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        data-testid={`view-details-${store.id}`}
                        onClick={() => navigate(getScopedPath(`/admin/stores/${store.id}`, "admin", isSubdomainMode))}
                        className="px-3 py-1.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold text-gorola-pine transition-all shadow-sm whitespace-nowrap"
                      >
                        View Details
                      </button>
                      <button
                        data-testid={`toggle-status-${store.id}`}
                        onClick={() => setConfirmStatusChangeStoreId(store.id)}
                        className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap ${
                          store.isActive
                            ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                            : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                        }`}
                      >
                        {store.isActive ? "Suspend" : "Unsuspend"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Store Partner Dialog */}
      <Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
        <DialogContent className="max-w-md gap-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              Add New Store Partner
            </DialogTitle>
            <DialogDescription>
              Create a new store and provision its initial store owner credentials.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStoreSubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Store Name</span>
              <input
                data-testid="store-name-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="E.g. Green Valley Grocers"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Description</span>
              <textarea
                data-testid="store-desc-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief store description..."
                rows={2}
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Phone</span>
                <input
                  data-testid="store-phone-input"
                  className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Address</span>
                <input
                  data-testid="store-address-input"
                  className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street details..."
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal block">Store Type</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-dm-sans text-sm">
                  <input
                    type="radio"
                    name="storeType"
                    value="QUICK_COMMERCE"
                    checked={storeType === "QUICK_COMMERCE"}
                    onChange={() => setStoreType("QUICK_COMMERCE")}
                    className="accent-gorola-pine"
                  />
                  Quick Commerce
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-dm-sans text-sm">
                  <input
                    type="radio"
                    name="storeType"
                    value="BOOKING_COMMERCE"
                    checked={storeType === "BOOKING_COMMERCE"}
                    onChange={() => setStoreType("BOOKING_COMMERCE")}
                    className="accent-gorola-pine"
                  />
                  Booking Commerce
                </label>
              </div>
            </div>

            <div className="border-t border-gorola-charcoal/5 pt-3 space-y-4">
              <h3 className="font-heading text-sm font-bold text-gorola-charcoal">Owner Credentials</h3>

              <label className="block space-y-1">
                <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Owner Email</span>
                <input
                  data-testid="owner-email-input"
                  type="email"
                  className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@store.com"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Temp Password</span>
                <div className="relative">
                  <input
                    data-testid="owner-password-input"
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-lg border border-gorola-pine/20 pl-3 pr-10 py-2 font-dm-sans text-sm"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showPassword ? "Hide" : "Show"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{formError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddFormOpen(false)} disabled={createStoreMutation.isPending}>
                Cancel
              </Button>
              <Button
                data-testid="submit-create-store"
                type="submit"
                className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                disabled={createStoreMutation.isPending}
              >
                {createStoreMutation.isPending ? "Creating..." : "Save Store"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suspend / Unsuspend Confirmation Modal */}
      {confirmStatusChangeStoreId && confirmStore && (
        <div
          className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setConfirmStatusChangeStoreId(null)}
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
                <h3 className="text-lg font-bold text-gorola-charcoal">
                  {confirmStore.isActive ? "Suspend Store Partner" : "Unsuspend Store Partner"}
                </h3>
                <p className="text-xs text-gorola-slate leading-relaxed">
                  Are you sure you want to {confirmStore.isActive ? "suspend" : "unsuspend"} this store?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmStatusChangeStoreId(null)}
                className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 rounded-xl text-xs font-bold text-gorola-slate transition-all"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-status-change"
                onClick={handleToggleStatusConfirm}
                disabled={toggleStatusMutation.isPending}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
                  confirmStore.isActive
                    ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
                    : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                }`}
              >
                {toggleStatusMutation.isPending && (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
