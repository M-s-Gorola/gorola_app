import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Layers,
  MapPin,
  Phone,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  User,
} from "lucide-react";
import type { ReactElement } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type StoreOwnerItem = {
  id: string;
  email: string;
  createdAt: string;
};

type StoreDetail = {
  id: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
  isActive: boolean;
  createdAt: string;
  revenue: number;
  productCount: number;
  orderCount: number;
  owners: StoreOwnerItem[];
};

type StoreDetailResponse = {
  success: boolean;
  data: StoreDetail;
};

export function AdminStoreDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  const { data: store, isLoading, isError, isFetching, refetch } = useQuery<StoreDetail>({
    queryKey: ["admin", "store-detail", id],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<StoreDetailResponse>(`/api/v1/admin/stores/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gorola-charcoal/10 rounded-xl w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
          <div className="h-28 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
          <div className="h-28 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
        </div>
        <div className="h-96 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
      </div>
    );
  }

  if (isError || !store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load store details</h2>
        <div className="flex gap-3">
          <button onClick={() => navigate(getScopedPath("/admin/stores", "admin", isSubdomainMode))} className="px-4 py-2 border border-gorola-charcoal/10 rounded-xl text-sm font-bold text-gorola-slate">
            Back to List
          </button>
          <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Breadcrumb */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate(getScopedPath("/admin/stores", "admin", isSubdomainMode))}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gorola-pine hover:text-gorola-pine-dark uppercase tracking-wider transition-all mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Stores
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">{store.name}</h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                store.isActive
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                  : "bg-rose-100 text-rose-800 border-rose-200/50"
              }`}
            >
              {store.isActive ? "Active" : "Suspended"}
            </span>
          </div>
          <p className="text-sm text-gorola-slate font-dm-sans">{store.description || "No description provided."}</p>
        </div>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
          Refresh Details
        </button>
      </header>

      {/* Metrics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gorola-pine/10 border border-gorola-pine/20 flex items-center justify-center text-gorola-pine">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-2xl font-bold text-gorola-charcoal mt-1">{formatCurrency(store.revenue)}</h3>
          </div>
        </div>

        <div className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100/60 border border-amber-200/50 flex items-center justify-center text-amber-700">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wider">Completed Orders</p>
            <h3 className="text-2xl font-bold text-gorola-charcoal mt-1">{store.orderCount}</h3>
          </div>
        </div>

        <div className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wider">Total Products</p>
            <h3 className="text-2xl font-bold text-gorola-charcoal mt-1">{store.productCount}</h3>
          </div>
        </div>
      </section>

      {/* Detail Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm space-y-6">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal border-b border-gorola-charcoal/5 pb-3">
              Store Profile
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gorola-slate shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Registered On</p>
                  <p className="text-sm font-semibold text-gorola-charcoal mt-0.5">
                    {new Date(store.createdAt).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Layers className="h-5 w-5 text-gorola-slate shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Commerce Type</p>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border mt-1 ${
                      store.storeType === "QUICK_COMMERCE"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                        : "bg-amber-100 text-amber-800 border-amber-200/50"
                    }`}
                  >
                    {store.storeType === "QUICK_COMMERCE" ? "Quick Commerce" : "Booking Commerce"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gorola-slate shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Phone Number</p>
                  <p className="text-sm font-semibold text-gorola-charcoal mt-0.5">{store.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gorola-slate shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Landmark Address</p>
                  <p className="text-sm font-semibold text-gorola-charcoal mt-0.5">{store.address}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Store Owners list */}
        <section className="space-y-6">
          <div className="bg-white border border-gorola-charcoal/10 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal border-b border-gorola-charcoal/5 pb-3">
              Store Owners
            </h2>

            {store.owners.length === 0 ? (
              <p className="text-xs text-gorola-slate italic">No store owners registered.</p>
            ) : (
              <div className="space-y-3">
                {store.owners.map((owner) => (
                  <div
                    key={owner.id}
                    className="flex items-center gap-3 bg-gorola-charcoal/[0.01] border border-gorola-charcoal/5 rounded-xl p-3.5"
                  >
                    <div className="h-8 w-8 rounded-full bg-gorola-pine/10 flex items-center justify-center text-gorola-pine shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gorola-charcoal truncate">{owner.email}</p>
                      <p className="text-[10px] text-gorola-slate mt-0.5">
                        Created: {new Date(owner.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
