# GoRola Database Schema Guide

This document explains the purpose of each table in the GoRola PostgreSQL database, what data they store, and important technical nuances (such as history tracking, soft deletes, DPDP Act compliance, and isolation guarantees).

---

## 👤 User & Authentication

### `User`
*   **Purpose**: Stores buyer (customer) profiles.
*   **Nuance**: Uses **Two-Stage Soft Delete** (`isDeleted`, `deletedAt`, `deletionScheduledFor`). When a user requests deletion under DPDP Section 12, a 30-day recovery grace period is scheduled before background anonymisation/purge runs.
*   **Identity & PII Encryption (DPDP Compliance)**: Verified via phone OTP; `phone` is AES-256-GCM encrypted at rest (`enc:<iv>:<ciphertext>:<authTag>`). `phoneHash` stores a unique 64-character HMAC-SHA256 blind index for fast exact lookups without storing plaintext phone numbers in database indexes.
*   **Nominee Designation (DPDP Section 14)**: `nomineeName`, `nomineeContact`, and `nomineeRelationship` store the designated representative who can exercise data rights upon the user's death or incapacity.
*   **Age Confirmation (DPDP Section 2(f) / Section 9)**: `ageConfirmedAt` and `ageConfirmedPolicyVersion` record the timestamp and policy version under which the user confirmed they are 18 or older. **GoRola never stores the user's Date of Birth (DOB).**
*   **Policy Version Tracking**: `privacyPolicyVersionAccepted` records the active statutory privacy policy version consented to.

### `AgeGateLockout`
*   **Purpose**: Cooldown lockout ledger for mobile numbers that attempted registration with an under-18 date of birth.
*   **Nuance (Isolation & Security)**: Keyed by `phoneHash` (HMAC-SHA256 blind index). Enforces a 90-day cooldown lockout (`lockedUntil`).
*   **No User Relation**: Has **zero foreign keys** to `User` or `ConsentLog`. This guarantees:
    1. A minor who is refused registration never has a `User` or `ConsentLog` record created.
    2. Deleting an adult user account under DPDP Section 12 never cascades to clear active fraud or age lockouts.
    3. Purge workers remove records independently once `lockedUntil` expires.

### `DeliveryRider` & `RiderLocation`
*   **Purpose**: Tracks delivery personnel profiles and real-time location.
*   **PII Encryption (DPDP Compliance)**: `phone` is AES-256-GCM encrypted at rest (`enc:...`), and `phoneHash` stores a unique 64-character HMAC-SHA256 blind index. `RiderLocation` is highly dynamic; it stores the last known Lat/Lng to show the "Rider is nearby" pulse in the UI.

### `StoreOwner` & `Admin`
*   **Purpose**: Internal accounts for store management and system administration.
*   **Nuance**: Stores a `passwordHash` (Argon2id) and `totpSecret` for 2-Factor Authentication (2FA). `StoreOwner` is linked to a specific `Store`.

> [!NOTE]
> **OTP Storage**: One-time passwords are not stored in PostgreSQL. Ephemeral OTPs are managed directly in Redis (`otp:<phone>`) with automatic short TTLs.

---

## 🔒 DPDP Act & Privacy Architecture

### `ConsentPurposeConfig`
*   **Purpose**: Dynamic configuration table storing canonical DPDP consent purposes and statutory metadata.
*   **Canonical Keys**: `'OTP_AUTH'`, `'ORDER_PROCESSING'`, `'MARKETING_COMMS'`, `'ANALYTICS'`, `'AGE_DECLARATION'`.
*   **Nuance**: Replaced PostgreSQL ENUM types to allow runtime metadata updates (display names, statutory notice summaries, retention schedules) without requiring DDL schema migrations.

### `ConsentLog`
*   **Purpose**: Append-only immutable audit ledger of all user consent decisions.
*   **Nuance**: References `ConsentPurposeConfig.key` and `User.id` (`onDelete: Cascade`). Records exact verbatim `noticeText`, `consentVersion`, `ipAddress`, and `userAgent` at the moment of consent grant or withdrawal.

---

## 🛒 Catalog Hierarchy (The 3-Tier Model)

### `Category` -> `SubCategory` -> `Product`
*   **Purpose**: The organizational structure of the catalog.
*   **Nuance**: 3-tier hierarchy. `SubCategory` is mandatory for all products.

