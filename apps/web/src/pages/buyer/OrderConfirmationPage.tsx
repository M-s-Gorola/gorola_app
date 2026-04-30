import type { ReactElement } from "react";
import { useParams } from "react-router-dom";

export function OrderConfirmationPage(): ReactElement {
  const { id } = useParams<{ id: string }>();

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-gorola-charcoal">Order Confirmation</h1>
      <p className="text-sm text-gorola-charcoal/70">Order ID: {id ?? "unknown"}</p>
    </section>
  );
}
