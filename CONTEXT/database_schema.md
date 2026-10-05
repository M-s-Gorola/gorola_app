# GoRola — Database Schema Reference

> **Database Engine:** PostgreSQL 15 (Railway / Local Dev & Test)  
> **ORM:** Prisma ORM  
> **Last Updated:** 2026-10-05 (Phase 8.8 — Age Gate Lockout & DPDP Architecture Alignment)

---

## 1. Overview & Architectural Principles

1. **Least-Privilege Role Separation:**
   - **`app_service`:** DML-only credentials (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) used for production runtime (`DATABASE_URL`).
   - **`db_owner`:** DDL-authorized credentials used exclusively for migrations and Prisma schema synchronization (`MIGRATION_DATABASE_URL` / `DIRECT_URL`).
2. **PII Encryption & Blind Indexing:**
   - User and Rider phone numbers are encrypted at rest using AES-256-GCM (`phone`).
   - Searchable lookups use HMAC-SHA256 blind indexing (`phoneHash`).
3. **Audit & Ledger Immutability:**
   - `ConsentLog`, `AuditLog`, `StockMovement`, and `OrderStatusHistory` are immutable append-only ledgers protected by Prisma client extensions and database foreign keys.
4. **Dynamic Configuration vs Rigid Enums:**
   - Extensible domain configurations (such as DPDP Consent Purposes in `ConsentPurposeConfig`) are modeled as relational reference tables rather than PostgreSQL ENUM types to allow zero-downtime additions and metadata extensions without schema DDL alterations.

---

## 2. Relational Schema & Tables

### 2.1 — DPDP Act & Privacy Architecture

#### `ConsentPurposeConfig`
Stores canonical DPDP consent purposes and regulatory metadata.
- `key` (`TEXT`, PK): Primary purpose identifier (canonical keys: `'OTP_AUTH'`, `'ORDER_PROCESSING'`, `'MARKETING_COMMS'`, `'ANALYTICS'`, `'AGE_DECLARATION'`).
- `displayName` (`TEXT`): Human-readable title for UI cards and notice headers.
- `description` (`TEXT`): Summary of processing purpose.
- `isEssential` (`BOOLEAN`, default `false`): Whether consent is mandatory for core platform operation.
- `retentionSummary` (`TEXT`): Description of data retention duration and purge policy.
- `createdAt` (`TIMESTAMP`): Creation timestamp.
- `updatedAt` (`TIMESTAMP`): Last updated timestamp.

#### `ConsentLog`
Append-only immutable ledger of all user consent decisions.
- `id` (`TEXT`, PK): CUID identifier.
- `userId` (`TEXT`, FK `User.id`): Associated user.
- `purpose` (`TEXT`, FK `ConsentPurposeConfig.key`): Purpose identifier.
- `consentVersion` (`TEXT`, default `'1.0'`): Privacy policy version consented against.
- `noticeText` (`TEXT`): Exact verbatim disclosure text displayed at the moment of consent.
- `ipAddress` (`TEXT?`): IP address of the client at consent time.
- `userAgent` (`TEXT?`): HTTP User-Agent header at consent capture for audit trail.
- `isWithdrawn` (`BOOLEAN`, default `false`): Whether consent was subsequently withdrawn.
- `withdrawnAt` (`TIMESTAMP?`): Timestamp of consent withdrawal.
- `createdAt` (`TIMESTAMP`): Timestamp of consent grant.
- `updatedAt` (`TIMESTAMP`): Last modified timestamp.

