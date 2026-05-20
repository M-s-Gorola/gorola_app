import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { initGorolaGsapOnce, linkLenisToGsapTicker } from "@/lib/gsap";
import { createGorolaLenis, destroyGorolaLenis, lenis } from "@/lib/lenis";

/**
 * Mount once: GSAP (ScrollTrigger + defaults), Lenis, ticker bridge. Tears
 * down fully on unmount (StrictMode / route changes).
 * Also listens to route transitions and resets/recalculates scroll state.
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
    // When navigating to a new page, immediately scroll to the top and reset Lenis state
    if (lenis !== null) {
      lenis.scrollTo(0, { immediate: true });
      lenis.resize();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
}
