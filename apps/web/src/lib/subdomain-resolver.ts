export function resolveSubdomain(hostname: string) {
  // 1. Check for query parameter override (e.g. ?_subdomain=store) or session storage persistence
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("_subdomain");
    if (override === "store" || override === "admin") {
      sessionStorage.setItem("gorola_subdomain_override", override);
      return { isSubdomainMode: true, subdomain: override as "store" | "admin" };
    }
    if (override === "clear") {
      sessionStorage.removeItem("gorola_subdomain_override");
    } else {
      const savedOverride = sessionStorage.getItem("gorola_subdomain_override");
      if (savedOverride === "store" || savedOverride === "admin") {
        return { isSubdomainMode: true, subdomain: savedOverride as "store" | "admin" };
      }
    }
  }

  // 2. Fall back to standard hostname detection
  const isPureLocal = hostname === "localhost" || hostname === "127.0.0.1";
  if (isPureLocal) {
    return { isSubdomainMode: false, subdomain: null };
  }
  if (hostname.startsWith("store.")) {
    return { isSubdomainMode: true, subdomain: "store" as const };
  }
  if (hostname.startsWith("admin.")) {
    return { isSubdomainMode: true, subdomain: "admin" as const };
  }
  return { isSubdomainMode: false, subdomain: null };
}

export function getScopedPath(target: string, _scope: "store" | "admin" | "buyer", isSubdomain: boolean): string {
  if (isSubdomain) {
    // e.g. '/store/2fa' -> '/2fa' when browsing store.gorola.com
    return target.replace(/^\/(store|admin)/, "") || "/";
  }
  return target;
}
