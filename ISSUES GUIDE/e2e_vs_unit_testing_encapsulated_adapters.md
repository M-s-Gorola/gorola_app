# E2E vs. Unit Testing with Encapsulated Adapters

When introducing significant third-party libraries, SDKs, or services (such as Maps, Payment Gateways, or Analytics) to a mature application, there is a common worry that existing End-to-End (E2E) test suites will break or drift. 

However, if your codebase follows the **Encapsulated Adapter Pattern**, your E2E tests should continue to pass cleanly. This guide outlines the rationale behind this testing paradigm and how to structure tests across different levels of the testing pyramid.

---

## 1. The Core Paradigm: Behavioral vs. Implementation Testing

### End-to-End (E2E) Tests: Behavioral
E2E tests should verify **what the user does and expects**, not how a specific third-party library renders pixels on a screen. 
* **User Flow Focus:** "User selects location → User fills checkout details → User submits order → User sees order confirmation."
* **Indifference to Vendors:** The user doesn't care if a map is rendered via Google Maps, Leaflet, or Ola Maps. The browser test shouldn't care either.
* **Testing Stability:** E2E tests remain robust because they target the semantic form elements and standard workflow success states, rather than internal implementation details.

### Unit & Integration Tests: Implementation
Unit and integration tests verify **how the code handles specific logic inside a module**.
* **API Details:** "Does the Ola Maps SDK load dynamically? Do we handle missing API keys? Does our custom marker function set correct parameters?"
* **Isolation:** Tested in JSDOM or via mock runners (like Vitest/Jest) to assert on precise inputs, outputs, and edge cases.

---

## 2. Architectural Blueprint: The Encapsulated Adapter Pattern

To decouple behavioral tests and consumer components from vendor-specific code, hide the third-party dependencies behind a shared interface.

```
                  ┌──────────────────────┐
                  │  Consumer Component  │
                  │ (OrderConfirmation)  │
                  └──────────┬───────────┘
                             │
                      [MapAdapter Interface]
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
     ┌──────────────┐                 ┌──────────────┐
     │ Leaflet      │                 │ Ola Maps     │
     │ Adapter      │                 │ Adapter      │
     └──────────────┘                 └──────────────┘
     (Uses OSM tiles)                (Uses Ola SDK)
```

### Step 1: Define a Common Interface
Ensure all consumer code interacts only with this abstract interface.

```typescript
// src/lib/map-provider.ts
export type MapProvider = "leaflet" | "ola";

export interface MapAdapter {
  init(container: HTMLDivElement, center: { lat: number; lng: number }): Promise<void>;
  addMarker(coords: { lat: number; lng: number }, type: "buyer" | "rider"): void;
  destroy(): void;
}
```

### Step 2: Implement Vendor-Specific Adapters
Keep all SDK-specific logic (script injection, map initialization, custom marker styles) strictly inside their respective adapter classes.

```typescript
// src/lib/adapters/ola-map-adapter.ts
export class OlaMapAdapter implements MapAdapter {
  async init(container: HTMLDivElement, center: { lat: number; lng: number }) {
    // Inject Ola script, initialize OlaMaps instance
  }
  addMarker(coords: { lat: number; lng: number }, type: "buyer" | "rider") {
    // Create new window.OlaMaps.Marker
  }
  destroy() {
    // Clean up DOM and listeners
  }
}
```

### Step 3: Wire with a Factory and Environment Config
Use a simple factory pattern to instantiate the correct adapter at runtime based on environment variables or feature flags.

```typescript
// src/lib/map-adapter-factory.ts
export function createMapAdapter(provider: MapProvider): MapAdapter {
  if (provider === "ola") return new OlaMapAdapter();
  return new LeafletMapAdapter();
}

// src/components/OrderRouteMap.tsx
const provider = (import.meta.env.VITE_MAP_PROVIDER || "leaflet") as MapProvider;
const adapter = createMapAdapter(provider);
```

---

## 3. How to Design the Test Matrix

| Test Level | Scope | Example | Target Assertions |
| :--- | :--- | :--- | :--- |
| **E2E (Playwright/Cypress)** | High-level user journey flow. | `checkout.spec.ts` | Form submission, route changes, database persistence. |
| **Component Unit (React Testing Library)** | UI rendering and lifecycle. | `OrderRouteMap.test.tsx` | Verifies `createMapAdapter` is called once inside `useEffect`. |
| **Adapter Unit (Vitest/Jest)** | Vendor-specific logic and script loading. | `ola-map-adapter.test.ts` | Asserts script tag is injected, markers are correctly positioned. |

---

## 4. Why This Kept E2E Tests Stable (Real-World Case Study)

In this project, we added a complete **Ola Maps** integration next to our existing **Leaflet** map, including complex live-tracking maps and marker setups. However, all E2E tests passed cleanly without changes because:

1. **Default Mode Gating:** The tests ran with `VITE_MAP_PROVIDER` unset, falling back automatically to the offline-friendly, zero-API-key Leaflet implementation.
2. **Encapsulated API:** The UI components interacted with maps using the same props and `MapAdapter` methods, avoiding compile-time or runtime layout shifts.
3. **Asserting Behavior, Not Pixels:** The E2E tests verified checkout states, booking approvals, and order records rather than checking map canvas internals.
