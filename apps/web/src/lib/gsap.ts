import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

const DEFAULT_LAG_SMOOTHING: [number, number] = [500, 33];

let configured = false;

/**
 * One-time: register ScrollTrigger, set global tween defaults (matches motion system).
 */
export function initGorolaGsapOnce(): void {
  if (configured) {
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power2.out", duration: 0.8 });
  configured = true;
}

/**
 * Lenis README: connect ScrollTrigger to Lenis scroll, drive `lenis.raf` from
 * the GSAP ticker, and turn off lag smoothing. Returns a cleanup that
 * un-subscribes and restores ticker lag defaults.
 */
export function linkLenisToGsapTicker(lenis: Lenis): () => void {
  initGorolaGsapOnce();

  const offScroll = lenis.on("scroll", ScrollTrigger.update);

  const onGsapTick = (time: number): void => {
    lenis.raf(time * 1000);
  };
  const onGsapTickRef = gsap.ticker.add(onGsapTick);

  gsap.ticker.lagSmoothing(0);

  return () => {
    offScroll();
    gsap.ticker.remove(onGsapTickRef);
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    gsap.ticker.lagSmoothing(
      DEFAULT_LAG_SMOOTHING[0],
      DEFAULT_LAG_SMOOTHING[1]
    );
  };
}
