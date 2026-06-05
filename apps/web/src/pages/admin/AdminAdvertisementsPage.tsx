import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type AdvertisementItem = {
  id: string;
  storeId: string;
  storeName: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  startsAt: string;
  endsAt: string;
  isApproved: boolean;
  isActive: boolean;
  submittedAt: string;
};

type AdvertisementsResponse = {
  success: boolean;
  data: AdvertisementItem[];
};

export function AdminAdvertisementsPage(): ReactElement {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"PENDING" | "APPROVED" | "ALL">("PENDING");
  const [rejectingAdId, setRejectingAdId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  // Fetch advertisements query
  const { data: advertisements, isLoading, isError, isFetching, refetch } = useQuery<AdvertisementItem[]>({
    queryKey: ["admin", "advertisements"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<AdvertisementsResponse>("/api/v1/admin/advertisements");
      return res.data.data;
    },
    staleTime: 15000,
  });

  // Mutating requests
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/admin/advertisements/${id}/approve`, {});
    },
    onSuccess: () => {
      toast.success("Advertisement approved and activated.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "advertisements"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to approve advertisement.");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/admin/advertisements/${id}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success("Advertisement rejected.");
      setRejectingAdId(null);
      setRejectionReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "advertisements"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to reject advertisement.");
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/admin/advertisements/${id}/deactivate`, {});
    },
    onSuccess: () => {
      toast.success("Advertisement deactivated.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "advertisements"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to deactivate advertisement.");
    }
  });

  const formatTimestamp = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleDeactivate = (id: string) => {
    deactivateMutation.mutate(id);
  };

  const handleRejectClick = (id: string) => {
    setRejectingAdId(id);
    setRejectionReason("");
  };

  const confirmRejection = () => {
    if (!rejectingAdId || rejectionReason.trim() === "") return;
    rejectMutation.mutate({ id: rejectingAdId, reason: rejectionReason });
  };

  if (isLoading && !advertisements) {
    return (
      <div data-testid="advertisements-loading-skeleton" className="space-y-6 animate-pulse">
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
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load advertisements</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
          Try Again
        </button>
      </div>
    );
  }

  const list = advertisements ?? [];
  const filteredAds = list.filter((ad) => {
    if (activeTab === "PENDING") {
      return !ad.isApproved && ad.isActive;
    }
    if (activeTab === "APPROVED") {
      return ad.isApproved && ad.isActive;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Advertisements</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Review store promotional banner submissions and manage active campaigns.
          </p>
        </div>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
          Sync Queue
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gorola-mint/15 bg-white px-2 py-1 rounded-2xl shadow-sm gap-2">
        <button
          role="tab"
          aria-selected={activeTab === "PENDING"}
          onClick={() => setActiveTab("PENDING")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-xl transition-all ${
            activeTab === "PENDING"
              ? "bg-gorola-pine text-white shadow-sm"
              : "text-gorola-slate hover:bg-gorola-mint/5"
          }`}
        >
          Pending
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "APPROVED"}
          onClick={() => setActiveTab("APPROVED")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-xl transition-all ${
            activeTab === "APPROVED"
              ? "bg-gorola-pine text-white shadow-sm"
              : "text-gorola-slate hover:bg-gorola-mint/5"
          }`}
        >
          Approved
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "ALL"}
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-xl transition-all ${
            activeTab === "ALL"
              ? "bg-gorola-pine text-white shadow-sm"
              : "text-gorola-slate hover:bg-gorola-mint/5"
          }`}
        >
          All
        </button>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAds.length === 0 ? (
          <div className="col-span-full bg-white border border-gorola-mint/15 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
            <AlertCircle className="h-12 w-12 text-gorola-slate/50" />
            <h3 className="text-lg font-bold text-gorola-charcoal font-heading">No advertisements found</h3>
            <p className="text-sm text-gorola-slate max-w-xs font-dm-sans">
              There are no banner submissions matching this tab.
            </p>
          </div>
        ) : (
          filteredAds.map((ad) => (
            <div
              key={ad.id}
              className="bg-white border border-gorola-mint/15 rounded-3xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow"
            >
              {/* Image Preview */}
              <div className="relative aspect-[16/6] bg-gorola-mint/5 overflow-hidden border-b border-gorola-mint/10">
                <img
                  src={ad.imageUrl}
                  alt={ad.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/800x300?text=Image+Load+Error";
                  }}
                />
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-gorola-charcoal font-heading">{ad.title}</h3>
                    {activeTab === "ALL" && (
                      <span className="text-[10px] uppercase tracking-wide font-black">
                        {ad.isApproved && ad.isActive && (
                          <span className="bg-green-50 text-green-700 border border-green-150 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Approved
                          </span>
                        )}
                        {!ad.isApproved && ad.isActive && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-150 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Pending
                          </span>
                        )}
                        {!ad.isApproved && !ad.isActive && (
                          <span className="bg-red-50 text-red-700 border border-red-150 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Rejected
                          </span>
                        )}
                        {ad.isApproved && !ad.isActive && (
                          <span className="bg-slate-50 text-slate-700 border border-slate-150 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Deactivated
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-dm-sans text-gorola-slate pt-1">
                    <div>
                      <span className="font-semibold text-gorola-charcoal block">Submitted By</span>
                      <Link
                        to={getScopedPath(`/admin/stores/${ad.storeId}`, "admin", isSubdomainMode)}
                        className="text-gorola-pine hover:underline font-bold"
                      >
                        {ad.storeName}
                      </Link>
                    </div>
                    <div>
                      <span className="font-semibold text-gorola-charcoal block">Campaign Schedule</span>
                      <span>{formatTimestamp(ad.startsAt)} – {formatTimestamp(ad.endsAt)}</span>
                    </div>
                  </div>

                  <div className="pt-2 text-xs font-dm-sans">
                    <span className="font-semibold text-gorola-charcoal block">Target URL</span>
                    <a
                      href={ad.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gorola-pine hover:underline flex items-center gap-1 truncate font-mono text-[11px]"
                    >
                      {ad.linkUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-gorola-mint/10 flex justify-end gap-3">
                  {!ad.isApproved && ad.isActive && (
                    <>
                      <button
                        onClick={() => handleRejectClick(ad.id)}
                        className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(ad.id)}
                        className="px-4 py-2 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-colors"
                      >
                        Approve
                      </button>
                    </>
                  )}
                  {ad.isApproved && ad.isActive && (
                    <button
                      onClick={() => handleDeactivate(ad.id)}
                      className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 text-gorola-slate rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rejection Modal Dialog */}
      {rejectingAdId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gorola-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl p-6 max-w-md w-full mx-4 shadow-xl border border-gorola-mint/15 transform animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gorola-charcoal flex items-center gap-2 font-heading">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Reject Advertisement
            </h3>
            <p className="text-sm text-gorola-slate font-dm-sans mt-3">
              Please provide a reason for rejecting this banner submission. This reason will be logged in the system audit logs.
            </p>
            <div className="mt-4">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Image resolution is too low"
                className="w-full h-24 bg-gorola-mint/5 border border-gorola-mint/15 rounded-xl p-3 text-sm text-gorola-charcoal outline-none focus:border-gorola-pine transition-all resize-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setRejectingAdId(null)}
                className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 rounded-xl font-bold text-sm text-gorola-slate transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejection}
                disabled={rejectionReason.trim() === ""}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
