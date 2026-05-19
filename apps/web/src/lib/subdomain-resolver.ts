export function resolveSubdomain(hostname: string) {
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
