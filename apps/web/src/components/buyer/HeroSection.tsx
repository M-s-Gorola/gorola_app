import gsap from "gsap";
import { type ReactElement, useEffect, useRef } from "react";

import { TopographicBg } from "@/components/shared/TopographicBg";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useWeatherStore } from "@/store/weather.store";

export function HeroSection(): ReactElement {
  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);
  const name = useAuthStore((s) => s.name);
  const rootRef = useRef<HTMLElement | null>(null);

  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour >= 5 && hour < 12) greeting = "Good morning";
  else if (hour >= 12 && hour < 17) greeting = "Good afternoon";

  const displayName = name && name.trim().length > 0 ? name.trim() : "Mussoorie";

  useEffect(() => {
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline();

      timeline
        .fromTo(".hero-greeting", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
        .fromTo(".hero-subheading", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.2)
        .fromTo(".hero-cta", { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 }, 0.5)
        .fromTo(".hero-eta", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.7);

      // Pulse animation for the delivery safely/hill roads text
      gsap.to(".hero-pulse", {
        opacity: 0.6,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, rootRef);

    return () => {
      ctx.revert();
    };
  }, []);

  const scrollToCategories = (): void => {
    document.getElementById("home-categories")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      ref={rootRef}
      aria-label="Hero section"
      className={cn(
        "relative flex min-h-[40vh] items-center overflow-hidden rounded-3xl px-6 py-12 transition-colors duration-500 sm:px-10",
        isWeatherMode
          ? "bg-gorola-slate text-gorola-fog"
          : "bg-gorola-pine text-gorola-fog"
      )}
    >
      <TopographicBg opacity={isWeatherMode ? 0.08 : 0.12} />
      <div className="noise-overlay pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 flex max-w-none flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="hero-greeting font-dm-sans text-sm font-medium tracking-wide text-gorola-fog/70 sm:text-base">
            {isWeatherMode ? (
              <span className="inline-flex items-center gap-2">
                <span role="img" aria-label="Cloud with sun">⛅</span> Weather Mode active
              </span>
            ) : (
              `${greeting}, ${displayName}`
            )}
          </p>
          <h1 className="hero-subheading font-playfair text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-[52px] lg:text-6xl text-white">
            {isWeatherMode ? "Roads are foggy — we're still coming!" : "What do you need delivered today?"}
          </h1>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            className="hero-cta rounded-full bg-gorola-saffron px-8 py-3 font-dm-sans text-sm font-semibold text-gorola-charcoal shadow-lg transition hover:scale-105 active:scale-95"
            onClick={scrollToCategories}
          >
            Shop Now
          </button>

          <div
            className={cn(
              "hero-eta inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition-colors bg-white/10 text-gorola-fog"
            )}
            role="status"
          >
            <div className="flex items-center gap-2">
              <span className="hero-pulse h-2 w-2 rounded-full bg-gorola-amber" />
              <span className="font-bold text-white">
                {isWeatherMode ? "45-55 mins" : "25-35 mins"}
              </span>
            </div>
            <span className="h-4 w-px bg-white/20" aria-hidden />
            <span className="opacity-80">
              {isWeatherMode ? "We are delivering safely." : "These are hill roads!"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
