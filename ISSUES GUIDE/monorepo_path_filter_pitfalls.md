# Monorepo Path Filtering: The "Merge Commit" Trap

This guide explains a common "WTF" moment in monorepo CI/CD pipelines where deployments fail to trigger after a successful merge, even when files were clearly changed.

---

## 1. The Problem: The Zero-Diff Illusion

In a monorepo, we use "Path Filters" (like `dorny/paths-filter`) to ensure that a change in the **Frontend** doesn't trigger a deployment of the **Backend**.

**The Scenario:**
1.  You open a PR from `feature` to `develop`. The CI correctly detects changes and runs tests.
2.  You merge the PR. The `develop` pipeline runs and deploys to Staging.
3.  You merge `develop` into `main`. 
4.  **THE BUG**: The `main` pipeline starts, but the path filter returns `false` for everything. The deployment is skipped.

---

## 2. The Technical Cause: Two-Parent Confusion

When you merge one branch into another, Git creates a **Merge Commit**. Unlike a normal commit, a merge commit has **two parents**:

- **Parent 1 (Base)**: The branch you are merging **into** (e.g., `main`).
- **Parent 2 (Head)**: The branch you are merging **from** (e.g., `develop`).

### **Why the Filter Fails**
Most path-filtering tools try to find "what changed" by comparing the new commit against its "parent." 
If the tool defaults to comparing against **Parent 2** (`develop`), it sees **zero changes**. This is because the code in the merge commit is identical to the code that was already in `develop`.

The tool thinks: *"Relative to develop, nothing is new here,"* and it shuts down the deployment.

---

## 3. The Solution: Explicit Base Referencing

To fix this, you must force the CI runner to ignore the internal Git parent logic and instead use the **Temporal History** of the branch.

In GitHub Actions, the `push` event provides a special variable: **`github.event.before`**. This is the SHA of the branch exactly one second before the merge happened.

### **The Correct Pattern:**
In your workflow, explicitly set the `base` of your filter to the `before` SHA during a push.

```yaml
- name: Check Paths
  uses: dorny/paths-filter@v3
  with:
    # IF this is a push (merge), compare against the PREVIOUS state of this branch.
    # IF this is a PR, use the default behavior (compare against target branch).
    base: ${{ github.event_name == 'push' && github.event.before || '' }}
    filters: |
      web:
        - 'apps/web/**'
      api:
        - 'apps/api/**'
```

---

## 4. Why this is "Merge-Proof"

1.  **Fast-Forward Merges**: `github.event.before` correctly points to the old head.
2.  **Squash Merges**: The entire PR becomes one commit; `before` is the old head.
3.  **Recursive Merges**: Even with complex histories, comparing against the `before` SHA ensures you see everything that was added to the branch in that specific push event.

---

## Summary for Future Projects
1.  **Never** rely on default path-filter behavior for `push` events in a monorepo.
2.  **Always** use `github.event.before` as your base for pushes.
3.  **Ensure** your Checkout step has `fetch-depth: 0` so the runner can see enough history to perform the diff.
