# Infrastructure Guide: Resolving Prisma Transaction Timeouts (P2028)

This guide explains the "Double-Press" checkout failure seen in production and how to architect database interactions to prevent similar issues in the future.

## 1. The Symptom: "The Double-Press Failure"
In cloud environments like Railway or Vercel, the first time a user performs a complex action (like "Place Order"), the request fails with a `500 Internal Server Error`. Upon immediate retry, it works perfectly.

### The Error Code: `P2028`
Prisma throws `Transaction not found because it has timed out or been closed`.

---

## 2. The Root Cause: The Perfect Storm
This issue is caused by three factors working together:

### A. Cold Start Latency
When a cloud server or database hasn't been used for a while, it "goes to sleep" or throttles resources. The first request must:
1. Wake up the Database connection pool.
2. Initialize the Prisma Query Engine.
3. Establish a secure handshake.
This can add **2 to 4 seconds** of overhead to the very first request.

### B. Prisma's Default Safety Window
By default, Prisma's interactive transactions (`$transaction`) have a **5-second timeout**. If the transaction doesn't complete and "commit" within 5 seconds, the engine kills it to prevent deadlocks.

### C. "Chatty" Logic (The Bottleneck)
If your code performs many sequential database calls inside a transaction (e.g., looping through 10 cart items and checking stock for each), each call adds network round-trip time.
- **Cold start (4s)** + **15 sequential calls (0.2s each = 3s)** = **7 seconds total**.
- Result: **TIMEOUT** (7s > 5s limit).

---

## 3. How to Fix & Prevent

### I. The "Safety Buffer" (Timeout Increase)
For complex business logic, increase the default timeout to **15 seconds**. This gives the server enough time to "warm up" without killing the user's request.

```typescript
await db.$transaction(async (tx) => { ... }, {
  timeout: 15000, // 15 seconds
  maxWait: 5000   // 5 seconds to get a connection
});
```

### II. The "Bulk Fetch" Pattern (Optimization)
**NEVER** perform database queries inside a loop if you can avoid it.

**❌ BAD (Chatty):**
```typescript
for (const item of items) {
  const data = await tx.product.findUnique({ where: { id: item.id } }); // N Round-trips
}
```

**✅ GOOD (Bulk):**
```typescript
const ids = items.map(i => i.id);
const allData = await tx.product.findMany({ where: { id: { in: ids } } }); // 1 Round-trip
```

### III. The "Embedded Relations" Pattern
Use Prisma's `include` feature to get everything you need in a single call instead of fetching the main record and then its children.

---

## 4. Summary Checklist for New Features
- [ ] Does this logic happen inside a `$transaction`?
- [ ] Are there any `await` calls inside a `for` or `map` loop? (If yes, refactor to `findMany`).
- [ ] Is the total expected time near 5 seconds? (If yes, increase `{ timeout: 15000 }`).
- [ ] Can I use `include` or `select` to reduce the number of queries?
