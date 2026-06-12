import { useQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { type ReactElement, useEffect } from "react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type Advertisement = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
};

export function AdvertisementBanner(): ReactElement | null {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["advertisements"],
    queryFn: async () => {
      if (api === null) {
        throw new Error("API client is not configured");
      }
      const response = await api.get<{ success: boolean; data: Advertisement[] }>(
        "/api/v1/promotions/advertisements"
      );
      return response.data.data;
    }
  });

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" }, [
    Autoplay({ delay: 5000, stopOnInteraction: false })
  ]);

  useEffect(() => {
    if (emblaApi) {
      // Any manual control or events if needed
    }
  }, [emblaApi]);

  if (isLoading) {
    return (
      <div className="px-6 sm:px-10" data-testid="ads-skeleton">
        <Skeleton className="aspect-[16/9] w-full rounded-2xl sm:aspect-[3/1]" />
      </div>
    );
  }

  if (isError || !data || data.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden py-2" aria-label="Promotions">
      <div className="embla overflow-hidden px-0" ref={emblaRef}>
        <div className="embla__container flex">
          {data.map((ad) => {
            const content = (
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl sm:aspect-[3/1]">
                <img
                  src={ad.imageUrl}
                  alt={ad.title}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6">
                  <h3 className="font-playfair text-xl text-white sm:text-3xl">{ad.title}</h3>
                </div>
              </div>
            );

            return (
              <div key={ad.id} data-testid="ad-slide" className="embla__slide min-w-0 flex-[0_0_92%] sm:flex-[0_0_94%] px-2 sm:px-3">
                {ad.linkUrl ? (
                  <Link to={ad.linkUrl} className="block outline-none ring-gorola-saffron focus-visible:ring-2">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
