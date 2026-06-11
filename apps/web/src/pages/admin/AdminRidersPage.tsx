import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Edit2, Plus, RefreshCw, UserCheck, UserX } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
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

type RiderStoreRelation = {
  storeId: string;
  isPrimary: boolean;
  store: {
    id: string;
    name: string;
    storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
  };
};

type Rider = {
  id: string;
  name: string;
  phone: string;
  email: string;
  riderType: "DELIVERY" | "FIELD_TECHNICIAN";
  isActive: boolean;
  stores: RiderStoreRelation[];
};

type RidersListResponse = {
  success: boolean;
  data: Rider[];
};

type PlatformStore = {
  id: string;
  name: string;
  storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
  isActive: boolean;
};

type StoresListResponse = {
  success: boolean;
  data: PlatformStore[];
};

export function AdminRidersPage(): ReactElement {
  const queryClient = useQueryClient();

  // Dialog and confirmation states
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [confirmStatusChangeRiderId, setConfirmStatusChangeRiderId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [riderType, setRiderType] = useState<"DELIVERY" | "FIELD_TECHNICIAN" | "">("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [primaryStoreId, setPrimaryStoreId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch riders list
  const { data: riders, isLoading, isError, isFetching, refetch } = useQuery<Rider[]>({
    queryKey: ["admin", "riders"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<RidersListResponse>("/api/v1/admin/riders");
      return res.data.data;
    },
    staleTime: 10000,
  });

  // Fetch platform stores
  const { data: stores } = useQuery<PlatformStore[]>({
    queryKey: ["admin", "stores"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<StoresListResponse>("/api/v1/admin/stores");
      return res.data.data;
    },
    staleTime: 30000,
  });

  // Reset store selections if riderType changes
  useEffect(() => {
    setStoreIds([]);
    setPrimaryStoreId("");
  }, [riderType]);

  // Create rider mutation
  const createRiderMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.post("/api/v1/admin/riders", body);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Rider successfully created");
      setIsAddFormOpen(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["admin", "riders"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to create rider";
      setFormError(msg);
      toast.error(msg);
    },
  });

  // Update rider status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ riderId, isActive }: { riderId: string; isActive: boolean }) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put(`/api/v1/admin/riders/${riderId}`, { isActive });
      return res.data;
    },
    onSuccess: async (_, variables) => {
      const action = variables.isActive ? "activated" : "suspended";
      toast.success(`Rider successfully ${action}`);
      setConfirmStatusChangeRiderId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "riders"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update rider status";
      toast.error(msg);
    },
  });

  // Update rider assignments mutation
  const editRiderMutation = useMutation({
    mutationFn: async ({ riderId, storeIds, primaryStoreId }: { riderId: string; storeIds: string[]; primaryStoreId: string }) => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.put(`/api/v1/admin/riders/${riderId}`, { storeIds, primaryStoreId });
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Rider stores updated successfully");
      setIsEditFormOpen(false);
      setSelectedRider(null);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["admin", "riders"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update rider stores";
      setFormError(msg);
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setRiderType("");
    setStoreIds([]);
    setPrimaryStoreId("");
    setFormError(null);
  };

  const handleOpenAddForm = () => {
    resetForm();
    setIsAddFormOpen(true);
  };

  const handleOpenEditForm = (rider: Rider) => {
    resetForm();
    setSelectedRider(rider);
    setName(rider.name);
    setEmail(rider.email);
    setPhone(rider.phone);
    setRiderType(rider.riderType);
    setStoreIds(rider.stores.map((s) => s.storeId));
    const primary = rider.stores.find((s) => s.isPrimary);
    setPrimaryStoreId(primary?.storeId || "");
    setIsEditFormOpen(true);
  };

  const handleCreateRiderSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!phone.trim()) {
      setFormError("Phone is required");
      return;
    }
    if (!email.trim()) {
      setFormError("Email is required");
      return;
    }
    if (!password || password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }
    if (!riderType) {
      setFormError("Rider type is required");
      return;
    }
    if (storeIds.length === 0) {
      setFormError("At least one store assignment is required");
      return;
    }
    if (!primaryStoreId) {
      setFormError("A primary store must be selected");
      return;
    }

    createRiderMutation.mutate({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      password,
      riderType,
      storeIds,
      primaryStoreId,
    });
  };

  const handleEditRiderSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedRider) return;

    if (storeIds.length === 0) {
      setFormError("At least one store assignment is required");
      return;
    }
    if (!primaryStoreId) {
      setFormError("A primary store must be selected");
      return;
    }

    editRiderMutation.mutate({
      riderId: selectedRider.id,
      storeIds,
      primaryStoreId,
    });
  };

  const handleToggleStatusConfirm = () => {
    if (!confirmStatusChangeRiderId) return;
    const rider = riders?.find((r) => r.id === confirmStatusChangeRiderId);
    if (!rider) return;

    toggleStatusMutation.mutate({
      riderId: confirmStatusChangeRiderId,
      isActive: !rider.isActive,
    });
  };

  const availableStores = (stores ?? []).filter((s) => {
    if (!s.isActive) return false;
    if (riderType === "DELIVERY") {
      return s.storeType === "QUICK_COMMERCE";
    }
    if (riderType === "FIELD_TECHNICIAN") {
      return s.storeType === "BOOKING_COMMERCE";
    }
    return false;
  });

  if (isLoading && !riders) {
    return (
      <div data-testid="riders-loading-skeleton" className="space-y-6 animate-pulse">
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
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load platform riders</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
          Try Again
        </button>
      </div>
    );
  }

  const items = riders ?? [];
  const confirmRider = items.find((r) => r.id === confirmStatusChangeRiderId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Platform Riders</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Provision delivery riders and field technicians, manage multi-store assignments, and toggle activation status.
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
            data-testid="add-rider-button"
            onClick={handleOpenAddForm}
            className="px-4 py-2.5 bg-gorola-pine hover:bg-gorola-pine-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Rider
          </Button>
        </div>
      </header>

      {/* Riders Table */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/5 bg-gorola-charcoal/[0.02]">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Name</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Phone</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Email</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Assigned Stores</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gorola-slate text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gorola-charcoal/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs font-medium text-gorola-slate whitespace-nowrap">
                    No rider partners found.
                  </td>
                </tr>
              ) : (
                items.map((rider) => (
                  <tr
                    key={rider.id}
                    className={`hover:bg-gorola-charcoal/[0.01] transition-all ${
                      !rider.isActive ? "opacity-60 bg-gray-50/50 border-gray-200" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-xs text-gorola-charcoal whitespace-nowrap">{rider.name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gorola-charcoal whitespace-nowrap">{rider.phone}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-gorola-charcoal whitespace-nowrap">{rider.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          rider.riderType === "DELIVERY"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                            : "bg-purple-100 text-purple-800 border-purple-200/50"
                        }`}
                      >
                        {rider.riderType === "DELIVERY" ? "Delivery" : "Technician"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gorola-charcoal">
                      <div className="flex flex-col gap-1">
                        {rider.stores.map((s) => (
                          <span key={s.storeId} className="inline-flex items-center gap-1.5">
                            <span className="font-bold">{s.store.name}</span>
                            {s.isPrimary && (
                              <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[8px] font-black uppercase rounded border border-blue-200">
                                Primary
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          rider.isActive
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                            : "bg-rose-100 text-rose-800 border-rose-200/50"
                        }`}
                      >
                        {rider.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        data-testid={`edit-stores-${rider.id}`}
                        onClick={() => handleOpenEditForm(rider)}
                        className="px-2 py-1 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-lg text-[10px] font-bold text-gorola-pine transition-all shadow-sm inline-flex items-center gap-1"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit Stores
                      </button>
                      <button
                        data-testid={`toggle-status-rider-${rider.id}`}
                        onClick={() => setConfirmStatusChangeRiderId(rider.id)}
                        className={`px-2 py-1 border rounded-lg text-[10px] font-bold transition-all shadow-sm whitespace-nowrap inline-flex items-center gap-1 ${
                          rider.isActive
                            ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                            : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                        }`}
                      >
                        {rider.isActive ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                        {rider.isActive ? "Suspend" : "Unsuspend"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Rider Dialog */}
      <Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
        <DialogContent className="max-w-md gap-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              Add New Rider Partner
            </DialogTitle>
            <DialogDescription>
              Create a new rider account and configure their store assignments.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRiderSubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Name</span>
              <input
                data-testid="rider-name-input"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Ramesh Singh"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Phone</span>
                <input
                  data-testid="rider-phone-input"
                  className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919000000001"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Email</span>
                <input
                  data-testid="rider-email-input"
                  type="email"
                  className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh@gorola.in"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Password</span>
              <input
                data-testid="rider-password-input"
                type="password"
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </label>

            <div className="space-y-1.5">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal block">Rider Type</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-dm-sans text-sm">
                  <input
                    data-testid="rider-type-delivery"
                    type="radio"
                    name="riderType"
                    value="DELIVERY"
                    checked={riderType === "DELIVERY"}
                    onChange={() => setRiderType("DELIVERY")}
                    className="accent-gorola-pine"
                  />
                  Delivery Rider (Quick Commerce)
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-dm-sans text-sm">
                  <input
                    data-testid="rider-type-technician"
                    type="radio"
                    name="riderType"
                    value="FIELD_TECHNICIAN"
                    checked={riderType === "FIELD_TECHNICIAN"}
                    onChange={() => setRiderType("FIELD_TECHNICIAN")}
                    className="accent-gorola-pine"
                  />
                  Field Technician (Booking)
                </label>
              </div>
            </div>

            {riderType && (
              <div className="border-t border-gorola-charcoal/5 pt-3 space-y-2">
                <h3 className="font-heading text-sm font-bold text-gorola-charcoal mb-1">Store Assignments</h3>
                {availableStores.length === 0 ? (
                  <p className="text-xs text-gorola-slate italic">No active stores available for this rider type.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {availableStores.map((store) => {
                      const isChecked = storeIds.includes(store.id);
                      return (
                        <div key={store.id} className="flex items-center justify-between border border-gorola-charcoal/5 rounded-xl p-3 bg-gorola-charcoal/[0.01]">
                          <label className="flex items-center gap-2 cursor-pointer font-dm-sans text-sm flex-1">
                            <input
                              data-testid={`rider-store-checkbox-${store.id}`}
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setStoreIds((prev) => [...prev, store.id]);
                                  if (storeIds.length === 0) {
                                    setPrimaryStoreId(store.id);
                                  }
                                } else {
                                  setStoreIds((prev) => prev.filter((id) => id !== store.id));
                                  if (primaryStoreId === store.id) {
                                    setPrimaryStoreId("");
                                  }
                                }
                              }}
                              className="accent-gorola-pine rounded"
                            />
                            {store.name}
                          </label>
                          {isChecked && (
                            <label className="flex items-center gap-1.5 cursor-pointer font-dm-sans text-xs text-gorola-pine font-bold">
                              <input
                                data-testid={`rider-primary-store-radio-${store.id}`}
                                type="radio"
                                name="primaryStore"
                                checked={primaryStoreId === store.id}
                                onChange={() => setPrimaryStoreId(store.id)}
                                className="accent-gorola-pine"
                              />
                              Primary
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{formError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddFormOpen(false)} disabled={createRiderMutation.isPending}>
                Cancel
              </Button>
              <Button
                data-testid="submit-create-rider"
                type="submit"
                className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                disabled={createRiderMutation.isPending}
              >
                {createRiderMutation.isPending ? "Creating..." : "Save Rider"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Rider Dialog */}
      <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
        <DialogContent className="max-w-md gap-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              Edit Store Assignments
            </DialogTitle>
            <DialogDescription>
              Modify store assignments and primary store for {selectedRider?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditRiderSubmit} className="space-y-4">
            <div className="bg-gorola-charcoal/[0.02] border border-gorola-charcoal/5 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-dm-sans text-gorola-slate">
                Rider Type: <span className="font-black text-gorola-charcoal uppercase">{riderType === "DELIVERY" ? "Delivery" : "Technician"}</span>
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-heading text-sm font-bold text-gorola-charcoal mb-1">Store Assignments</h3>
              {availableStores.length === 0 ? (
                <p className="text-xs text-gorola-slate italic">No active stores available for this rider type.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableStores.map((store) => {
                    const isChecked = storeIds.includes(store.id);
                    return (
                      <div key={store.id} className="flex items-center justify-between border border-gorola-charcoal/5 rounded-xl p-3 bg-gorola-charcoal/[0.01]">
                        <label className="flex items-center gap-2 cursor-pointer font-dm-sans text-sm flex-1">
                          <input
                            data-testid={`rider-store-checkbox-${store.id}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setStoreIds((prev) => [...prev, store.id]);
                                if (storeIds.length === 0) {
                                  setPrimaryStoreId(store.id);
                                }
                              } else {
                                setStoreIds((prev) => prev.filter((id) => id !== store.id));
                                if (primaryStoreId === store.id) {
                                  setPrimaryStoreId("");
                                }
                              }
                            }}
                            className="accent-gorola-pine rounded"
                          />
                          {store.name}
                        </label>
                        {isChecked && (
                          <label className="flex items-center gap-1.5 cursor-pointer font-dm-sans text-xs text-gorola-pine font-bold">
                            <input
                              data-testid={`rider-primary-store-radio-${store.id}`}
                              type="radio"
                              name="primaryStoreEdit"
                              checked={primaryStoreId === store.id}
                              onChange={() => setPrimaryStoreId(store.id)}
                              className="accent-gorola-pine"
                            />
                            Primary
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{formError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditFormOpen(false)} disabled={editRiderMutation.isPending}>
                Cancel
              </Button>
              <Button
                data-testid="submit-edit-rider"
                type="submit"
                className="bg-gorola-pine text-white hover:bg-gorola-pine-dark"
                disabled={editRiderMutation.isPending}
              >
                {editRiderMutation.isPending ? "Saving..." : "Save Assignments"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suspend / Unsuspend Confirmation Modal */}
      {confirmStatusChangeRiderId && confirmRider && (
        <div
          className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setConfirmStatusChangeRiderId(null)}
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
                  {confirmRider.isActive ? "Suspend Rider Account" : "Unsuspend Rider Account"}
                </h3>
                <p className="text-xs text-gorola-slate leading-relaxed">
                  Are you sure you want to {confirmRider.isActive ? "suspend" : "unsuspend"} this rider?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmStatusChangeRiderId(null)}
                className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 rounded-xl text-xs font-bold text-gorola-slate transition-all"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-status-change"
                onClick={handleToggleStatusConfirm}
                disabled={toggleStatusMutation.isPending}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
                  confirmRider.isActive
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
