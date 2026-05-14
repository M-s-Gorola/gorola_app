import gsap from "gsap";
import { type ReactElement, useEffect, useMemo, useRef } from "react";

import { TopographicBg } from "@/components/shared/TopographicBg";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useWeatherStore } from "@/store/weather.store";

export function HeroSection(): ReactElement {
  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);
  const name = useAuthStore((s) => s.name);
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);
  const rootRef = useRef<HTMLElement | null>(null);

  // Randomize messaging on mount
  const messages = useMemo(() => {
    const weatherHeadings = [
      "We’re out there so you can stay in.",
      "Roads are slow — we're still coming!",
      "The weather showed up. So did we.",
    ];
    const weatherETAs = [
      "We are delivering safely.",
      "We’re driving safe so you don’t have to.",
      "Our riders aren’t auditioning for action movies.",
      "Even the clouds are slowing traffic today",
    ];
    const normalHeadings = [
      "What do you need delivered today?",
      "What should arrive at your door today?",
      "Last-minute? We’ve got you.",
    ];
    const normalETAs = [
      "These are hill roads!",
      "Hill roads. Scenic, not speedy.",
      "Good things take time in the mountains.",
      "Blame the mountains",
      "Our riders are basically mountain goats now.",
      "We brake for blind turns.",
    ];

    return {
      weatherHeading: weatherHeadings[Math.floor(Math.random() * weatherHeadings.length)],
      weatherETA: weatherETAs[Math.floor(Math.random() * weatherETAs.length)],
      normalHeading: normalHeadings[Math.floor(Math.random() * normalHeadings.length)],
      normalETA: normalETAs[Math.floor(Math.random() * normalETAs.length)],
    };
  }, []);

  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour >= 5 && hour < 12) greeting = "Good morning";
  else if (hour >= 12 && hour < 17) greeting = "Good afternoon";

  // Fallback logic: 
  // 1. Show '...' while checking session.
  // 2. If logged in but name is missing (rare), show '...' to avoid Mussoorie flicker.
  // 3. If confirmed anonymous (role is null), show 'Mussoorie'.
  const displayName = useMemo(() => {
    if (isBootstrapPending) return "...";
    if (name && name.trim().length > 0) return name.trim();
    return "Mussoorie";
  }, [name, isBootstrapPending]);

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
      <TopographicBg opacity={isWeatherMode ? 0.1 : 0.07} />
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
            {isWeatherMode ? messages.weatherHeading : messages.normalHeading}
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
              "hero-eta flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[11px] font-medium text-gorola-fog transition-colors sm:inline-flex sm:w-fit sm:gap-3 sm:text-sm",
              "w-full"
            )}
            role="status"
            data-testid="eta-banner"
          >
            <div className="flex shrink-0 items-center gap-2">
              <span className="hero-pulse h-2 w-2 rounded-full bg-gorola-amber" data-testid="pulse-dot" />
              <span className="font-bold text-white">
                {isWeatherMode ? "45-55 mins" : "25-35 mins"}
              </span>
            </div>
            <div className="w-px self-stretch bg-white/20" aria-hidden />
            <span className="opacity-80 whitespace-normal leading-tight">
              {isWeatherMode ? messages.weatherETA : messages.normalETA}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
