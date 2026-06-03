import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { initGorolaGsapOnce, linkLenisToGsapTicker } from "@/lib/gsap";
import { createGorolaLenis, destroyGorolaLenis } from "@/lib/lenis";
import * as lenisLib from "@/lib/lenis";

/**
 * Initialises GSAP + Lenis on mount and tears them down on unmount.
 *
 * On every route change, snaps scroll to top synchronously then fires a
 * requestAnimationFrame to resize Lenis after the new page's DOM has painted.
 * Using a namespace import (lenisLib.lenis) guarantees we always read the
 * current live value of the exported `let` variable, not a stale snapshot.
 */
export function useGorolaMotion(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    initGorolaGsapOnce();
    const instance = createGorolaLenis();
    const disconnect = linkLenisToGsapTicker(instance);
    return () => {
      disconnect();
      destroyGorolaLenis();
    };
  }, []);

  useEffect(() => {
    const current = lenisLib.lenis;
    if (current !== null) {
      // Snap to top immediately — synchronous, same tick as the route change.
      current.scrollTo(0, { immediate: true });
      // Resize after the browser has painted the new page's DOM so Lenis
      // recalculates scroll limits correctly for the new content height.
      const rafId = requestAnimationFrame(() => {
        lenisLib.lenis?.resize();
      });
      return () => cancelAnimationFrame(rafId);
    }
    window.scrollTo(0, 0);
    return;
  }, [pathname]);
}
