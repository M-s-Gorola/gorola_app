# GoRola Platform Audit Logs Reference

This document serves as a comprehensive reference guide for developers regarding the audit logs generated and stored across the GoRola platform. It details the database schema, the actor roles, and the structured actions/codes.

---

## 1. Database Schema (`AuditLog` Model)

The audit logs are persisted in the SQL database using the `AuditLog` table. The Prisma schema definition is as follows:

```prisma
model AuditLog {
  id         String    @id @default(cuid())
  actorId    String    // The ID of the Admin, Store Owner, or Buyer who performed the action
  actorRole  ActorRole // The role of the actor (ADMIN, STORE_OWNER, BUYER, SYSTEM)
  action     String    // The identifier code of the action performed (e.g. ADMIN_USER_SUSPEND)
  entityType String    // The type of database model affected (e.g. Order, Product, Category)
  entityId   String    // The specific record ID of the affected entity
  oldValue   Json?     // State of relevant attributes before the action was taken
  newValue   Json?     // State of relevant attributes after the action was taken or contextual details
  ip         String    // Client IP address
  userAgent  String    // Client User-Agent
  createdAt  DateTime  @default(now()) // Timestamp when the audit log was recorded

  @@index([actorId, actorRole])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

### Actor Roles (`ActorRole` Enum)

- `ADMIN`: Platform administrators with global controls.
- `STORE_OWNER`: Registered store merchants managing their inventories, orders, bookings, offers, and advertisements.
- `BUYER`: Platform customers placing orders or service bookings.
- `SYSTEM`: Automated background processes, triggers, or system tasks.

---

## 2. Audit Log Actions Reference

Below is a detailed breakdown of all audit log actions/codes currently captured in the system, grouped by the role of the actor.

---

### A. Admin Actions (`ADMIN`)

Platform management and moderation actions performed by system administrators.

#### 1. `ADMIN_FORCE_STATUS_UPDATE`
- **Description:** Triggered when an administrator manually overrides the status of a product order or service booking.
- **Entity Type:** `Order`
- **Entity ID:** The unique ID of the affected order.
- **`oldValue` Schema:** `{ status: OrderStatus }`
- **`newValue` Schema:** `{ status: OrderStatus, note: string }`

#### 2. `ADMIN_USER_SUSPEND`
- **Description:** Triggered when an administrator suspends a platform user.
- **Entity Type:** `User`
- **Entity ID:** The unique ID of the suspended user.
- **`oldValue` Schema:** `{ isActive: boolean }`
- **`newValue` Schema:** `{ isActive: false }`

#### 3. `ADMIN_USER_UNSUSPEND`
- **Description:** Triggered when an administrator lifts the suspension on a platform user.
- **Entity Type:** `User`
- **Entity ID:** The unique ID of the unsuspended user.
- **`oldValue` Schema:** `{ isActive: boolean }`
- **`newValue` Schema:** `{ isActive: true }`

#### 4. `ADMIN_STORE_CREATE`
- **Description:** Triggered when an administrator creates a new store/merchant page and its initial store owner.
- **Entity Type:** `Store`
- **Entity ID:** The unique ID of the newly created store.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ name: string, storeType: StoreType, ownerEmail: string }`

#### 5. `ADMIN_STORE_ACTIVATE` / `ADMIN_STORE_DEACTIVATE`
- **Description:** Triggered when an administrator activates or deactivates a store.
- **Entity Type:** `Store`
- **Entity ID:** The unique ID of the store.
- **`oldValue` Schema:** `{ isActive: boolean }`
- **`newValue` Schema:** `{ isActive: boolean }`

#### 6. `ADMIN_CATEGORY_CREATE`
- **Description:** Triggered when an administrator creates a root product/service category.
- **Entity Type:** `Category`
- **Entity ID:** The unique ID of the category.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ name: string, slug: string, commerceType: StoreType, isActive: boolean }`

#### 7. `ADMIN_CATEGORY_UPDATE`
- **Description:** Triggered when an administrator edits root category details.
- **Entity Type:** `Category`
- **Entity ID:** The unique ID of the category.
- **`oldValue` Schema:** `{ name: string, slug: string, commerceType: StoreType, isActive: boolean }`
- **`newValue` Schema:** `{ name: string, slug: string, commerceType: StoreType, isActive: boolean }`

#### 8. `ADMIN_CATEGORY_DELETE`
- **Description:** Triggered when an administrator deletes a root category.
- **Entity Type:** `Category`
- **Entity ID:** The unique ID of the deleted category.
- **`oldValue` Schema:** `{ name: string, slug: string }`
- **`newValue` Schema:** `null`

#### 9. `ADMIN_CATEGORY_REORDER`
- **Description:** Triggered when root categories are re-arranged.
- **Entity Type:** `Category`
- **Entity ID:** `"global"`
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ items: { id: string, displayOrder: number }[] }`

