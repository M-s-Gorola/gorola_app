import type { ChangeEvent, ReactElement } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/lib/api";
import { enqueueCartVariantMutation } from "@/lib/cart-variant-mutation-queue";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useFeatureFlagsStore } from "@/store/feature-flags.store";

const DELIVERY_FEE = 30;
type PaymentMethod = "COD" | "UPI" | "CARD";

export function CartDrawer(): ReactElement | null {
  const navigate = useNavigate();
  const isOpen = useCartStore((s) => s.isOpen);
  const close = useCartStore((s) => s.close);
  const lines = useCartStore((s) => s.lines);
  const removeLine = useCartStore((s) => s.removeLine);
  const setQty = useCartStore((s) => s.setQty);
  const discountCode = useCartStore((s) => s.discountCode);
  const savedAmount = useCartStore((s) => s.discountSavedAmount);
  const discountError = useCartStore((s) => s.discountError);
  const setDiscountState = useCartStore((s) => s.setDiscountState);
  const userId = useAuthStore((s) => s.userId);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const upiEnabled = useFeatureFlagsStore((s) => s.getFlag("PAYMENT_UPI_ENABLED"));
  const cardEnabled = useFeatureFlagsStore((s) => s.getFlag("PAYMENT_CARD_ENABLED"));

  const subtotal = useMemo(
    () => lines.reduce((acc, line) => acc + (line.unitPrice ?? 0) * line.quantity, 0),
    [lines]
  );
  const total = Math.max(subtotal + DELIVERY_FEE - savedAmount, 0);

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-gorola-pine/10 bg-white p-4 shadow-xl md:inset-y-0 md:right-0 md:max-h-none md:w-full md:max-w-md md:rounded-none md:border-l md:border-t-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-playfair text-2xl text-gorola-charcoal">Your cart</h2>
        <button
          type="button"
          aria-label="Close cart"
          onClick={close}
          className="rounded-full border border-gorola-pine/20 px-3 py-1 text-sm text-gorola-charcoal"
        >
          Close
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="font-dm-sans text-sm text-gorola-slate">Your cart is empty - go find something good</p>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => (
            <article key={line.productVariantId} className="rounded-xl border border-gorola-pine/10 p-3">
              <p className="font-dm-sans text-sm font-semibold text-gorola-charcoal">{line.productName ?? "Item"}</p>
              <p className="font-dm-sans text-xs text-gorola-slate">{line.variantLabel ?? "Variant"}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease ${line.productName ?? "item"} quantity`}
                  onClick={() => {
                    const next = line.quantity - 1;
                    setQty(line.productVariantId, next);
                    if (api !== null && userId !== null) {
                      const client = api;
                      const variantId = line.productVariantId;
                      void enqueueCartVariantMutation(variantId, async () => {
                        if (next <= 0) {
                          await client.delete(`/api/v1/cart/items/${variantId}`);
                        } else {
                          await client.put(`/api/v1/cart/items/${variantId}`, {
                            quantity: next
                          });
                        }
                      });
                    }
                  }}
                  className="h-7 w-7 rounded-full border border-gorola-pine/20 text-sm"
                >
                  -
                </button>
                <span className="font-dm-sans text-sm text-gorola-charcoal">{line.quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase ${line.productName ?? "item"} quantity`}
                  onClick={() => {
                    const next = line.quantity + 1;
                    setQty(line.productVariantId, next);
                    if (api !== null && userId !== null) {
                      const client = api;
                      const variantId = line.productVariantId;
                      void enqueueCartVariantMutation(variantId, async () => {
                        await client.put(`/api/v1/cart/items/${variantId}`, {
                          quantity: next
                        });
                      });
                    }
                  }}
                  className="h-7 w-7 rounded-full border border-gorola-pine/20 text-sm"
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${line.productName ?? "item"}`}
                  onClick={() => {
                    removeLine(line.productVariantId);
                    if (api !== null && userId !== null) {
                      const client = api;
                      const variantId = line.productVariantId;
                      void enqueueCartVariantMutation(variantId, async () => {
                        await client.delete(`/api/v1/cart/items/${variantId}`);
                      });
                    }
                  }}
                  className="ml-auto text-xs font-semibold text-gorola-slate"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-gorola-pine/10 pt-3">
        {lines.length > 0 ? (
          <p className="rounded-lg bg-gorola-saffron/10 px-2 py-1 font-dm-sans text-xs font-semibold text-gorola-charcoal">
            Active offers and discounts may apply at checkout
          </p>
        ) : null}
        <p className="font-dm-sans text-sm text-gorola-charcoal">Subtotal: Rs {subtotal.toFixed(2)}</p>
        <p className="font-dm-sans text-sm text-gorola-charcoal">Delivery fee: Rs {DELIVERY_FEE.toFixed(2)}</p>
        <p className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Total: Rs {total.toFixed(2)}</p>
        {savedAmount > 0 ? (
          <p className="font-dm-sans text-sm font-semibold text-gorola-pine">Saved: Rs {savedAmount.toFixed(2)}</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={discountCode}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setDiscountState({
              code: event.target.value,
              error: null,
              savedAmount: 0
            });
          }}
          placeholder="Discount code"
          className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
        />
        <button
          type="button"
          aria-label="Apply"
          onClick={() => {
            if (api === null || discountCode.trim().length === 0) {
              return;
            }
            void api
              .post("/api/v1/promotions/discounts/validate", {
                code: discountCode.trim(),
                subtotal
              })
              .then((response) => {
                const amount = response.data?.data?.amountSaved;
                if (response.data?.success === true && typeof amount === "number") {
                  setDiscountState({
                    code: discountCode.trim(),
                    error: null,
                    savedAmount: amount
                  });
                  return;
                }
                setDiscountState({
                  code: discountCode.trim(),
                  error: "Invalid or expired discount code",
                  savedAmount: 0
                });
              })
              .catch(() => {
                setDiscountState({
                  code: discountCode.trim(),
                  error: "Could not validate discount code right now",
                  savedAmount: 0
                });
              });
          }}
          className="rounded-lg bg-gorola-pine px-3 py-2 font-dm-sans text-sm font-semibold text-white"
        >
          Apply
        </button>
      </div>
      {discountError !== null ? (
        <p className="mt-1 font-dm-sans text-xs font-semibold text-red-600">{discountError}</p>
      ) : null}

      <fieldset className="mt-4 space-y-2">
        <legend className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Payment method</legend>
        <label className="flex items-center gap-2 font-dm-sans text-sm text-gorola-charcoal">
          <input
            type="radio"
            name="payment-method"
            aria-label="Cash on Delivery"
            checked={paymentMethod === "COD"}
            onChange={() => {
              setPaymentMethod("COD");
            }}
          />
          Cash on Delivery
        </label>
        <label className="flex items-center gap-2 font-dm-sans text-sm text-gorola-charcoal">
          <input
            type="radio"
            name="payment-method"
            aria-label="UPI"
            checked={paymentMethod === "UPI"}
            disabled={!upiEnabled}
            onChange={() => {
              setPaymentMethod("UPI");
            }}
          />
          UPI
        </label>
        <label className="flex items-center gap-2 font-dm-sans text-sm text-gorola-charcoal">
          <input
            type="radio"
            name="payment-method"
            aria-label="Card"
            checked={paymentMethod === "CARD"}
            disabled={!cardEnabled}
            onChange={() => {
              setPaymentMethod("CARD");
            }}
          />
          Card
        </label>
      </fieldset>
      <button
        type="button"
        aria-label="Proceed to Checkout"
        disabled={lines.length === 0}
        onClick={() => {
          if (lines.length === 0) {
            return;
          }
          navigate("/checkout");
          close();
        }}
        className="mt-4 w-full rounded-full bg-gorola-pine px-5 py-2 font-dm-sans text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Proceed to Checkout
      </button>
    </aside>
  );
}
