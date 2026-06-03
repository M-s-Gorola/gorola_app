import type { ReactElement } from "react";
import { Link, Route, useLocation } from "react-router-dom";

import { BuyerLayout } from "@/components/buyer/BuyerLayout";
import { BookingConfirmationPage } from "@/pages/buyer/BookingConfirmationPage";
import { BookingTimeslotPage } from "@/pages/buyer/BookingTimeslotPage";
import { CategoryPage } from "@/pages/buyer/CategoryPage";
import { CheckoutPage } from "@/pages/buyer/CheckoutPage";
import { HomePage } from "@/pages/buyer/HomePage";
import { LoginPage } from "@/pages/buyer/LoginPage";
import { OrderConfirmationPage } from "@/pages/buyer/OrderConfirmationPage";
import { OrderHistoryPage } from "@/pages/buyer/OrderHistoryPage";
import { ProductDetailPage } from "@/pages/buyer/ProductDetailPage";
import { ProfilePage } from "@/pages/buyer/ProfilePage";
import { SavedAddressesPage } from "@/pages/buyer/SavedAddressesPage";
import { SearchResultsPage } from "@/pages/buyer/SearchResultsPage";
import { StoreDetailPage } from "@/pages/buyer/StoreDetailPage";
import { SubCategoryPage } from "@/pages/buyer/SubCategoryPage";

import { ProtectedRoute } from "./guards";

function PlaceholderPage({ title }: { title: string }): ReactElement {
  const { pathname } = useLocation();
  const backTo = pathname.startsWith("/store") ? "/store/dashboard" : "/";

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold text-gorola-charcoal">{title}</h1>
      <p className="font-dm-sans text-sm text-gorola-slate">This page is not ready yet.</p>
      <Link
        to={backTo}
        className="inline-flex rounded-full border border-gorola-pine/20 px-3 py-2 text-sm font-semibold text-gorola-pine hover:bg-gorola-pine/5"
      >
        Back to Home
      </Link>
    </section>
  );
}

export function BuyerRoutes(): ReactElement[] {
  return [
    <Route
      key="buyer-home"
      path="/"
      element={
        <BuyerLayout>
          <HomePage />
        </BuyerLayout>
      }
    />,
    <Route
      key="buyer-search"
      path="/search"
      element={
        <BuyerLayout>
          <SearchResultsPage />
        </BuyerLayout>
      }
    />,
    <Route
      key="buyer-category"
      path="/categories/:slug"
      element={
        <BuyerLayout>
          <CategoryPage />
        </BuyerLayout>
      }
    />,
    <Route
      key="buyer-subcategory"
      path="/categories/:categorySlug/:subCategorySlug"
      element={
        <BuyerLayout>
          <SubCategoryPage />
        </BuyerLayout>
      }
    />,
    <Route
      key="buyer-product-detail"
      path="/products/:id"
      element={
        <BuyerLayout>
          <ProductDetailPage />
        </BuyerLayout>
      }
    />,
    <Route
      key="buyer-store-detail"
      path="/store/:id"
      element={
        <BuyerLayout>
          <StoreDetailPage />
        </BuyerLayout>
      }
    />,
    <Route
      key="buyer-cart"
      path="/cart"
      element={
        <BuyerLayout>
          <PlaceholderPage title="Cart" />
        </BuyerLayout>
      }
    />,
    <Route
      key="buyer-about"
      path="/about"
      element={
        <BuyerLayout>
          <PlaceholderPage title="About" />
        </BuyerLayout>
      }
    />,
    <Route
      key="buyer-support"
      path="/support"
      element={
        <BuyerLayout>
          <PlaceholderPage title="Support" />
        </BuyerLayout>
      }
    />,
    <Route key="buyer-login" path="/login" element={<LoginPage />} />,
    <Route
      key="buyer-profile"
      path="/profile"
      element={
        <ProtectedRoute>
          <BuyerLayout>
            <ProfilePage />
          </BuyerLayout>
        </ProtectedRoute>
      }
    />,
    <Route
      key="buyer-addresses"
      path="/account/addresses"
      element={
        <ProtectedRoute>
          <BuyerLayout>
            <SavedAddressesPage />
          </BuyerLayout>
        </ProtectedRoute>
      }
    />,
    <Route
      key="buyer-orders"
      path="/account/orders"
      element={
        <ProtectedRoute>
          <BuyerLayout>
            <OrderHistoryPage />
          </BuyerLayout>
        </ProtectedRoute>
      }
    />,
    <Route
      key="buyer-checkout"
      path="/checkout"
      element={
        <ProtectedRoute>
          <BuyerLayout>
            <CheckoutPage />
          </BuyerLayout>
        </ProtectedRoute>
      }
    />,
    <Route
      key="buyer-booking-new"
      path="/bookings/new"
      element={
        <ProtectedRoute>
          <BuyerLayout>
            <BookingTimeslotPage />
          </BuyerLayout>
        </ProtectedRoute>
      }
    />,
    <Route
      key="buyer-booking-confirmation"
      path="/bookings/:id"
      element={
        <ProtectedRoute>
          <BuyerLayout>
            <BookingConfirmationPage />
          </BuyerLayout>
        </ProtectedRoute>
      }
    />,
    <Route
      key="buyer-order-confirmation"
      path="/orders/:id"
      element={
        <ProtectedRoute>
          <BuyerLayout>
            <OrderConfirmationPage />
          </BuyerLayout>
        </ProtectedRoute>
      }
    />
  ];
}