#### 10. `ADMIN_SUBCATEGORY_CREATE`
- **Description:** Triggered when an administrator adds a subcategory under a root category.
- **Entity Type:** `SubCategory`
- **Entity ID:** The unique ID of the subcategory.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ name: string, slug: string, categoryId: string, isActive: boolean }`

#### 11. `ADMIN_SUBCATEGORY_UPDATE`
- **Description:** Triggered when an administrator updates a subcategory's configuration.
- **Entity Type:** `SubCategory`
- **Entity ID:** The unique ID of the subcategory.
- **`oldValue` Schema:** `{ name: string, slug: string, isActive: boolean }`
- **`newValue` Schema:** `{ name: string, slug: string, isActive: boolean }`

#### 12. `ADMIN_SUBCATEGORY_REORDER`
- **Description:** Triggered when subcategories under a category are re-arranged.
- **Entity Type:** `SubCategory`
- **Entity ID:** `"global"`
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ items: { id: string, displayOrder: number }[] }`

#### 13. `ADMIN_FEATURE_FLAG_UPDATE`
- **Description:** Triggered when an administrator modifies a global application feature flag configuration.
- **Entity Type:** `FeatureFlag`
- **Entity ID:** The string key of the feature flag (e.g. `WEATHER_MODE_ACTIVE`).
- **`oldValue` Schema:** `{ value: boolean }`
- **`newValue` Schema:** `{ value: boolean }`

#### 14. `ADMIN_ADVERTISEMENT_APPROVE`
- **Description:** Triggered when an administrator approves a store-requested carousel banner advertisement.
- **Entity Type:** `Advertisement`
- **Entity ID:** The unique ID of the advertisement.
- **`oldValue` Schema:** `{ isApproved: boolean, isActive: boolean }`
- **`newValue` Schema:** `{ isApproved: true, isActive: true }`

#### 15. `ADMIN_ADVERTISEMENT_REJECT`
- **Description:** Triggered when an administrator rejects a store advertisement request.
- **Entity Type:** `Advertisement`
- **Entity ID:** The unique ID of the advertisement.
- **`oldValue` Schema:** `{ isApproved: boolean, isActive: boolean }`
- **`newValue` Schema:** `{ isApproved: false, isActive: false, reason: string }`

#### 16. `ADMIN_ADVERTISEMENT_DEACTIVATE`
- **Description:** Triggered when an administrator deactivates a previously active/approved advertisement.
- **Entity Type:** `Advertisement`
- **Entity ID:** The unique ID of the advertisement.
- **`oldValue` Schema:** `{ isApproved: boolean, isActive: boolean }`
- **`newValue` Schema:** `{ isApproved: boolean, isActive: false }`

---

### B. Store Owner Actions (`STORE_OWNER`)

Merchandising and order/booking lifecycle actions performed by merchant store owners.

#### 1. `STORE_ORDER_STATUS_UPDATE`
- **Description:** Triggered when a store owner updates a products order status (e.g. progressing from PLACED to SHIPPED or DELIVERED, or cancelling).
- **Entity Type:** `Order`
- **Entity ID:** The unique ID of the order.
- **`oldValue` Schema:** `{ status: OrderStatus }`
- **`newValue` Schema:** `{ status: OrderStatus }`

#### 2. `STORE_PRODUCT_CREATE`
- **Description:** Triggered when a store owner adds a new product or service listing to their catalog.
- **Entity Type:** `Product`
- **Entity ID:** The unique ID of the new product.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ name: string, description: string, imageUrl: string, subCategoryId: string }`

#### 3. `STORE_PRODUCT_UPDATE`
- **Description:** Triggered when a store owner modifies general product details (title, description, image, subcategory) or soft-deletes a product.
- **Entity Type:** `Product`
- **Entity ID:** The unique ID of the product.
- **`oldValue` Schema:** `{ name: string, description: string, imageUrl: string, subCategoryId: string }` OR `{ isDeleted: boolean }`
- **`newValue` Schema:** `{ name: string, description: string, imageUrl: string, subCategoryId: string }` OR `{ isDeleted: true }`

#### 4. `STORE_PRODUCT_STATUS_UPDATE`
- **Description:** Triggered when a store owner toggles the visibility status (`isActive`) of a product.
- **Entity Type:** `Product`
- **Entity ID:** The unique ID of the product.
- **`oldValue` Schema:** `{ isActive: boolean }`
- **`newValue` Schema:** `{ isActive: boolean }`

#### 5. `STORE_VARIANT_CREATE`
- **Description:** Triggered when a store owner adds a variant option (e.g. unit sizes, weights, styles) to an existing product.
- **Entity Type:** `ProductVariant`
- **Entity ID:** The unique ID of the new variant.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ label: string, price: number, stockQty: number, unit: string }`