### `ProductVariant` (The SKU)
*   **Purpose**: The actual purchasable item (e.g., "Amul Milk" is the Product; "1L Tetra Pack" is the Variant).
*   **Nuance**: **Prices and Stock are stored here**, not in the Product table. One Product can have multiple Variants. Also supports booking fields (`isAvailableForBooking`, `allowedTimeslots`, `requiresFasting`).

---

## 📦 Order Lifecycle & Fulfillment

### `Address`
*   **Purpose**: Saved buyer delivery locations.
*   **Nuance**: Stores mountain terrain walking directions (`landmarkDescription`) and Ola Maps GPS coordinates (`lat`, `lng`). Soft-deleted via `isDeleted`.

### `Order`
*   **Purpose**: The central commercial contract for deliveries and bookings.
*   **Nuance (Snapshotting)**: When an order is placed, address details (`landmarkDescription`, `addressLabel`, `flatRoom`, `deliveryLat`, `deliveryLng`) are snapshotted into this row so future address changes never alter past order records.

### `OrderItem`
*   **Purpose**: Snapshot of individual products purchased in an order.
*   **Nuance (Immutability)**: Stores `price`, `productName`, and `variantLabel` as they existed at checkout time.

### `OrderStatusHistory`
*   **Purpose**: State transition audit trail for an order.
*   **Nuance**: Powers the UI order progress tracker. Records each status transition (`PLACED` -> `PREPARING` -> `OUT_FOR_DELIVERY` -> `DELIVERED`), who changed it (`changedBy`), and timestamps.

### `StockMovement` (The Inventory Ledger)
*   **Purpose**: Append-only ledger tracking all inventory changes.
*   **Nuance**: Acts like a double-entry balance sheet. Records `SALE`, `CANCELLATION_RESTORE`, `REFILL`, `ADJUSTMENT`, and `INITIAL` with before/after stock quantities.

### `BookingOrder`
*   **Purpose**: Extended metadata for home-visit services (e.g. diagnostic tests, home repairs).
*   **Nuance**: Linked 1-to-1 with `Order`. Tracks `scheduledDate`, `timeslot`, `requiresFasting`, `approvalStatus` (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`), and assigned technician.

### `RiderStore` & `RiderEarning`
*   **Purpose**: Multi-store rider assignment junction (`RiderStore`) and rider payout ledger (`RiderEarning`).
*   **Nuance**: `RiderEarning` tracks per-order earnings (`amount`) linked uniquely to each fulfilled `Order`.

---

## 🛍️ Cart System

### `Cart` & `CartItem`
*   **Purpose**: Ephemeral shopping baskets before checkout.
*   **Nuance**: Each user has exactly **one active cart** (`@@unique([userId])`). When checkout succeeds, `CartItems` are deleted and converted to `OrderItems`.

---

## 📢 Marketing & Promotions

### `Advertisement`
*   **Purpose**: Banners shown on the Home Page.
*   **Nuance**: Time-window gated (`startsAt`, `endsAt`) and moderation-approved (`isApproved`, `isActive`).

### `Offer` & `Discount`
*   **Purpose**: Promotional discounts and coupon codes.
*   **Nuance**: `Discount` uses unique coupon codes (`code`) and enforces usage limits (`usageLimit`, `usedCount`).

---

## ⚙️ System & Infrastructure

### `FeatureFlag`
*   **Purpose**: Dynamic runtime switches (e.g. "Weather Mode") toggled without code deployments.

### `SystemSetting`
*   **Purpose**: Global key-value operational parameters (`DELIVERY_CHARGE`, `RIDER_EARNING_RATE_PCT`).

### `AuditLog`
*   **Purpose**: Immutable security audit trail of administrative actions.
*   **Nuance**: Records `actorId`, `actorRole`, `action`, `entityType`, `entityId`, JSON diffs (`oldValue`, `newValue`), `ip`, and `userAgent`. References `actorId` by string (not FK) to survive user deletion.

---

## 🔒 Database User Roles & Permissions (DPDP Act Compliance)

PostgreSQL database connections enforce strict least-privilege role separation:
*   **`app_service` (DML Role — `DATABASE_URL`)**: Restricted to runtime DML operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). Cannot execute DDL schema changes (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`). Used by the Fastify backend during normal API execution.
*   **`db_owner` (DDL Role — `DIRECT_URL` & `MIGRATION_DATABASE_URL`)**: Full database owner. Used exclusively by `prisma migrate dev`, `prisma migrate deploy`, and administrative developer tools (`prisma:studio`).


