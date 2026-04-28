import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Route, Routes } from "react-router-dom";

import { AdminRoute, ProtectedRoute, StoreRoute } from "@/app/routes/guards";
import { BuyerLayout } from "@/components/buyer/BuyerLayout";
import { Toaster } from "@/components/ui/sonner";
import { useGorolaMotion } from "@/hooks/useGorolaMotion";
import { createAppQueryClient } from "@/lib/query-client";
import { HomePage } from "@/pages/HomePage";

const queryClient = createAppQueryClient();

function PlaceholderPage({ title }: { title: string }): ReactElement {
  return <h1 className="text-2xl font-semibold text-gorola-charcoal">{title}</h1>;
}

export function App(): ReactElement {
  useGorolaMotion();
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
              <PlaceholderPage title="Search" />
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
        <Route path="/login" element={<PlaceholderPage title="Login Page" />} />
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
      <Toaster />
    </QueryClientProvider>
  );
}
