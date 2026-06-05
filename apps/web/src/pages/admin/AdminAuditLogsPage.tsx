import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  RefreshCw
} from "lucide-react";
import type { ReactElement } from "react";
import { Fragment, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type AuditLogItem = {
  id: string;
  actorId: string;
  actorRole: "ADMIN" | "STORE_OWNER" | "BUYER" | "SYSTEM";
  actorMasked: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipMasked: string;
  userAgent: string;
  createdAt: string;
};

type AuditLogsResponse = {
  success: boolean;
  data: {
    items: AuditLogItem[];
    nextCursor: string | null;
  };
};

export function AdminAuditLogsPage(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  // Filters synced to URL search parameters
  const roleFilter = searchParams.get("role") ?? "";
  const actionFilter = searchParams.get("action") ?? "";
  const entityTypeFilter = searchParams.get("entityType") ?? "";
  const fromFilter = searchParams.get("from") ?? "";
  const toFilter = searchParams.get("to") ?? "";

  // Cursor-based pagination state
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const currentCursor = cursors[cursorIndex];

  // Expandable rows state
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  const limit = 50;

  // Sync filter change to URL
  const handleFilterChange = (key: string, value: string) => {
    setSearchParams((prev) => {
      if (value) {
        prev.set(key, value);
      } else {
        prev.delete(key);
      }
      return prev;
    });
    // Reset pagination cursors on filter change
    setCursors([null]);
    setCursorIndex(0);
  };

  // Fetch audit logs query
  const { data, isLoading, isError, isFetching, refetch } = useQuery<AuditLogsResponse["data"]>({
    queryKey: ["admin", "audit-logs", roleFilter, actionFilter, entityTypeFilter, fromFilter, toFilter, currentCursor],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      if (roleFilter) params.append("role", roleFilter);
      if (actionFilter) params.append("action", actionFilter);
      if (entityTypeFilter) params.append("entityType", entityTypeFilter);
      if (fromFilter) params.append("from", fromFilter);
      if (toFilter) params.append("to", toFilter);
      if (currentCursor) params.append("cursor", currentCursor);

      const res = await api.get<AuditLogsResponse>(`/api/v1/admin/audit-logs?${params.toString()}`);
      return res.data.data;
    },
    staleTime: 10000
  });

  const toggleExpandLog = (logId: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleExport = async () => {
    try {
      const toastId = toast.loading("Generating CSV export...");
      const params = new URLSearchParams();
      if (roleFilter) params.append("role", roleFilter);
      if (actionFilter) params.append("action", actionFilter);
      if (entityTypeFilter) params.append("entityType", entityTypeFilter);
      if (fromFilter) params.append("from", fromFilter);
      if (toFilter) params.append("to", toFilter);

      const res = await api?.get(`/api/v1/admin/audit-logs/export?${params.toString()}`, { responseType: "text" });
      const blob = new Blob([res?.data as string], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `audit-logs-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV export downloaded!", { id: toastId });
    } catch {
      toast.error("Failed to generate CSV export");
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-rose-100 text-rose-800 border-rose-200/50";
      case "STORE_OWNER":
        return "bg-sky-100 text-sky-800 border-sky-200/50";
      case "BUYER":
        return "bg-emerald-100 text-emerald-800 border-emerald-200/50";
      case "SYSTEM":
        return "bg-purple-100 text-purple-800 border-purple-200/50";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200/50";
    }
  };

  if (isLoading && !data) {
    return (
      <div data-testid="audit-logs-loading-skeleton" className="space-y-6 animate-pulse">
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
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load platform audit logs</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
          Try Again
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Platform Audit Logs</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Read-only access to platform operations, state changes, actor details, and IP mapping records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            data-testid="export-csv-button"
            className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
          >
            <Download className="h-4 w-4 text-gorola-pine" />
            Export CSV
          </button>
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
            Sync Logs
          </button>
        </div>
      </header>

      {/* Filters */}
      <section className="bg-white rounded-2xl border border-gorola-charcoal/10 p-5 shadow-sm grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end">
        {/* Role select */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">Actor Role</label>
          <select
            data-testid="filter-role-select"
            value={roleFilter}
            onChange={(e) => handleFilterChange("role", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="STORE_OWNER">Store Owner</option>
            <option value="BUYER">Buyer</option>
            <option value="SYSTEM">System</option>
          </select>
        </div>

        {/* Action input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">Action Type</label>
          <input
            type="text"
            placeholder="Search action (e.g. SUSPEND)..."
            value={actionFilter}
            onChange={(e) => handleFilterChange("action", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-medium text-gorola-charcoal focus:outline-none"
          />
        </div>

        {/* Entity Type input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">Entity Type</label>
          <input
            type="text"
            placeholder="Search entity (e.g. Store)..."
            value={entityTypeFilter}
            onChange={(e) => handleFilterChange("entityType", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-medium text-gorola-charcoal focus:outline-none"
          />
        </div>

        {/* From Date */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">From Date</label>
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => handleFilterChange("from", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none"
          />
        </div>

        {/* To Date */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gorola-slate uppercase tracking-wider">To Date</label>
          <input
            type="date"
            value={toFilter}
            onChange={(e) => handleFilterChange("to", e.target.value)}
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl px-3 py-2 text-xs font-bold text-gorola-charcoal focus:outline-none"
          />
        </div>
      </section>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/5 bg-gorola-mint/5">
                <th className="px-3 py-2.5 text-[10px] font-bold text-gorola-slate/60 uppercase tracking-wider">Timestamp</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-gorola-slate/60 uppercase tracking-wider">Actor (masked)</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-gorola-slate/60 uppercase tracking-wider text-center">Role</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-gorola-slate/60 uppercase tracking-wider">Action</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-gorola-slate/60 uppercase tracking-wider">Entity</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-gorola-slate/60 uppercase tracking-wider">Entity ID</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-gorola-slate/60 uppercase tracking-wider">IP (masked)</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-gorola-slate/60 uppercase tracking-wider text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gorola-charcoal/[0.03]">
              {items.map((log) => {
                const isExpanded = expandedLogIds.has(log.id);
                return (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-gorola-mint/5 transition-colors">
                      <td className="px-3 py-2.5 text-[10px] text-gorola-slate font-medium whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-gorola-charcoal whitespace-nowrap">{log.actorMasked}</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getRoleBadgeClass(log.actorRole)}`}>
                          {log.actorRole}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-gorola-pine whitespace-nowrap">{log.action}</td>
                      <td className="px-3 py-2.5 text-[10px] text-gorola-slate whitespace-nowrap">{log.entityType}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px] font-medium text-gorola-charcoal">
                        {log.entityType === "Store" ? (
                          <Link
                            to={getScopedPath(`/admin/stores/${log.entityId}`, "admin", isSubdomainMode)}
                            className="text-gorola-pine hover:underline font-bold"
                          >
                            #{log.entityId.slice(-8).toUpperCase()}
                          </Link>
                        ) : (
                          `#${log.entityId.slice(-8).toUpperCase()}`
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] font-mono text-gorola-slate whitespace-nowrap">{log.ipMasked}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => toggleExpandLog(log.id)}
                          data-testid={`expand-log-${log.id}`}
                          className="p-1 border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-lg text-gorola-pine hover:bg-gorola-mint/5 transition-all inline-flex items-center gap-0.5"
                        >
                          <Eye className="h-3 w-3" />
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${log.id}-expanded`} className="bg-gorola-mint/[0.02] border-l-2 border-gorola-pine">
                        <td colSpan={8} className="p-5">
                          <div className="space-y-4">
                            <div className="text-xs text-gorola-slate flex items-center gap-2">
                              <span className="font-bold text-[10px] uppercase tracking-wider text-gorola-slate/60">User Agent:</span>
                              <span className="font-mono text-[11px] bg-gorola-charcoal/5 px-2 py-0.5 rounded-lg">{log.userAgent || "Unknown Client"}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Before Change (oldValue)</div>
                                <pre className="bg-rose-50/40 text-rose-950 p-4 rounded-2xl overflow-x-auto max-h-60 border border-rose-100/50">
                                  {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : "No record (Created)"}
                                </pre>
                              </div>
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">After Change (newValue)</div>
                                <pre className="bg-emerald-50/40 text-emerald-950 p-4 rounded-2xl overflow-x-auto max-h-60 border border-emerald-100/50">
                                  {log.newValue ? JSON.stringify(log.newValue, null, 2) : "No record (Deleted)"}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-sm text-gorola-slate/60 italic text-center">
                    No audit logs matching filters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && (data.nextCursor || cursorIndex > 0) && (
          <div className="flex justify-center items-center gap-4 py-4 border-t border-gorola-charcoal/5 bg-gorola-mint/5">
            <button
              disabled={cursorIndex === 0}
              onClick={() => setCursorIndex((idx) => Math.max(idx - 1, 0))}
              className="px-4 py-2 bg-white border border-gorola-charcoal/10 hover:border-gorola-pine/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-gorola-slate">Page {cursorIndex + 1}</span>
            <button
              disabled={!data.nextCursor}
              onClick={() => {
                if (data.nextCursor) {
                  setCursors((prev) => {
                    const nextList = [...prev.slice(0, cursorIndex + 1), data.nextCursor];
                    return nextList;
                  });
                  setCursorIndex((idx) => idx + 1);
                }
              }}
              className="px-4 py-2 bg-white border border-gorola-charcoal/10 hover:border-gorola-pine/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
