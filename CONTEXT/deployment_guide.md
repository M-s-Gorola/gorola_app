# GoRola Branching & Deployment Guide

This document defines the branching strategy for the GoRola project, how to set up branch protection rules, and how to manage deployments and secrets across different environments (Staging vs Production).

## 1. Branching Strategy

We use a **Lightweight Git Flow** (also known as Trunk-Based Development with a Staging Branch).

- **`main`**: The Production branch. Code here is live to actual users.
- **`develop`**: The Staging/Integration branch. All features merge here first to be tested.
- **Feature Branches** (`feature/your-feature-name`): Temporary branches created by developers.

**Workflow:**
1. Developer creates a branch off `develop` (e.g., `feature/cart-fix`).
2. Developer commits code and opens a Pull Request (PR) targeting `develop`.
3. CI runs (lint, typecheck, test). Other developers review.
4. If green, merge into `develop`. (This triggers a deployment to the Staging environment).
5. When `develop` is stable and ready for users, open a PR from `develop` into `main`.
6. Merging into `main` triggers a deployment to Production.

---

## 2. Step-by-Step: Creating the `develop` Branch

If `develop` doesn't exist yet, run these commands from your local machine terminal:

```bash
git switch main
git pull origin main
git switch -c develop
git push -u origin develop
```

This creates the branch locally and pushes it to GitHub.

---

## 3. Step-by-Step: Setting up Branch Protection Rules

Branch protection ensures no one can accidentally push broken code directly to `main` or `develop`.

1. Go to your repository on GitHub.
2. Click **Settings** > **Branches** (under Code and automation).
3. Click **Add branch protection rule**.
4. In **Branch name pattern**, type `main`.
5. Check these boxes:
   - **Require a pull request before merging**: (Set Require approvals: 1 or 2).
   - **Require status checks to pass before merging**: Search for your CI job name (e.g., `lint · typecheck · test · build`) and select it. This makes the `ci` action a strict requirement.
   - **Do not allow bypassing the above settings**.
6. Click **Create**.
7. Repeat steps 3-6, but this time type `develop` for the Branch name pattern.

---

## 4. Managing Deployments for Staging (`develop`) vs Production (`main`)

Currently, your `.github/workflows/ci-cd.yml` only deploys when code hits `main`. To make `develop` your staging environment, you need to deploy it to separate Vercel and Railway targets.

### Option A: Using GitHub Environments (Recommended & Cleanest)

GitHub allows you to create "Environments" (like `production` and `staging`). You can put secrets with the **exact same name** inside these environments.

1. Go to GitHub **Settings** > **Environments** > **New Environment**. Create one named `production` and one named `staging`.
2. Inside the `production` environment, add secrets: `VERCEL_PROJECT_ID` (prod project), `RAILWAY_SERVICE_ID` (prod API), etc.
3. Inside the `staging` environment, add secrets: `VERCEL_PROJECT_ID` (staging project), `RAILWAY_SERVICE_ID` (staging API), etc.
4. In your `.github/workflows/ci-cd.yml`, you define the `environment: staging` tag inside the deploy jobs for `develop`.

### Option B: Using Suffixed Secrets (Easier to see at a glance)

You keep all secrets in the repository-level secrets list, but name them differently.

**Secrets required in GitHub:**
- `VERCEL_TOKEN` (same for both)
- `VERCEL_ORG_ID` (same for both)
- `VERCEL_PROJECT_ID_PROD` (Production Frontend ID)
- `VERCEL_PROJECT_ID_STAGING` (Staging Frontend ID)
- `RAILWAY_TOKEN` (same for both, assuming same Railway account)
- `RAILWAY_SERVICE_ID_PROD` (Production API Service UUID)
- `RAILWAY_SERVICE_ID_STAGING` (Staging API Service UUID)

### How to modify the `ci-cd.yml` file (Option B Example)

You need to add new jobs in `.github/workflows/ci-cd.yml` specifically for `develop`. They look exactly like your current deployment jobs, but they target `develop` instead of `main` and use the staging secrets.

```yaml
  # -------------------------------------------------------------------------
  # STAGING DEPLOYMENTS (develop branch)
  # -------------------------------------------------------------------------
  deploy-vercel-staging:
    name: deploy · Vercel Staging
    needs: [ci, paths]
    if: >
      success() &&
      github.ref == 'refs/heads/develop' &&
      (github.event_name == 'push' || github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    env:
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID_STAGING }}
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - run: npm install --global vercel@latest
      # Notice we removed the --prod flag here so Vercel treats it as a preview/staging environment
      - run: vercel deploy --yes --token=${{ secrets.VERCEL_TOKEN }}
      
  deploy-railway-staging:
    name: deploy · Railway Staging
    needs: [ci, paths]
    if: >
      success() &&
      github.ref == 'refs/heads/develop' &&
      (github.event_name == 'push' || github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    env:
      RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      RAILWAY_SERVICE_ID: ${{ secrets.RAILWAY_SERVICE_ID_STAGING }}
    steps:
      - uses: actions/checkout@v4
      - run: npm install --global @railway/cli@latest
      - run: railway up --ci --service "$RAILWAY_SERVICE_ID"
```

## 5. Setting up Staging on Railway & Vercel

Before the staging deployments will work, you need to create the actual environments on Railway and Vercel.

### On Vercel:
Vercel is very smart. You can actually use the exact same `VERCEL_PROJECT_ID` for both staging and production! If you remove the `--prod` flag from the `vercel deploy` command (as shown in the YAML above), Vercel automatically deploys a "Preview" URL instead of overwriting your live domain. 
*Alternative:* Create a completely separate Project in Vercel named `gorola-staging` and use its ID.

### On Railway:
1. Go to your GoRola project on Railway.
2. In the top right, click on your current environment (usually named `production`).
3. Click **Create Environment** and name it `staging`.
4. Railway will automatically duplicate your Postgres database and API service into this new environment. It gives you a clean database so test data doesn't mix with real user data!
5. Click on the API service inside this new `staging` environment to find your new `RAILWAY_SERVICE_ID` for staging.
6. Add this ID to your GitHub secrets as `RAILWAY_SERVICE_ID_STAGING` (or to the `staging` GitHub Environment).
