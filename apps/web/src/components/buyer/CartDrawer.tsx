import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { ChangeEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/lib/api";
import { syncBuyerCartFromServer } from "@/lib/buyer-cart-sync";
import { enqueueCartVariantMutation } from "@/lib/cart-variant-mutation-queue";
import { lenis } from "@/lib/lenis";
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
  const accessToken = useAuthStore((s) => s.accessToken);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const upiEnabled = useFeatureFlagsStore((s) => s.getFlag("PAYMENT_UPI_ENABLED"));
  const cardEnabled = useFeatureFlagsStore((s) => s.getFlag("PAYMENT_CARD_ENABLED"));

  const drawerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      lenis?.stop();
      if (accessToken !== null) {
        void syncBuyerCartFromServer().catch(() => {});
      }
    } else {
      document.body.style.overflow = "";
      lenis?.start();
    }
    return () => {
      document.body.style.overflow = "";
      lenis?.start();
    };
  }, [isOpen, accessToken]);

  useGSAP(() => {
    if (isOpen) {
      gsap.to(backdropRef.current, { opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.to(drawerRef.current, { x: 0, duration: 0.4, ease: "power3.out" });
    } else {
      gsap.to(backdropRef.current, { opacity: 0, duration: 0.2, ease: "power2.in" });
      gsap.to(drawerRef.current, { x: "100%", duration: 0.3, ease: "power3.in" });
    }
  }, [isOpen]);

  const activeOffers = useCartStore((s) => s.activeOffers);

  const subtotal = useMemo(
    () => lines.reduce((acc, line) => acc + (line.unitPrice ?? 0) * line.quantity, 0),
    [lines]
  );

  const appliedOffers = useMemo(() => {
    let currentSaved = 0;
    const list: Array<{ id: string; title: string; savedAmount: number }> = [];
    for (const offer of activeOffers) {
      const minOrder = offer.minOrderAmount ?? 0;
      if (subtotal >= minOrder) {
        let saved = 0;
        if (offer.discountType === "PERCENTAGE") {
          saved = (subtotal * offer.discountValue) / 100;
          if (offer.maxDiscount !== null && offer.maxDiscount !== undefined) {
            saved = Math.min(saved, offer.maxDiscount);
          }
        } else {
          saved = offer.discountValue;
        }
        const eligibleAmount = Math.max(0, Math.min(subtotal - currentSaved, saved));
        if (eligibleAmount > 0) {
          currentSaved += eligibleAmount;
          list.push({
            id: offer.id,
            title: offer.title,
            savedAmount: eligibleAmount
          });
        }
      }
    }
    return list;
  }, [activeOffers, subtotal]);

  const offerSavedAmount = useMemo(() => {
    return appliedOffers.reduce((acc, o) => acc + o.savedAmount, 0);
  }, [appliedOffers]);

  const total = Math.max(subtotal + DELIVERY_FEE - savedAmount - offerSavedAmount, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={close}
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm pointer-events-none opacity-0 ${isOpen ? 'pointer-events-auto' : ''}`}
      />

      <aside
        ref={drawerRef}
        className="fixed top-0 right-0 z-[70] h-[100dvh] w-full max-w-md bg-white shadow-2xl translate-x-full border-l border-gorola-pine/10 flex flex-col overflow-hidden isolate"
      >
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6 scroll-smooth overscroll-contain" data-lenis-prevent>
          <div className="flex items-center justify-between">
            <h2 className="font-playfair text-3xl text-gorola-charcoal">Your cart</h2>
            <button
              type="button"
              aria-label="Close cart"
              onClick={close}
              className="rounded-full border border-gorola-pine/20 px-3 py-1 text-sm text-gorola-charcoal hover:bg-gorola-pine/5 transition-colors"
            >
              Close
            </button>
          </div>

          {lines.length === 0 ? (
            <p className="font-dm-sans text-sm text-gorola-slate">Your cart is empty - go find something good</p>
          ) : (
            <div className="space-y-4">
              {lines.map((line) => (
                <article key={line.productVariantId} className="rounded-2xl border border-gorola-pine/10 p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-dm-sans text-sm font-bold text-gorola-charcoal" data-testid="cart-item-name">{line.productName ?? "Item"}</p>
                      <p className="font-dm-sans text-xs text-gorola-slate">{line.variantLabel ?? "Variant"}</p>
                    </div>
                    <p className="font-dm-sans text-sm font-bold text-gorola-charcoal">
                      Rs {((line.unitPrice ?? 0) * line.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Decrease ${line.productName ?? "item"} quantity`}
                      data-testid="quantity-minus"
                      onClick={() => {
                        const next = line.quantity - 1;
                        setQty(line.productVariantId, next);
                        if (api !== null && accessToken !== null) {
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
                          void syncBuyerCartFromServer();
                        }
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-full border border-gorola-pine/20 text-gorola-charcoal hover:bg-gorola-pine/5 transition-colors"
                    >
                      -
                    </button>
                    <span className="font-dm-sans text-sm font-bold text-gorola-charcoal min-w-[1.5rem] text-center" data-testid="item-quantity">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${line.productName ?? "item"} quantity`}
                      data-testid="quantity-plus"
                      onClick={() => {
                        const next = line.quantity + 1;
                        setQty(line.productVariantId, next);
                        if (api !== null && accessToken !== null) {
                          const client = api;
                          const variantId = line.productVariantId;
                          void enqueueCartVariantMutation(variantId, async () => {
                            await client.put(`/api/v1/cart/items/${variantId}`, {
                              quantity: next
                            });
                          });
                          void syncBuyerCartFromServer();
                        }
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-full border border-gorola-pine/20 text-gorola-charcoal hover:bg-gorola-pine/5 transition-colors"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${line.productName ?? "item"}`}
                      onClick={() => {
                        removeLine(line.productVariantId);
                        if (api !== null && accessToken !== null) {
                          const client = api;
                          const variantId = line.productVariantId;
                          void enqueueCartVariantMutation(variantId, async () => {
                            await client.delete(`/api/v1/cart/items/${variantId}`);
                          });
                          void syncBuyerCartFromServer();
                        }
                      }}
                      className="ml-auto text-xs font-bold text-gorola-slate hover:text-red-600 transition-colors"
                      data-testid="remove-item"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="space-y-4 border-t border-gorola-pine/10 pt-6">
            {lines.length > 0 && activeOffers.length > 0 && (
              <div className="space-y-2">
                {activeOffers.map((offer) => {
                  const minOrder = offer.minOrderAmount ?? 0;
                  const isLocked = subtotal < minOrder;
                  if (isLocked) {
                    return (
                      <div
                        key={offer.id}
                        data-testid={`offer-pill-${offer.id}`}
                        className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 font-dm-sans text-xs font-semibold text-amber-800 flex flex-col gap-0.5"
                      >
                        <div>{offer.title}</div>
                        {offer.minOrderAmount !== null && offer.minOrderAmount !== undefined && offer.minOrderAmount > 0 && (
                          <div className="text-amber-700 font-normal">
                            · Minimum purchase: Rs {offer.minOrderAmount}
                          </div>
                        )}
                        {offer.maxDiscount !== null && offer.maxDiscount !== undefined && offer.maxDiscount > 0 && (
                          <div className="text-amber-700 font-normal">
                            · Discount up to: Rs {offer.maxDiscount}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={offer.id}
                        data-testid={`offer-pill-${offer.id}`}
                        className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 font-dm-sans text-xs font-semibold text-emerald-700 flex flex-col gap-0.5"
                      >
                        <div>✅ {offer.title}</div>
                        {offer.maxDiscount !== null && offer.maxDiscount !== undefined && offer.maxDiscount > 0 && (
                          <div className="text-emerald-600 font-normal">
                            · Maximum discount: Rs {offer.maxDiscount}
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            )}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-dm-sans text-sm text-gorola-charcoal">Subtotal</span>
                <span className="font-dm-sans text-sm text-gorola-charcoal" data-testid="cart-subtotal">Rs {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-dm-sans text-sm text-gorola-charcoal">Delivery fee</span>
                <span className="font-dm-sans text-sm text-gorola-charcoal">Rs {DELIVERY_FEE.toFixed(2)}</span>
              </div>
              {offerSavedAmount + savedAmount > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-gorola-pine font-bold" data-testid="cart-discount-summary">
                    <div className="flex items-center gap-1.5 font-dm-sans text-sm">
                      <span>Total Discount</span>
                      <button
                        type="button"
                        data-testid="cart-discount-toggle-chevron"
                        onClick={() => setIsDiscountOpen(!isDiscountOpen)}
                        className="text-gorola-pine hover:bg-gorola-pine/5 rounded p-0.5 transition-colors flex items-center justify-center"
                        aria-label="Toggle discount breakdown"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`h-4 w-4 transition-transform duration-200 ${isDiscountOpen ? "rotate-180" : ""}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                    <span className="font-dm-sans text-sm">-Rs {(offerSavedAmount + savedAmount).toFixed(2)}</span>
                  </div>
                  {isDiscountOpen && (
                    <div className="space-y-1.5 pl-4">
                      {appliedOffers.map((o) => (
                        <div
                          key={o.id}
                          data-testid="cart-discount-breakdown-item"
                          className="flex justify-between items-start gap-4 text-gorola-pine/80 text-xs w-full"
                        >
                          <span className="break-words text-left flex-1">{o.title}</span>
                          <span className="text-right whitespace-nowrap shrink-0">-Rs {o.savedAmount.toFixed(2)}</span>
                        </div>
                      ))}
                      {savedAmount > 0 && (
                        <div
                          data-testid="cart-discount-breakdown-item"
                          className="flex justify-between items-start gap-4 text-gorola-pine/80 text-xs w-full"
                        >
                          <span className="break-words text-left flex-1">{discountCode || "Coupon"}</span>
                          <span className="text-right whitespace-nowrap shrink-0">-Rs {savedAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between border-t border-gorola-pine/5 pt-2">
                <span className="font-dm-sans text-base font-bold text-gorola-charcoal">Total</span>
                <span className="font-dm-sans text-base font-bold text-gorola-charcoal" data-testid="cart-total">Rs {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
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
                className="w-full rounded-xl border border-gorola-pine/10 bg-gorola-fog/50 px-4 py-2 font-dm-sans text-sm focus:outline-none focus:border-gorola-pine/30 transition-all"
              />
              <button
                type="button"
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
                        error: "Could not validate discount code",
                        savedAmount: 0
                      });
                    });
                }}
                className="rounded-xl bg-gorola-charcoal px-4 py-2 font-dm-sans text-sm font-bold text-white hover:bg-gorola-charcoal/90 transition-all"
              >
                Apply
              </button>
            </div>
            {discountError && <p className="text-[10px] font-bold text-red-500 ml-1">{discountError}</p>}

            <fieldset className="space-y-3 pt-2">
              <legend className="font-dm-sans text-sm font-bold text-gorola-charcoal mb-2">Payment method</legend>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'COD', label: 'Cash on Delivery', enabled: true },
                  { id: 'UPI', label: 'UPI', enabled: upiEnabled },
                  { id: 'CARD', label: 'Card', enabled: cardEnabled }
                ].map((method) => (
                  <label key={method.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    paymentMethod === method.id 
                      ? 'border-gorola-pine bg-gorola-pine/[0.03] text-gorola-pine' 
                      : 'border-gorola-pine/10 text-gorola-charcoal hover:border-gorola-pine/30'
                  } ${!method.enabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="payment-method"
                      checked={paymentMethod === method.id}
                      disabled={!method.enabled}
                      onChange={() => setPaymentMethod(method.id as PaymentMethod)}
                      className="accent-gorola-pine"
                    />
                    <span className="font-dm-sans text-sm font-medium">{method.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
        <div className="p-6 pt-2 border-t border-gorola-pine/5">
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
            className="w-full rounded-full bg-gorola-pine px-6 py-3 font-dm-sans text-sm font-bold text-white hover:bg-gorola-pine/90 transition-all shadow-lg shadow-gorola-pine/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proceed to Checkout
          </button>
        </div>
      </aside>
    </>
  );
}
