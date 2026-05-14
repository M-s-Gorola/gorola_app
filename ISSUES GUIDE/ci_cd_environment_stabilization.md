# CI/CD Environment Stabilization: Mocking vs. Spying

A common challenge in modern CI/CD pipelines is the "Local Pass, CI Fail" phenomenon. This occurs when tests rely on environmental assumptions that hold true on a developer's machine but break in a clean, virtualized runner. This guide establishes principles for **Test-Safe Initializations** and **Hierarchical Data Cleanups**.

---

## 1. The "Ghost" Environment Variable Problem

Applications often use environment variables (e.g., `BASE_URL`) to initialize core services (like API clients or SDKs).
*   **The Issue**: Locally, these variables are provided via `.env`. In CI, they may be missing, leading to `null` or `undefined` service objects.
*   **The Pattern (Mock vs. Spy)**:
    *   **Mocks (`vi.mock`)**: These replace the entire module with a "toy" version before the code even runs. They are robust against missing environment variables because they bypass the real initialization logic.
    *   **Spies (`vi.spyOn`)**: These "watch" the real object. If the real object failed to initialize because of a missing variable, the spy will fail.

**Best Practice**: Ensure that core services have a "Safe-for-Testing" fallback. If the application detects it is running in `test` mode, it should initialize a dummy instance of the service rather than crashing.

---

## 2. Hierarchical Database Cleanup

In stateful applications, tests often perform a "Clean Slate" operation before or after each run.
*   **The Issue**: As database schemas grow, **Foreign Key Constraints** create a dependency web. Deleting a "Parent" record (e.g., a Store) while a "Child" record (e.g., an Advertisement) still exists will trigger a database error.
*   **The Pattern**: Implement a hierarchical cleanup function that respects the database's relational graph.

**Universal Deletion Order:**
1.  **Leaf Nodes**: Delete records with the most dependencies (e.g., Transactions, Ratings, Ads).
2.  **Intermediate Nodes**: Delete records that group leaf nodes (e.g., Products, Categories).
3.  **Root Nodes**: Delete the foundational records (e.g., Users, Organizations).

---

## 3. The "Leaky" Library Problem

Unit tests must be 100% isolated from the network. If a unit test triggers a real network request, it is "leaking."
*   **The Symptom**: Unit tests pass, but the terminal is filled with "Connection Refused" or "Socket Error" noise.
*   **The Cause**: A library (e.g., `socket.io-client` or `axios`) was not mocked, and it is attempting to connect to a default `localhost` port that doesn't exist in the test environment.
*   **The Pattern**: Use a **Global Mock** in your test setup file to intercept these libraries at the root level. This ensures that even if a developer forgets to mock it in a specific test, the global safeguard prevents network leaks.

---

## Summary of Learnings
1.  **Mocks > Spies for CI**: Prefer mocking entire modules for foundational services to avoid environmental dependency.
2.  **Relational Cleanups**: Always update your cleanup logic whenever a new relational model is added to the database.
3.  **Zero Network Leaks**: Any network-related error in a unit test is a sign of poor isolation. Implement global intercepts for all networking libraries.
