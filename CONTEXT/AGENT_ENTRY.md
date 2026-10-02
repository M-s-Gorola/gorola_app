# GoRola — Agent Entry Point
> **READ THIS FILE FIRST. Every session. No exceptions.**
> This is your north star. It tells you exactly what to read, in what order, and how to work on this project.

---

## Who Are You?

You are an expert full-stack TypeScript engineer working on **GoRola** — a premium quick-commerce platform for the Mussoorie hills, India. You are building this with a senior architect who has 20+ years of experience at Google, Microsoft, Meta, and Anthropic.

**Your operating principles:**
1. TDD is non-negotiable. Write tests first. Always.
2. Production-grade quality only. No shortcuts, no "we'll clean this up later."
3. When in doubt, read the rules_and_spec.md. The rules win.
4. Update current_state.md at the end of EVERY session.

---

## File Navigation Guide

Read these files in this order at the start of each session:

### 1. `current_state.md` ← START HERE, EVERY SESSION
**What it tells you:** The master index. Overall phase status, what's in progress, environment keys, URLs, session notes.
**When to update:** End of every session — update "In Progress Right Now", "Last Updated", and append to "Session Notes".
**Key sections:**
- "In Progress Right Now" → your starting point
- "Phase File Navigation" → tells you which file to open next
- "Known Issues & Blockers" → things that will bite you
- "Session Notes" → history of decisions made mid-session

### 1b. Phase Files ← READ YOUR ACTIVE PHASE FILE AFTER `current_state.md`
**The detailed checklists AND your session stopping point live here — not in `current_state.md`:**

| File | Contains | When to read |
|------|----------|--------------|
| `phase1_2_state.md` | Phase 1 & 2 checklists + **own `📍 Last Updated`** + all session history | When working on Phase 2.23 (E2E). **Locks after 2.23 complete.** |
| `phase3_4_state.md` | Phase 3 & 4 checklists with TDD steps + backend controllers + **own `📍 Last Updated`** | When starting Phase 3 or 4 |
| `phase5_state.md` | Phase 5 (Rider Interface) checklist + **own `📍 Last Updated`** | When starting Phase 5 |

**Each phase file has a `## 📍 Last Updated` block near the top.** This is your exact stopping point — read it right after the Phase Status table.

**When to update phase files:** At the end of every session — update the `## 📍 Last Updated` block (date, summary, next task, blocker), mark completed checklist items `[x]`, and append to `## Session Notes` at the bottom.

### 2. `rules_and_spec.md` ← INTERNALIZE ONCE, REFERENCE ALWAYS
**What it tells you:** Every non-negotiable rule. TDD rules, architecture rules, security rules, API design rules, naming conventions.
**When to re-read:** When you're about to do something and you're not sure if it's the right way.
**Critical sections:**
- Section 2: TDD Rules → how to write tests before code
- Section 3: Architecture Rules → controller/service/repository boundaries
- Section 4: API Design → response envelope, status codes
- Section 5: Database Rules → migrations, soft delete, transactions
- Section 6: Auth Rules → JWT, OTP, RBAC

### 3. `project_data.json` ← FACTS & SPECS
**What it tells you:** What GoRola is, who uses it, tech stack choices, all entities, build sequence.
**When to reference:** When you need to know a specific fact (which OTP provider? what payment methods? what categories exist?).
**Key fields:**
- `build_sequence` → the exact order to build things
- `database_schema_entities` → all DB tables
- `environment_variables_required` → all required env vars
- `design_system.colors` → exact hex codes to use

### 4. `architecture.md` ← THE SYSTEM MAP
**What it tells you:** How every piece connects. Data flows. Module map. API routes. Redis keys. WebSocket events.
**When to reference:** When adding a new feature (where does it go?), debugging a data flow (what calls what?), or understanding the full request lifecycle.
**Key sections:**
- "Module Map" → where to put your code
- "Data Flow: Placing an Order" → reference for any order-related work
- "Redis Key Schema" → what keys exist and their TTL
- "Frontend Routing Structure" → where pages live

### 5. `decision_log.md` ← THE WHY
**What it tells you:** Why every major architectural choice was made. What was rejected and why.
**When to reference:** When you're wondering "why are we using X instead of Y?" — it's in here.
**When to add:** When you make a significant new architectural choice mid-build. Add a new DECISION-XXX entry.

---

## Starting a New Session: The 5-Minute Ritual

```
1. Read current_state.md → check Overall Phase Status table to confirm active phases
2. Open the phase file for your active phase (phase1_2_state.md / phase3_4_state.md / phase5_state.md)
3. Read the phase file's "📍 Last Updated" block at the top → this is your exact stopping point
4. Skim the relevant checklist section in that phase file
5. If starting a brand new feature: read the relevant section of rules_and_spec.md
6. If confused about where code lives: check architecture.md Module Map
7. Begin work from the stopping point in the phase file — NOT from current_state.md
```

---

## Ending a Session: The Mandatory Checklist

Before closing, ALWAYS do ALL of these:

```
─── WRITE TO YOUR PHASE FILE (do this every session) ───────────────────────
□ Update the "📍 Last Updated" block at the TOP of your phase file:
    □ Date (today)
    □ Session Summary (2-3 sentences: what was accomplished)
    □ Next Session Must Start With (specific enough for a different agent to pick up)
    □ In Progress Right Now (exact file + task)
    □ Current Blocker (or "None")
□ Mark completed checklist items [x] in your phase file
□ Append phase-specific decisions to "Session Notes" at the BOTTOM of your phase file
□ Update "Test Coverage Status" in current_state.md if total test count changed

─── WRITE TO current_state.md ONLY IF (rare events) ────────────────────────
□ A phase changed status → update "Overall Phase Status" table + "Phase File Navigation" table
□ A new environment variable was added → update "Environment & Keys Status"
□ A cross-cutting architectural decision was made → append to "Cross-Cutting Architectural Decisions"
□ A new Known Issue/Blocker was discovered that affects multiple phases → update "Known Issues & Blockers"
```

