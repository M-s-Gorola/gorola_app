# GoRola Database Schema Guide

This document explains the purpose of each table in the GoRola PostgreSQL database, what data they store, and any important technical nuances (like history tracking or soft deletes).

---

## 👤 User & Authentication

### `User`
*   **Purpose**: Stores buyer (customer) profiles.
*   **Nuance**: Uses **Soft Delete** (`isDeleted`). We never fully delete a user to preserve order history.
*   **Identity & PII Encryption (DPDP Compliance)**: Verified via OTP; `phone` is AES-256-GCM encrypted at rest (`enc:<iv>:<ciphertext>:<authTag>`). `phoneHash` stores a unique 64-character HMAC-SHA256 blind index for fast exact lookups without storing plaintext phone numbers in database indexes.

### `DeliveryRider` & `RiderLocation`
*   **Purpose**: Tracks delivery personnel profiles and real-time location.
*   **PII Encryption (DPDP Compliance)**: `phone` is AES-256-GCM encrypted at rest (`enc:...`), and `phoneHash` stores a unique 64-character HMAC-SHA256 blind index. `RiderLocation` is highly dynamic; it stores the last known Lat/Lng to show the "Rider is nearby" pulse in the UI.


### `StoreOwner` & `Admin`
*   **Purpose**: Internal accounts for store management and system administration.
*   **Nuance**: Stores a `passwordHash` and `totpSecret` for 2-Factor Authentication (2FA). Linked to a specific `Store`.

### `OTPLog`
*   **Purpose**: Temporary storage for one-time passwords sent to phones.
*   **Nuance**: Rows are short-lived and have an `expiresAt` timestamp.

---

## 🛒 Catalog Hierarchy (The 3-Tier Model)

### `Category` -> `SubCategory` -> `Product`
*   **Purpose**: The organizational structure of the app.
*   **Nuance**: We moved from a 2-tier to a **3-tier hierarchy** in Phase 2.18. `SubCategory` is now mandatory for all products.

### `ProductVariant` (The SKU)
*   **Purpose**: The actual "item" you buy (e.g., "Amul Milk" is the Product, but "1L Tetra Pack" is the Variant).
*   **Nuance**: **Prices and Stock are stored here**, not in the Product table. One Product can have multiple Variants (Small, Medium, Large).

---

## 📦 Order Lifecycle (Complex Relationships)

### `Order`
*   **Purpose**: The main record of a purchase.
*   **Nuance (Snapshotting)**: When an order is placed, we "snapshot" the address (`addressLabel`, `flatRoom`) into this table. This ensures that if the user changes their address later, the old order still shows where it was originally delivered.

### `OrderItem`
*   **Purpose**: A list of what was bought in a specific order.
*   **Nuance (Immutability)**: Stores the `price` and `productName` at the time of purchase. If the store changes the price of a product tomorrow, the old `OrderItem` still shows the price the customer actually paid.

### `OrderStatusHistory`
*   **Purpose**: Tracks the "journey" of an order.
*   **Nuance (Multi-row)**: An order will typically have **4 separate rows** here (`PLACED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`). This is what powers the progress bar and "Delivered in XXm" calculation in the UI.

### `StockMovement` (The Ledger)
*   **Purpose**: Every time stock goes up or down, a row is added here.
*   **Nuance**: It acts like a bank statement. `SALE` decreases stock, and `CANCELLATION_RESTORE` increases it if an order is cancelled. This prevents "mystery" stock disappearance.

---

## 🛍️ Cart System

### `Cart` & `CartItem`
*   **Purpose**: Temporary storage for items before checkout.
*   **Nuance**: Each user has exactly **one active cart** (`@@unique([userId])`). When an order is placed, the `CartItems` are deleted and turned into `OrderItems`.

---

## 📢 Marketing & Promotions

### `Advertisement`
*   **Purpose**: Banners shown on the Home Page.
*   **Nuance**: Uses a **Time Window**. A banner only shows up if the current time is between `startsAt` and `endsAt` AND `isApproved` is true.

### `Offer` & `Discount`
*   **Purpose**: Coupons and store-wide deals.
*   **Nuance**: `Discount` uses a unique `code` (like "WELCOME10") and tracks `usedCount` to enforce usage limits.

---

## ⚙️ System & Infrastructure

### `FeatureFlag`
*   **Purpose**: Toggles features (like "Weather Mode") on/off without deploying new code.
*   **Nuance**: The UI polls this table every 60 seconds to see if it needs to change its look.

### `AuditLog`
*   **Purpose**: A permanent record of who did what (Admin/Store Owner actions).
*   **Nuance**: Records the `ip`, `userAgent`, and the `oldValue`/`newValue` of changes for security audits.

### `DeliveryRider` & `RiderLocation`
*   **Purpose**: Tracks delivery personnel.
*   **Nuance**: `RiderLocation` is highly dynamic; it stores the last known Lat/Lng to show the "Rider is nearby" pulse in the UI.

---

## 🔒 Database User Roles & Permissions (DPDP Act Compliance)

PostgreSQL database connections enforce least-privilege role separation:
*   **`app_service` (DML Role — `DATABASE_URL`)**: Restricted to runtime DML operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). Cannot execute DDL schema changes (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`). Used by the Fastify backend during normal API execution.
*   **`db_owner` (DDL Role — `DIRECT_URL` & `MIGRATION_DATABASE_URL`)**: Full database owner. Used exclusively by `prisma migrate dev`, `prisma migrate deploy`, and administrative developer tools (`prisma:studio`).