#### 6. `STORE_VARIANT_UPDATE`
- **Description:** Triggered when a store owner modifies a variant's pricing, label, stock quantity, unit, or toggles its status.
- **Entity Type:** `ProductVariant`
- **Entity ID:** The unique ID of the variant.
- **`oldValue` Schema:** `{ label: string, price: number, stockQty: number, unit: string, isActive: boolean }`
- **`newValue` Schema:** `{ label: string, price: number, stockQty: number, unit: string, isActive: boolean }`

#### 7. `STORE_AD_CREATE`
- **Description:** Triggered when a store owner submits a new banner advertisement request for their store page.
- **Entity Type:** `Advertisement`
- **Entity ID:** The unique ID of the requested advertisement.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ title: string, imageUrl: string, linkUrl: string }`

#### 8. `STORE_AD_DELETE`
- **Description:** Triggered when a store owner deletes an advertisement request before it has been approved by an administrator.
- **Entity Type:** `Advertisement`
- **Entity ID:** The unique ID of the advertisement.
- **`oldValue` Schema:** `{ title: string, imageUrl: string, linkUrl: string }`
- **`newValue` Schema:** `null`

#### 9. `STORE_OFFER_CREATE`
- **Description:** Triggered when a store owner creates a store-wide promo code or discount offer.
- **Entity Type:** `Offer`
- **Entity ID:** The unique ID of the new offer.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ title: string, discountType: DiscountType, discountValue: number }`

#### 10. `STORE_OFFER_DEACTIVATE`
- **Description:** Triggered when a store owner manually disables/deactivates a promo code.
- **Entity Type:** `Offer`
- **Entity ID:** The unique ID of the offer.
- **`oldValue` Schema:** `{ isActive: boolean }`
- **`newValue` Schema:** `{ isActive: false }`

#### 11. `STORE_OFFER_DELETE`
- **Description:** Triggered when a store owner deletes a promo code.
- **Entity Type:** `Offer`
- **Entity ID:** The unique ID of the offer.
- **`oldValue` Schema:** `{ title: string, discountType: DiscountType, discountValue: number }`
- **`newValue` Schema:** `null`

#### 12. `STORE_BOOKING_APPROVE`
- **Description:** Triggered when a store owner approves a buyer's booking request for a service-based store appointment.
- **Entity Type:** `Order`
- **Entity ID:** The unique ID of the order.
- **`oldValue` Schema:** `{ approvalStatus: BookingApprovalStatus }`
- **`newValue` Schema:** `{ approvalStatus: "APPROVED" }`

#### 13. `STORE_BOOKING_REJECT`
- **Description:** Triggered when a store owner rejects a buyer's pending booking request.
- **Entity Type:** `Order`
- **Entity ID:** The unique ID of the order.
- **`oldValue` Schema:** `{ approvalStatus: BookingApprovalStatus }`
- **`newValue` Schema:** `{ approvalStatus: "REJECTED", reason: string }`

#### 14. `STORE_BOOKING_COMPLETE`
- **Description:** Triggered when a store owner completes the service booking for the customer.
- **Entity Type:** `Order`
- **Entity ID:** The unique ID of the order.
- **`oldValue` Schema:** `{ approvalStatus: BookingApprovalStatus }`
- **`newValue` Schema:** `{ approvalStatus: "COMPLETED" }`

---

### C. Buyer Actions (`BUYER`)

Transactions and booking lifecycle updates triggered directly by platform customers.

#### 1. `BUYER_ORDER_CREATE`
- **Description:** Triggered when a buyer completes checkout for a physical products order.
- **Entity Type:** `Order`
- **Entity ID:** The unique ID of the placed order.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ total: string, itemsCount: number }`

#### 2. `BUYER_BOOKING_CREATE`
- **Description:** Triggered when a buyer registers a booking appointment order at a service-based merchant store.
- **Entity Type:** `Order`
- **Entity ID:** The unique ID of the placed booking order.
- **`oldValue` Schema:** `null`
- **`newValue` Schema:** `{ total: string, scheduledDate: string, timeslot: string }`

#### 3. `BUYER_BOOKING_CANCEL`
- **Description:** Triggered when a buyer cancels their pending booking order request before it gets approved/rejected by the store owner.
- **Entity Type:** `Order`
- **Entity ID:** The unique ID of the booking order.
- **`oldValue` Schema:** `{ approvalStatus: BookingApprovalStatus }`
- **`newValue` Schema:** `{ approvalStatus: "CANCELLED" }`