#### `AgeGateLockout`
Cooldown lockout ledger for mobile numbers that failed the neutral age gate (under 18).
- `id` (`TEXT`, PK): CUID identifier.
- `phoneHash` (`TEXT`, unique): HMAC-SHA256 blind index of mobile phone number (`hashPII`).
- `lockedUntil` (`TIMESTAMP`): Expiration timestamp of the 90-day cooldown lockout.
- `strikeCount` (`INT`, default `1`): Number of under-age attempts recorded against this phone hash.
- `createdAt` (`TIMESTAMP`): Lockout creation timestamp.
- `updatedAt` (`TIMESTAMP`): Last modification timestamp.
- *Indexes:* `@@index([lockedUntil])`.
- *Isolation Guarantee:* Standalone table with **no foreign keys** to `User` or `ConsentLog`. Ensures:
  1. An under-18 user who is rejected never creates a `User` or `ConsentLog` record.
  2. If an adult user is deleted via DPDP Section 12 erasure, cascading deletes never wipe active fraud or age lockouts.
  3. Purge worker removes records where `lockedUntil < NOW()` independently.

---

### 2.2 — Core Authentication & Identity

#### `User`
Buyer and registered customer identity.
- `id` (`TEXT`, PK): CUID identifier.
- `phone` (`TEXT`, unique): AES-256-GCM encrypted phone number.
- `phoneHash` (`TEXT?`, unique): HMAC-SHA256 blind index for search.
- `name` (`TEXT?`): Optional display name.
- `isVerified` (`BOOLEAN`, default `false`): Phone verification status.
- `isActive` (`BOOLEAN`, default `true`): Account activity status.
- `isDeleted` (`BOOLEAN`, default `false`): Soft-deletion flag.
- `deletedAt` (`TIMESTAMP?`): Timestamp when user initiated account deletion.
- `deletionScheduledFor` (`TIMESTAMP?`): Expiration timestamp of 30-day recovery grace period.
- `nomineeName` (`TEXT?`): Designated DPDP nominee full name.
- `nomineeContact` (`TEXT?`): Designated DPDP nominee contact details.
- `nomineeRelationship` (`TEXT?`): Designated DPDP nominee relationship.
- `privacyPolicyVersionAccepted` (`TEXT`, default `'1.0'`): Privacy policy version accepted during authentication.
- `ageConfirmedAt` (`TIMESTAMP?`): Timestamp when user confirmed age eligibility (18+) via neutral DOB gate.
- `ageConfirmedPolicyVersion` (`TEXT?`): Privacy policy version under which age was confirmed (e.g. `'1.1'`).
- `createdAt` (`TIMESTAMP`): Account creation timestamp.
- `updatedAt` (`TIMESTAMP`): Last modification timestamp.

#### `Admin`
Platform administrators.
- `id` (`TEXT`, PK): CUID identifier.
- `email` (`TEXT`, unique): Login email.
- `passwordHash` (`TEXT`): Argon2id password hash.
- `totpSecret` (`TEXT?`): 2FA TOTP secret.
- `isDeleted` (`BOOLEAN`, default `false`): Soft-deletion flag.
- `createdAt` (`TIMESTAMP`), `updatedAt` (`TIMESTAMP`).

#### `StoreOwner`
Merchant store managers.
- `id` (`TEXT`, PK): CUID identifier.
- `email` (`TEXT`, unique): Login email.
- `passwordHash` (`TEXT`): Argon2id password hash.
- `storeId` (`TEXT`, FK `Store.id`): Associated store.
- `totpSecret` (`TEXT?`), `totpEnabled` (`BOOLEAN`, default `false`).
- `isDeleted` (`BOOLEAN`, default `false`).

#### `DeliveryRider`
Field delivery personnel and technicians.
- `id` (`TEXT`, PK): CUID identifier.
- `name` (`TEXT`): Rider full name.
- `phone` (`TEXT`): Encrypted phone number.
- `phoneHash` (`TEXT`, unique): Blind index for lookup.
- `email` (`TEXT`, unique): Login email.
- `passwordHash` (`TEXT`): Password hash.
- `riderType` (`RiderType`, default `DELIVERY`): `DELIVERY` or `FIELD_TECHNICIAN`.
- `isActive` (`BOOLEAN`, default `true`), `isDeleted` (`BOOLEAN`, default `false`).

