import { type ClassValue,clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatStatusLabel(status: string, orderType?: string | null): string {
  if (!status) return "";
  const normalized = status.toUpperCase().trim();

  if (orderType === "BOOKING" || orderType === "BOOKING_COMMERCE") {
    switch (normalized) {
      case "OUT_FOR_DELIVERY":
      case "ON_THE_WAY":
        return "On The Way";
      case "DELIVERED":
      case "COMPLETED":
        return "Completed";
      case "PENDING_APPROVAL":
        return "Pending Approval";
      case "APPROVED":
        return "Approved";
      case "CONFIRMED":
        return "Confirmed";
      case "CANCELLED":
        return "Cancelled";
      case "REJECTED":
        return "Rejected";
    }
  }

  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatCurrency(val: number | string | undefined | null): string {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0));
  return `Rs ${isNaN(num) ? "0.00" : num.toFixed(2)}`;
}

export function getStatusBadgeClasses(status: string): string {
  if (!status) return "bg-slate-50 text-slate-700 border border-slate-200";
  const normalized = status.toUpperCase().trim();

  switch (normalized) {
    case "DELIVERED":
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "OUT_FOR_DELIVERY":
    case "ON_THE_WAY":
      return "bg-blue-50 text-blue-800 border border-blue-200";
    case "PREPARING":
    case "APPROVED":
    case "CONFIRMED":
      return "bg-indigo-50 text-indigo-800 border border-indigo-200";
    case "PLACED":
    case "PENDING_APPROVAL":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "CANCELLED":
    case "REJECTED":
      return "bg-red-50 text-red-800 border border-red-200";
    default:
      return "bg-slate-50 text-slate-800 border border-slate-200";
  }
}



