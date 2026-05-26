import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Plus,
  Trash2
} from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

type Advertisement = {
  id: string;
  storeId: string;
  title: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
};

type AdsEnvelope = {
  success: boolean;
  data: Advertisement[];
};

export function StoreAdvertisementsPage(): ReactElement {
  const queryClient = useQueryClient();

  // Form states
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // 1. Fetch Advertisements Query
  const { data: adsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ["store", "advertisements"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<AdsEnvelope>("/api/v1/store/advertisements");
      return res.data;
    }
  });

  // 2. Submit Advertisement Mutation
  const createAdMutation = useMutation({
    mutationFn: async (payload: { title: string; imageUrl: string; startsAt: string; endsAt: string }) => {
      if (!api) throw new Error("API helper not initialized");
      // Format to ISO Strings for the backend
      const formattedPayload = {
        title: payload.title,
        imageUrl: payload.imageUrl,
        startsAt: new Date(payload.startsAt).toISOString(),
        endsAt: new Date(payload.endsAt).toISOString()
      };
      const res = await api.post<AdsEnvelope>("/api/v1/store/advertisements", formattedPayload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Advertisement submitted for approval successfully");
      // Reset form
      setTitle("");
      setImageUrl("");
      setStartsAt("");
      setEndsAt("");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", "advertisements"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to submit advertisement";
      toast.error(errMsg);
    }
  });

  // 3. Delete Advertisement Mutation
  const deleteAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.delete(`/api/v1/store/advertisements/${adId}`);
    },
    onSuccess: () => {
      toast.success("Advertisement deleted successfully");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store", "advertisements"] });
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = errorResponse?.response?.data?.error?.message || "Failed to delete advertisement";
      toast.error(errMsg);
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !imageUrl.trim() || !startsAt || !endsAt) {
      toast.error("Please fill in all advertisement fields");
      return;
    }

    const starts = new Date(startsAt);
    const ends = new Date(endsAt);

    if (ends.getTime() < starts.getTime()) {
      toast.error("Ends At date cannot be before Starts At date");
      return;
    }

    createAdMutation.mutate({
      title,
      imageUrl,
      startsAt,
      endsAt
    });
  };

  const getStatusBadge = (ad: Advertisement) => {
    const now = new Date();
    const ends = new Date(ad.endsAt);

    if (now > ends) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-200 font-dm-sans">
          Expired
        </span>
      );
    }

    if (ad.isApproved && ad.isActive) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 font-dm-sans">
          Approved & Active
        </span>
      );
    }

    if (!ad.isApproved && ad.isActive) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 font-dm-sans">
          Pending Approval
        </span>
      );
    }

    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 font-dm-sans">
        Deactivated
      </span>
    );
  };

  const formatDateRange = (starts: string, ends: string) => {
    try {
      return `${format(new Date(starts), "dd MMM yyyy, hh:mm a")} - ${format(new Date(ends), "dd MMM yyyy, hh:mm a")}`;
    } catch {
      return `${starts} - ${ends}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Store Advertisements</h1>
        <p className="text-sm text-gorola-slate font-dm-sans">
          Promote your store by submitting banner advertisements. Submit for admin approval to display your banners.
        </p>
      </div>

      {/* Main Responsive Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Submission Form */}
        <div className="bg-white border border-gorola-mint/15 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-gorola-mint/10 pb-4">
            <Megaphone className="h-5 w-5 text-gorola-pine" />
            <h2 className="text-lg font-bold text-gorola-charcoal font-heading">Submit New Ad</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <label htmlFor="ad-title" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Ad Title
              </label>
              <input
                id="ad-title"
                type="text"
                placeholder="e.g. 50% Off Monsoon Special"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
              />
            </div>

            {/* Image URL */}
            <div className="space-y-1">
              <label htmlFor="ad-imageUrl" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Image URL
              </label>
              <input
                id="ad-imageUrl"
                type="url"
                placeholder="https://example.com/banner.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
              />
            </div>

            {/* Starts At */}
            <div className="space-y-1">
              <label htmlFor="ad-startsAt" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Starts At
              </label>
              <div className="relative">
                <input
                  id="ad-startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
                />
                <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-gorola-slate" />
              </div>
            </div>

            {/* Ends At */}
            <div className="space-y-1">
              <label htmlFor="ad-endsAt" className="text-xs font-bold text-gorola-slate uppercase tracking-wider">
                Ends At
              </label>
              <div className="relative">
                <input
                  id="ad-endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gorola-mint/5 border border-gorola-mint/20 focus:border-gorola-pine focus:outline-none rounded-xl text-sm text-gorola-charcoal placeholder-gorola-slate/50 font-dm-sans"
                />
                <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-gorola-slate" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={createAdMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-gorola-pine/15 transition-all disabled:opacity-50"
            >
              {createAdMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Submit for Approval
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Advertisements List */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div data-testid="ads-loading-skeleton" className="bg-white border border-gorola-mint/15 rounded-3xl p-6 space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gorola-mint/5 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-16 bg-gorola-charcoal/10 rounded-lg" />
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
              <h2 className="text-lg font-bold text-gorola-charcoal font-heading">Failed to load advertisements</h2>
              <p className="text-xs text-gorola-slate max-w-xs font-dm-sans">
                An error occurred while loading your advertisements. Please try refreshing.
              </p>
              <button
                onClick={() => void refetch()}
                className="px-4 py-2 border border-gorola-pine/20 hover:bg-gorola-pine/5 text-gorola-pine text-xs font-bold uppercase rounded-lg"
              >
                Retry Connection
              </button>
            </div>
          ) : adsResponse?.data && adsResponse.data.length > 0 ? (
            <div className="bg-white border border-gorola-mint/15 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gorola-mint/10 border-b border-gorola-mint/15">
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider">Image Preview</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider">Title</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider">Date Range</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-black text-gorola-charcoal uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsResponse.data.map((ad) => (
                      <tr
                        key={ad.id}
                        data-testid={`ad-row-${ad.id}`}
                        className="border-b border-gorola-mint/10 last:border-0 hover:bg-gorola-mint/5 transition-colors duration-150"
                      >
                        <td className="p-4">
                          {ad.imageUrl ? (
                            <img
                              src={ad.imageUrl}
                              alt={ad.title}
                              className="h-12 w-20 rounded-lg object-cover border border-gorola-mint/15 shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=120";
                              }}
                            />
                          ) : (
                            <div className="h-12 w-20 bg-gorola-mint/10 rounded-lg border border-gorola-mint/15 flex items-center justify-center text-gorola-pine">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <h4 className="font-heading text-sm font-black text-gorola-charcoal">{ad.title}</h4>
                        </td>
                        <td className="p-4 text-xs text-gorola-slate font-dm-sans">
                          {formatDateRange(ad.startsAt, ad.endsAt)}
                        </td>
                        <td className="p-4">
                          {getStatusBadge(ad)}
                        </td>
                        <td className="p-4 text-right">
                          {/* Approved ads must not show delete action button per requirements */}
                          {!ad.isApproved && (
                            <button
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this advertisement?")) {
                                  deleteAdMutation.mutate(ad.id);
                                }
                              }}
                              disabled={deleteAdMutation.isPending}
                              data-testid={`delete-ad-${ad.id}`}
                              className="p-2 border border-rose-200 hover:bg-rose-50 rounded-lg text-rose-500 transition-all disabled:opacity-50"
                              title="Delete Ad"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gorola-mint/15 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
              <div className="h-16 w-16 bg-gorola-mint/20 text-gorola-pine rounded-full flex items-center justify-center">
                <Megaphone className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-gorola-charcoal font-heading">No advertisements found</h3>
              <p className="text-sm text-gorola-slate max-w-xs font-dm-sans">
                You haven't submitted any advertisements yet. Use the form to submit your first promotional banner!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