#### `RiderStore`
Junction table for multi-store rider assignment.
- `id` (`TEXT`, PK): CUID identifier.
- `riderId` (`TEXT`, FK `DeliveryRider.id`).
- `storeId` (`TEXT`, FK `Store.id`).
- `isPrimary` (`BOOLEAN`, default `false`).
- *Unique Constraint:* `(riderId, storeId)`.

#### `RiderLocation`
Live telemetry GPS updates.
- `id` (`TEXT`, PK): CUID identifier.
- `riderId` (`TEXT`, unique FK `DeliveryRider.id`).
- `lat` (`DECIMAL(10, 7)`), `lng` (`DECIMAL(10, 7)`).
- `updatedAt` (`TIMESTAMP`).

---

### 2.3 — Catalog & Inventory

#### `Store`
Quick-commerce and booking-commerce outlets.
- `id` (`TEXT`, PK): CUID identifier.
- `name` (`TEXT`), `description` (`TEXT?`), `phone` (`TEXT`), `address` (`TEXT`).
- `storeType` (`StoreType`): `QUICK_COMMERCE` | `BOOKING_COMMERCE`.
- `weatherModeDeliveryWindow` (`TEXT?`): Hill-station weather delay buffer in minutes.
- `bookingLeadDays` (`INT`, default `1`), `isAcceptingBookings` (`BOOLEAN`, default `true`), `isAcceptingOrders` (`BOOLEAN`, default `true`).
- `riderEarningRatePct` (`DECIMAL(5, 2)?`): Per-store rider payout percentage override.
- `isActive` (`BOOLEAN`, default `true`), `isDeleted` (`BOOLEAN`, default `false`).

#### `Category` & `SubCategory`
Hierarchical product organization.
- `Category`: `id`, `slug` (unique), `name`, `imageUrl`, `icon`, `displayOrder`, `commerceType` (`StoreType`), `isActive`.
- `SubCategory`: `id`, `slug` (unique), `name`, `imageUrl`, `displayOrder`, `isActive`, `categoryId` (FK `Category.id`).

#### `Product` & `ProductVariant`
Product definitions and purchaseable SKUs.
- `Product`: `id`, `storeId` (FK `Store`), `categoryId` (FK `Category`), `subCategoryId` (FK `SubCategory`), `name`, `description`, `imageUrl`, `isActive`, `isDeleted`.
- `ProductVariant`: `id`, `productId` (FK `Product`), `label`, `price` (`DECIMAL(10, 2)`), `stockQty` (`INT`), `lowStockThreshold` (`INT`, default `5`), `isLowStock` (`BOOLEAN`), `isInStock` (`BOOLEAN`), `unit` (`TEXT`), `isActive` (`BOOLEAN`), `isAvailableForBooking` (`BOOLEAN`), `allowedTimeslots` (`TEXT[]`), `requiresFasting` (`BOOLEAN`, default `false`).

#### `StockMovement`
Append-only inventory ledger.
- `id` (`TEXT`, PK): CUID identifier.
- `productVariantId` (`TEXT`, FK `ProductVariant.id`).
- `orderId` (`TEXT?`, FK `Order.id`).
- `type` (`StockMovementType`): `SALE` | `CANCELLATION_RESTORE` | `REFILL` | `ADJUSTMENT` | `INITIAL`.
- `quantity` (`INT`), `stockQtyBefore` (`INT`), `stockQtyAfter` (`INT`), `note` (`TEXT?`), `reason` (`TEXT?`).
- `createdAt` (`TIMESTAMP`).

---

### 2.4 — Orders, Cart & Fulfillment

#### `Cart` & `CartItem`
Ephemeral shopping baskets.
- `Cart`: `id`, `userId` (unique FK `User.id`), `createdAt`, `updatedAt`.
- `CartItem`: `id`, `cartId` (FK `Cart.id`), `productVariantId` (FK `ProductVariant.id`), `quantity` (`INT`). Unique `(cartId, productVariantId)`.

