import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Edit2, MapPin, MoreVertical, Plus, Star, Trash2 } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { type MapCoordinates, MUSSOORIE_AREA_CENTER,OlaAddressMapPicker as AddressMapPicker } from "@/components/buyer/OlaAddressMapPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

type Address = {
  id: string;
  label: string;
  landmarkDescription: string;
  flatRoom: string | null;
  lat: string | null;
  lng: string | null;
  isDefault: boolean;
};

export function SavedAddressesPage(): ReactElement {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [landmark, setLandmark] = useState("");
  const [flatRoom, setFlatRoom] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [mapCoords, setMapCoords] = useState<MapCoordinates | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);

  const { data: addresses, isLoading, error } = useQuery({
    enabled: !isBootstrapPending,
    queryFn: async () => {
      const response = await api!.get<{ data?: { addresses: Address[] } }>("/api/v1/addresses");
      return response.data.data?.addresses ?? [];
    },
    queryKey: ["buyer-addresses"]
  });

  const invalidateAddresses = () => {
    void queryClient.invalidateQueries({ queryKey: ["buyer-addresses"] });
  };

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api!.post("/api/v1/addresses", body);
    },
    onSuccess: () => {
      toast.success("Address added successfully");
      setIsFormOpen(false);
      invalidateAddresses();
    },
    onError: (err) => {
      handleApiError(err);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      await api!.put(`/api/v1/addresses/${id}`, body);
    },
    onSuccess: () => {
      toast.success("Address updated successfully");
      setIsFormOpen(false);
      invalidateAddresses();
    },
    onError: (err) => {
      handleApiError(err);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api!.delete(`/api/v1/addresses/${id}`);
    },
    onSuccess: () => {
      toast.success("Address deleted");
      invalidateAddresses();
    },
    onError: () => {
      toast.error("Could not delete address");
    }
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await api!.put(`/api/v1/addresses/${id}/default`);
    },
    onSuccess: () => {
      toast.success("Default address updated");
      invalidateAddresses();
    },
    onError: () => {
      toast.error("Could not update default address");
    }
  });

  const handleApiError = (err: unknown) => {
    if (isAxiosError(err)) {
      const body = err.response?.data;
      if (typeof body === "object" && body !== null && "error" in body) {
        setFormError((body as { error: { message: string } }).error.message);
        return;
      }
    }
    setFormError("An unexpected error occurred. Please try again.");
  };

  const handleOpenAddForm = () => {
    setEditingAddress(null);
    setLabel("");
    setLandmark("");
    setFlatRoom("");
    setIsDefault(false);
    setMapCoords(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (addr: Address) => {
    setEditingAddress(addr);
    setLabel(addr.label);
    setLandmark(addr.landmarkDescription);
    setFlatRoom(addr.flatRoom ?? "");
    setIsDefault(addr.isDefault);
    setMapCoords(addr.lat && addr.lng ? { lat: Number(addr.lat), lng: Number(addr.lng) } : null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveAddress = () => {
    setFormError(null);
    const trimmedLabel = label.trim();
    const trimmedLandmark = landmark.trim();
    
    if (trimmedLabel.length === 0) {
      setFormError("Label is required.");
      return;
    }
    if (trimmedLandmark.length < 10) {
      setFormError("Landmark must be at least 10 characters so drivers can find you.");
      return;
    }

    const payload: Record<string, unknown> = {
      label: trimmedLabel,
      landmarkDescription: trimmedLandmark,
      isDefault,
    };

    if (flatRoom.trim().length > 0) {
      payload.flatRoom = flatRoom.trim();
    }
    if (mapCoords) {
      payload.lat = mapCoords.lat;
      payload.lng = mapCoords.lng;
    }

    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-playfair text-3xl text-gorola-charcoal">Saved Addresses</h1>
        <Button onClick={handleOpenAddForm} size="sm" className="rounded-full bg-gorola-pine">
          <Plus className="mr-2 h-4 w-4" /> Add New
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : error ? (
        <p className="text-center font-dm-sans text-sm text-red-600">Failed to load addresses.</p>
      ) : addresses?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gorola-pine/20 bg-gorola-sand/30 py-12 text-center">
          <MapPin className="mb-3 h-8 w-8 text-gorola-pine/40" />
          <p className="font-dm-sans text-gorola-slate">You haven't saved any addresses yet.</p>
          <Button onClick={handleOpenAddForm} variant="outline" className="mt-4 rounded-full border-gorola-pine/20 text-gorola-pine hover:bg-gorola-pine/5">
            Add your first address
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses?.map((addr) => (
            <div key={addr.id} data-testid="address-card" className="relative flex flex-col justify-between rounded-xl border border-gorola-pine/15 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-dm-sans font-semibold text-gorola-charcoal">{addr.label}</h3>
                  {addr.isDefault && (
                    <span data-testid="default-badge" className="inline-flex items-center rounded-full bg-gorola-pine/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-gorola-pine">
                      DEFAULT
                    </span>
                  )}
                </div>
                {addr.flatRoom && (
                  <p className="font-dm-sans text-sm text-gorola-charcoal">{addr.flatRoom}</p>
                )}
                <p className="font-dm-sans text-sm text-gorola-slate max-w-sm">{addr.landmarkDescription}</p>
              </div>
              
              <div className="absolute right-2 top-2 sm:static sm:right-auto sm:top-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <MoreVertical className="h-4 w-4 text-gorola-slate" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl font-dm-sans">
                    {!addr.isDefault && (
                      <DropdownMenuItem onClick={() => setDefaultMutation.mutate(addr.id)}>
                        <Star className="mr-2 h-4 w-4 text-gorola-slate" /> Set as Default
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleOpenEditForm(addr)}>
                      <Edit2 className="mr-2 h-4 w-4 text-gorola-slate" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600 focus:bg-red-50 focus:text-red-600"
                      onClick={() => {
                        if (window.confirm("Are you sure you want to delete this address?")) {
                          deleteMutation.mutate(addr.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl gap-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-playfair text-xl">
              {editingAddress ? "Edit Address" : "Add New Address"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? "Update your delivery location details." : "Add a new location for your deliveries."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Label (e.g., Home, Work)</span>
              <input
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                name="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Home"
              />
            </label>
            
            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Flat / room (optional)</span>
              <input
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                value={flatRoom}
                onChange={(e) => setFlatRoom(e.target.value)}
                placeholder="Apt 4B"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Landmark (required)</span>
              <textarea
                className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                name="landmarkDescription"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="E.g. — near the red gate, behind Hotel Padmini"
                rows={3}
              />
            </label>

            <label className="flex items-center gap-2 font-dm-sans text-sm text-gorola-charcoal">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Set as default address
            </label>

            <div className="space-y-1 pt-2">
              <p className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Pinpoint location (optional)</p>
              <AddressMapPicker
                center={mapCoords ?? MUSSOORIE_AREA_CENTER}
                onCoordinatesChange={setMapCoords}
              />
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button className="bg-gorola-pine text-white" onClick={handleSaveAddress} disabled={isPending}>
              {isPending ? "Saving..." : "Save Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
