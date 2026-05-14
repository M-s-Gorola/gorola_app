# Issue Guide: Mandatory Sub-category Constraint

## The "Hell" of Refactoring a Core Relationship

In Phase 2.18, we transitioned the GoRola catalog from a flat `Category -> Product` model to a three-tier `Category -> SubCategory -> Product` model. While conceptually simple, making the `subCategoryId` column **mandatory (non-nullable)** on the `Product` table triggered a "cascade of failure" across the entire repository.

### What Happened?

1.  **Database Deadlock (Migration Stage):**
    When adding a non-nullable column to an existing table in PostgreSQL via Prisma, the migration fails if there is any data. Prisma cannot know what value to put in the new column for existing rows.
    *   **The Struggle:** We had to force a complete database reset (`prisma migrate reset`) to wipe the products, add the column, and then re-seed.

2.  **Test Suite Meltdown:**
    The GoRola codebase has high test coverage. Almost **20 different integration test files** (Orders, Cart, Inventory, Promotions) create `Product` records for their setup. 
    *   **The Struggle:** The moment the column became mandatory, every single one of these tests crashed with `P2003: Foreign key constraint failed`. I had to manually update setup functions in dozens of files to include `SubCategory` creation and link it to the products.

3.  **Referential Integrity Constraints:**
    During cleanup (`cleanGraph` functions), tests were failing because we were trying to delete `Categories` or `SubCategories` while `Products` were still pointing to them.
    *   **The Struggle:** We had to re-order all cleanup logic to follow a strict "Leaf-to-Root" sequence: `Delete Products -> Delete SubCategories -> Delete Categories`.

4.  **Type-Check Chaos:**
    The Prisma-generated types for `Product` changed globally. Everywhere we used `Product` without including `subCategoryId`, TypeScript threw errors. This affected both the API backend and the Web frontend.

5.  **Database Desynchronization (Dev vs. Test):**
    A major point of confusion was the separation between `gorola_dev` and `gorola_test`. 
    *   **The Struggle:** `prisma migrate dev` only applies changes to the primary development database. The test database, which integration tests use, remained on the old schema. Running tests resulted in "Column not found" or "Table not found" errors even though the app seemed fine in the browser.
    *   **The Rectification:** We implemented `apps/api/scripts/bootstrap-test-db.cjs`. This script explicitly points Prisma at the `DATABASE_URL_TEST` and runs `migrate deploy` followed by a double-seed (Catalog + E2E). We then wired this into the `pnpm ci:quality` pipeline to ensure the test environment is automatically synchronized before any code is evaluated.

### Lessons Learned

*   **Nullable vs. Mandatory:** If a feature isn't 100% mission-critical, start with a **nullable** FK. This allows you to migrate without breaking existing code and tests. Once everything is migrated, you can "tighten" the constraint to non-nullable in a follow-up PR.
*   **Seeding is Sacred:** When changing core schemas, your seeding scripts (`seed.ts`, `dummy-data.ts`) become your primary way to unblock the team. If seeding fails, the whole app is effectively "dead" for new developers.
*   **Integration Tests are Brittle:** High coverage is great, but core schema changes reveal how tightly coupled tests can become to specific data shapes. Abstracting "Product Creation" into a helper function (e.g., `createTestProduct()`) would have saved hours of manual find-and-replace.

### Recovery Steps taken:
- Updated `apps/api/scripts/migrate-test-db.cjs` to force resets on test environments.
- Mass-updated all `__tests__/integration` setup blocks.
- Optimized `dummy-data.ts` to ensure reliable, valid hierarchical data is always available.