#### `Address`
Saved user delivery locations.
- `id` (`TEXT`, PK): CUID identifier.
- `userId` (`TEXT`, FK `User.id`).
- `label` (`TEXT`): e.g. `'Home'`, `'Work'`, `'Hotel'`.
- `landmarkDescription` (`TEXT`): Critical mountain topography and walking directions.
- `flatRoom` (`TEXT?`).
- `lat` (`DECIMAL(10, 7)?`), `lng` (`DECIMAL(10, 7)?`): Ola Maps GPS coordinates.
- `isDefault` (`BOOLEAN`, default `false`), `isDeleted` (`BOOLEAN`, default `false`).

#### `Order`
Central commercial contract for deliveries and bookings.
- `id` (`TEXT`, PK): CUID identifier.
- `userId` (`TEXT`, FK `User.id`).
- `storeId` (`TEXT`, FK `Store.id`).
- `riderId` (`TEXT?`, FK `DeliveryRider.id`): Assigned fulfillment rider.
- `status` (`OrderStatus`): `PLACED` | `PREPARING` | `OUT_FOR_DELIVERY` | `DELIVERED` | `CANCELLED` | `PENDING_APPROVAL` | `APPROVED`.
- `orderType` (`OrderType`): `QUICK` | `BOOKING`.
- `subtotal`, `deliveryFee`, `total` (`DECIMAL(10, 2)`).
- `paymentMethod` (`PaymentMethod`): `COD` | `UPI` | `CARD`.
- `paymentStatus` (`PaymentStatus`): `PENDING` | `CAPTURED` | `FAILED`.
- `razorpayOrderId` (`TEXT?`), `razorpayPaymentId` (`TEXT?`).
- `landmarkDescription` (`TEXT`), `addressLabel` (`TEXT?`), `flatRoom` (`TEXT?`), `deliveryNote` (`TEXT?`).
- `deliveryLat` (`DECIMAL(10, 7)?`), `deliveryLng` (`DECIMAL(10, 7)?`).
- `scheduledFor` (`TIMESTAMP?`), `rating` (`DECIMAL(2, 1)?`), `ratingComment` (`TEXT?`), `appliedDiscountCode` (`TEXT?`).

#### `OrderItem`
Snapshot of products at the time of purchase.
- `id` (`TEXT`, PK): CUID identifier.
- `orderId` (`TEXT`, FK `Order.id`).
- `productVariantId` (`TEXT`, FK `ProductVariant.id`).
- `productName` (`TEXT`), `variantLabel` (`TEXT`), `price` (`DECIMAL(10, 2)`), `quantity` (`INT`).

#### `OrderStatusHistory`
State transition audit log.
- `id` (`TEXT`, PK): CUID identifier.
- `orderId` (`TEXT`, FK `Order.id`).
- `status` (`OrderStatus`).
- `note` (`TEXT?`).
- `changedBy` (`TEXT`): Format: `'buyer'`, `'store-owner:{id}'`, `'rider:{id}'`, `'admin:{id}'`, `'system'`.
- `changedAt` (`TIMESTAMP`).

#### `BookingOrder`
Extended metadata for scheduled home-visit services.
- `id` (`TEXT`, PK): CUID identifier.
- `orderId` (`TEXT`, unique FK `Order.id`).
- `scheduledDate` (`TIMESTAMP`), `timeslot` (`TEXT`), `requiresFasting` (`BOOLEAN`).
- `approvalStatus` (`BookingApprovalStatus`): `PENDING_APPROVAL` | `APPROVED` | `REJECTED` | `COMPLETED` | `CANCELLED`.
- `approvedAt` (`TIMESTAMP?`), `approvedByOwnerId` (`TEXT?`), `rejectionReason` (`TEXT?`), `assignedTechnicianId` (`TEXT?`).

