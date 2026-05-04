import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { Link, Route, Routes, useSearchParams } from "react-router-dom";

import { AdminRoute, ProtectedRoute, StoreRoute } from "@/app/routes/guards";
import { BuyerLayout } from "@/components/buyer/BuyerLayout";
import { DevWeatherToggle } from "@/components/shared/DevWeatherToggle";
import { Toaster } from "@/components/ui/sonner";
import { useGorolaMotion } from "@/hooks/useGorolaMotion";
import { useWeatherSync } from "@/hooks/useWeatherSync";
import { bootstrapBuyerAuthSession } from "@/lib/api";
import { createAppQueryClient } from "@/lib/query-client";
import { CategoryPage } from "@/pages/buyer/CategoryPage";
import { CheckoutPage } from "@/pages/buyer/CheckoutPage";
import { HomePage } from "@/pages/buyer/HomePage";
import { LoginPage } from "@/pages/buyer/LoginPage";
import { OrderConfirmationPage } from "@/pages/buyer/OrderConfirmationPage";
import { OrderHistoryPage } from "@/pages/buyer/OrderHistoryPage";
import { ProductDetailPage } from "@/pages/buyer/ProductDetailPage";
import { SavedAddressesPage } from "@/pages/buyer/SavedAddressesPage";
import { useWeatherStore } from "@/store/weather.store";

const queryClient = createAppQueryClient();

function PlaceholderPage({ title }: { title: string }): ReactElement {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold text-gorola-charcoal">{title}</h1>
      <p className="font-dm-sans text-sm text-gorola-slate">This page is not ready yet.</p>
      <Link
        to="/"
        className="inline-flex rounded-full border border-gorola-pine/20 px-3 py-2 text-sm font-semibold text-gorola-pine hover:bg-gorola-pine/5"
      >
        Back to Home
      </Link>
    </section>
  );
}

function SearchPlaceholderPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const title = query.length > 0 ? `Search results for "${query}"` : "Search";

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold text-gorola-charcoal">{title}</h1>
      <p className="font-dm-sans text-sm text-gorola-slate">
        Search results page is under active development.
      </p>
      <Link
        to="/"
        className="inline-flex rounded-full border border-gorola-pine/20 px-3 py-2 text-sm font-semibold text-gorola-pine hover:bg-gorola-pine/5"
      >
        Back to Home
      </Link>
    </section>
  );
}

export function App(): ReactElement {
  useGorolaMotion();
  useWeatherSync();

  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);

  useEffect(() => {
    void bootstrapBuyerAuthSession();
  }, []);

  useEffect(() => {
    if (isWeatherMode) {
      document.body.classList.add("weather-mode");
    } else {
      document.body.classList.remove("weather-mode");
    }
  }, [isWeatherMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route
          path="/"
          element={
            <BuyerLayout>
              <HomePage />
            </BuyerLayout>
          }
        />
        <Route
          path="/search"
          element={
            <BuyerLayout>
              <SearchPlaceholderPage />
            </BuyerLayout>
          }
        />
        <Route
          path="/categories/:slug"
          element={
            <BuyerLayout>
              <CategoryPage />
            </BuyerLayout>
          }
        />
        <Route
          path="/products/:id"
          element={
            <BuyerLayout>
              <ProductDetailPage />
            </BuyerLayout>
          }
        />
        <Route
          path="/cart"
          element={
            <BuyerLayout>
              <PlaceholderPage title="Cart" />
            </BuyerLayout>
          }
        />
        <Route
          path="/about"
          element={
            <BuyerLayout>
              <PlaceholderPage title="About" />
            </BuyerLayout>
          }
        />
        <Route
          path="/support"
          element={
            <BuyerLayout>
              <PlaceholderPage title="Support" />
            </BuyerLayout>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <BuyerLayout>
                <PlaceholderPage title="Profile" />
              </BuyerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/addresses"
          element={
            <ProtectedRoute>
              <BuyerLayout>
                <SavedAddressesPage />
              </BuyerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders"
          element={
            <ProtectedRoute>
              <BuyerLayout>
                <OrderHistoryPage />
              </BuyerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <BuyerLayout>
                <CheckoutPage />
              </BuyerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <BuyerLayout>
                <OrderConfirmationPage />
              </BuyerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/store"
          element={
            <StoreRoute>
              <PlaceholderPage title="Store Dashboard" />
            </StoreRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <PlaceholderPage title="Admin Dashboard" />
            </AdminRoute>
          }
        />
      </Routes>
      <Toaster position="bottom-left" />
      <DevWeatherToggle />
    </QueryClientProvider>
  );
}
