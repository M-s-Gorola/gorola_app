import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";

import { api } from "@/lib/api";

type OrderConfirmationEnvelope = {
  success?: boolean;
  data?: {
    id: string;
    subtotal: string;
    deliveryFee: string;
    total: string;
    paymentMethod: string;
    discount?: {
      amount: string;
      code: string | null;
    };
  };
};

export function OrderConfirmationPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    enabled: api !== null && id !== undefined,
    queryKey: ["buyer-order-confirmation", id ?? null],
    queryFn: async () => {
      const response = await api!.get<OrderConfirmationEnvelope>(`/api/v1/orders/${id}`);
      const payload = response.data;
      if (payload.success !== true || payload.data === undefined) {
        throw new Error("Invalid order confirmation response");
      }
      return payload.data;
    }
  });

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-gorola-charcoal">Order Confirmation</h1>
      <p className="text-sm text-gorola-charcoal/70">Order ID: {id ?? "unknown"}</p>
      {query.isSuccess ? (
        (() => {
          const discountAmount = query.data.discount?.amount ?? "0.00";
          return (
            <div className="space-y-1 font-dm-sans text-sm text-gorola-charcoal">
              <p>Subtotal: Rs {query.data.subtotal}</p>
              <p>Delivery fee: Rs {query.data.deliveryFee}</p>
              {discountAmount !== "0.00" ? <p>Discount: -Rs {discountAmount}</p> : null}
              <p className="font-semibold">Total: Rs {query.data.total}</p>
              <p>Payment: {query.data.paymentMethod}</p>
            </div>
          );
        })()
      ) : null}
    </section>
  );
}
