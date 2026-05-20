import { beforeEach, describe, expect, it } from "vitest";

import { resolveSubdomain } from "./subdomain-resolver";

describe("resolveSubdomain", () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Reset query parameters by modifying location object helper
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
  });

  describe("Native Hostname Detection", () => {
    it("returns standard mode for localhost", () => {
      const res = resolveSubdomain("localhost");
      expect(res.isSubdomainMode).toBe(false);
      expect(res.subdomain).toBe(null);
    });

    it("returns store subdomain mode for store.gorola.com", () => {
      const res = resolveSubdomain("store.gorola.com");
      expect(res.isSubdomainMode).toBe(true);
      expect(res.subdomain).toBe("store");
    });

    it("returns admin subdomain mode for admin.gorola.com", () => {
      const res = resolveSubdomain("admin.gorola.com");
      expect(res.isSubdomainMode).toBe(true);
      expect(res.subdomain).toBe("admin");
    });

    it("returns rider subdomain mode for rider.gorola.com", () => {
      const res = resolveSubdomain("rider.gorola.com");
      expect(res.isSubdomainMode).toBe(true);
      expect(res.subdomain).toBe("rider");
    });
  });

  describe("Query Parameter Override & Persistence", () => {
    it("handles ?_subdomain=store override and persists it in sessionStorage", () => {
      // Mock search params
      window.history.replaceState({}, "", "/?_subdomain=store");

      const res = resolveSubdomain("gorola-staging.vercel.app");
      expect(res.isSubdomainMode).toBe(true);
      expect(res.subdomain).toBe("store");
      expect(sessionStorage.getItem("gorola_subdomain_override")).toBe("store");
    });

    it("reads persisted override from sessionStorage even when query param is gone", () => {
      sessionStorage.setItem("gorola_subdomain_override", "admin");

      const res = resolveSubdomain("gorola-staging.vercel.app");
      expect(res.isSubdomainMode).toBe(true);
      expect(res.subdomain).toBe("admin");
    });

    it("clears the override when ?_subdomain=clear is provided", () => {
      sessionStorage.setItem("gorola_subdomain_override", "store");
      window.history.replaceState({}, "", "/?_subdomain=clear");

      const res = resolveSubdomain("gorola-staging.vercel.app");
      expect(res.isSubdomainMode).toBe(false);
      expect(res.subdomain).toBe(null);
      expect(sessionStorage.getItem("gorola_subdomain_override")).toBeNull();
    });

    it("stops returning subdomain mode after sessionStorage override is cleared manually", () => {
      sessionStorage.setItem("gorola_subdomain_override", "store");

      let res = resolveSubdomain("localhost");
      expect(res.isSubdomainMode).toBe(true);
      expect(res.subdomain).toBe("store");

      sessionStorage.removeItem("gorola_subdomain_override");

      res = resolveSubdomain("localhost");
      expect(res.isSubdomainMode).toBe(false);
      expect(res.subdomain).toBe(null);
    });
  });
});