---

## TDD: The Non-Negotiable Workflow

**For every new module/feature, follow this exact sequence:**

```
Step 1: Create the test file
─────────────────────────────
File: src/__tests__/unit/[module]/[service].test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { [ServiceName] } from '../../../modules/[module]/[module].service';
// Mock all dependencies

Step 2: Write ALL test cases (no implementation yet)
─────────────────────────────────────────────────────
For each method, write:
  ✓ Happy path (normal inputs, expected output)
  ✓ Edge case 1 (empty array, zero value, null input)
  ✓ Edge case 2 (max value, boundary condition)
  ✓ Error case 1 (invalid input format)
  ✓ Error case 2 (dependency throws an error)
  ✓ Security case 1 (SQL injection attempt in string field)
  ✓ Security case 2 (unauthorized access attempt)

All tests return expect(true).toBe(false) initially — ensuring RED state.

Step 3: Run tests → confirm RED
─────────────────────────────────
pnpm test --filter=api -- --run

Step 4: Create the types and error files (no logic yet)
─────────────────────────────────────────────────────────
[module].types.ts — TypeScript interfaces
[module].errors.ts — Domain error classes
[module].schema.ts — Zod validation schemas

Step 5: Create the repository (data access layer)
───────────────────────────────────────────────────
Write repository integration tests first (using test DB)
Then implement repository methods

Step 6: Create the service (business logic)
─────────────────────────────────────────────
Implement just enough to make unit tests GREEN
No more, no less

Step 7: Create the controller (HTTP layer)
───────────────────────────────────────────
Integration tests with Supertest
Register route in Fastify

Step 8: Refactor
──────────────────
Make it clean — all tests must stay GREEN
```

---

## Code Quality Gates (Never Bypass These)

```bash
# Run before every commit:
pnpm lint          # Must pass with 0 errors, 0 warnings
pnpm typecheck     # Must pass with 0 errors
pnpm test          # Must pass with 0 failures
pnpm build         # Must succeed

# Check coverage:
pnpm test:coverage
# Coverage must be ≥ 80% overall
# Coverage must be 100% for: auth module, order module payment flow
```

---

## Project Quick Reference

### Tech Stack At a Glance
```
Backend:    Fastify v4 + TypeScript (strict) + Prisma + PostgreSQL + Redis + BullMQ
Frontend:   React 18 + Vite + Tailwind CSS v4 + shadcn/ui + GSAP + Lenis
Testing:    Vitest + Supertest + Playwright
Deployment: Railway (API + DB + Redis) + Vercel (frontend)
CI/CD:      GitHub Actions
```

### API Response Shape (Always)
```typescript
// Success
{ success: true, data: T, meta: { requestId: string } }

// Error
{ success: false, error: { code: string, message: string, details?: ZodIssue[] } }
```

### Module Boundaries (Hard Rules)
```
Controller → calls → Service
Service    → calls → Repository
Repository → calls → Prisma

Controller NEVER touches Prisma directly
Service NEVER imports HTTP types (Request, Reply)
Repository NEVER contains if/else business logic
```

---

## Domains & What's In Each

| Domain | Actors | Key Operations |
|--------|--------|----------------|
| auth | All | OTP, JWT, 2FA, token refresh, logout |
| catalog | Buyer (read), Store Owner (write), Admin (manage) | Products, categories, variants, search |
| cart | Buyer | Add/remove/update items, view cart |
| order | Buyer (place), Store Owner (fulfill), Admin (view all) | Place, status updates, history |
| user | Buyer | Profile, saved addresses |
| store | Store Owner (own store), Admin (all stores) | Store info, settings |
| promotion | Store Owner (create), Admin (approve), Buyer (consume) | Ads, offers, discount codes |
| feature-flag | Admin (manage), All Services (read) | Enable/disable features |
| audit | Admin (read), System (write) | Immutable log of all admin/store actions |
| delivery | STUB — Phase 5 | Rider interface, location tracking |

---

## Reminder: What NOT to Do

```
❌ Never write code before writing a failing test
❌ Never use 'any' in TypeScript
❌ Never store JWT tokens in localStorage
❌ Never log OTPs, passwords, or tokens
❌ Never hardcode API keys or secrets
❌ Never skip the Zod validation at the controller
❌ Never bypass CI with --force push
❌ Never hard-delete user records
❌ Never put business logic in controllers
❌ Never put HTTP concepts (req, reply) in services
❌ Never use raw SQL without parameterization
❌ Never implement the rider interface in v1 (stubs only)
❌ Never use pin code fields in address forms
❌ Never deploy on Fridays
```

---

## If You're Stuck

1. **Architecture question** → `architecture.md` Module Map or Data Flow sections
2. **"Should I use X or Y?"** → `decision_log.md` — it might already be decided
3. **"How should this be structured?"** → `rules_and_spec.md` Section 3 (Architecture Rules)
4. **"What's the correct API response shape?"** → `rules_and_spec.md` Section 4
5. **"What env var do I need?"** → `project_data.json` → `environment_variables_required`
6. **"What should I build next?"** → `current_state.md` → current checklist item

---

*GoRola — Mussoorie, delivered.*
*Built with care for the hills and the people who live in them.*
