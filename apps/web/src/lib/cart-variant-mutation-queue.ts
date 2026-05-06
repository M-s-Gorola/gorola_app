const tailsByVariantId = new Map<string, Promise<unknown>>();

/**
 * Serializes HTTP cart mutations touching the same line item so rapid +/- cannot
 * send overlapping PUT/DELETE updates that reconcile out of order.
 */
export function enqueueCartVariantMutation<T>(
  productVariantId: string,
  work: () => Promise<T>
): Promise<T> {
  const prev = tailsByVariantId.get(productVariantId) ?? Promise.resolve();
  const next = prev.then(work);
  tailsByVariantId.set(
    productVariantId,
    next.then(
      (): undefined => undefined,
      (): undefined => undefined
    )
  );
  return next;
}

/**
 * Returns a promise that resolves when all currently queued mutations have finished.
 */
export async function waitForAllCartMutations(): Promise<void> {
  const currentTails = Array.from(tailsByVariantId.values());
  await Promise.allSettled(currentTails);
}