#### `RiderEarning`
Rider payout ledger entries.
- `id` (`TEXT`, PK): CUID identifier.
- `riderId` (`TEXT`, FK `DeliveryRider.id`).
- `orderId` (`TEXT`, unique FK `Order.id`).
- `amount` (`DECIMAL(10, 2)`): Net payout calculated per order.
- `earningType` (`EarningType`, default `PER_ORDER`): `PER_ORDER` | `PER_KM`.
- `distanceKm` (`DECIMAL(8, 3)?`): Nullable distance field for future per-KM calculations.
- `createdAt` (`TIMESTAMP`).

---

### 2.5 — Marketing, System & Audit

- `Offer` / `Discount` / `Advertisement`: Promotions and campaign management.
- `FeatureFlag`: Dynamic runtime toggles (`key`, `value`, `description`).
- `SystemSetting`: Global key-value system settings (`DELIVERY_CHARGE`, `RIDER_EARNING_RATE_PCT`, etc.).
- `AuditLog`: Administrative action audit log (`actorId`, `actorRole`, `action`, `entityType`, `entityId`, `oldValue`, `newValue`, `ip`, `userAgent`).

---

## 3. PostgreSQL Enums

| Enum Name | Allowed Values |
|---|---|
| `OrderStatus` | `PLACED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `PENDING_APPROVAL`, `APPROVED` |
| `StoreType` | `QUICK_COMMERCE`, `BOOKING_COMMERCE` |
| `OrderType` | `QUICK`, `BOOKING` |
| `BookingApprovalStatus` | `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED` |
| `RiderType` | `DELIVERY`, `FIELD_TECHNICIAN` |
| `PaymentMethod` | `COD`, `UPI`, `CARD` |
| `PaymentStatus` | `PENDING`, `CAPTURED`, `FAILED` |
| `DiscountType` | `PERCENTAGE`, `FLAT` |
| `ActorRole` | `ADMIN`, `STORE_OWNER`, `BUYER`, `SYSTEM` |
| `StockMovementType` | `SALE`, `CANCELLATION_RESTORE`, `REFILL`, `ADJUSTMENT`, `INITIAL` |
| `EarningType` | `PER_ORDER`, `PER_KM` |

*(Note: `ConsentPurpose` enum was deprecated and dropped in migration `20261001200359`, replaced by `ConsentPurposeConfig` table).*

---

## 4. Migration History & Notable Milestones

| Migration Name | Scope & Changes |
|---|---|
| `20260922205638_add_consent_log_model` | Created initial `ConsentLog` table and `ConsentPurpose` enum. |
| `20260924040500_add_user_nominee_and_deletion_fields` | Added `nomineeName`, `nomineeContact`, `nomineeRelationship`, `deletedAt`, `deletionScheduledFor` to `User` table for DPDP Section 12 & 14 compliance. |
| `20260925183000_add_rider_order_lifecycle_fields` | Added `riderId` to `Order` model, `RiderStore` junction table, and `RiderEarning` model. |
| **`20261001200359_replace_consent_purpose_enum_with_config_table`** | **Replaced `ConsentPurpose` PostgreSQL enum with `ConsentPurposeConfig` database table.** Renamed `MARKETING_EMAIL` to `MARKETING_COMMS`. Updated `ConsentLog.purpose` to `TEXT` referencing `ConsentPurposeConfig.key`. Seeded 4 canonical rows (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_COMMS`, `ANALYTICS`). |
| `add_age_gate_lockout_and_age_confirmation` | Phase 8.8: Added `ageConfirmedAt` (`TIMESTAMP?`) and `ageConfirmedPolicyVersion` (`TEXT?`) to `User`. Added `AgeGateLockout` table (`phoneHash` unique, `lockedUntil`, `strikeCount`, `createdAt`, `updatedAt`). Seeded canonical `AGE_DECLARATION` purpose into `ConsentPurposeConfig`. |
