# Implementation Plan: Connecting Landing Page to Omega & SaaS Integration

This plan outlines the architecture and steps to route the "Launch Omega" action to the Next.js Omega app, synchronize user auth sessions, set up database tables for chat histories/limits, and handle parallel multi-user execution.

## Proposed Changes

We will link the two codebases and build the authentication and persistence layers.

---

### 1. Connecting Landing Page Traffic

#### [MODIFY] [api/index.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/api/index.py)
- Change the URL destination for the `omega` key in `PRODUCT_URLS` to check for an environment variable `OMEGA_APP_URL`.
- Default the fallback destination to `http://localhost:3001` for local development.

---

### 2. User Session Synchronization & Auth

#### [NEW] [Omega_Streamlit/pages/_app.tsx](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/pages/_app.tsx)
- Integrate Clerk Auth wrapper `<ClerkProvider>` to match NexAlpha's setup.
- Restrict dashboard access to authenticated users only using Clerk middleware or route checks.

#### [NEW] [Omega_Streamlit/pages/profile.tsx](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/pages/profile.tsx)
- Add a user profile and settings page displaying active subscription tiers and usage tracking.

---

### 3. Database Layer (History & Limit Tracking)

#### [NEW] Database Engine (Prisma / PostgreSQL or SQLite)
- Implement schema models for:
  - `User`: Storing Clerk ID, active subscription tier, and custom limits.
  - `Project`: Storing user datasets, query configurations, and active state.
  - `ChatMessage`: Storing agent plans, code outputs, visual Plotly specs, and user prompts for session recovery.
  - `UsageLog`: Storing query count logs to enforce limits.

---

### 4. Code Execution Sandbox & Parallel Execution

#### [MODIFY] [Omega_Streamlit/src/interpreter.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/interpreter.py)
- Ensure execution state (active dataframe `df`) and file operations are sandboxed *per session/user* (e.g., inside isolated temp directories or distinct database records) rather than writing to shared static locations to allow multi-user parallel usage.

---

## Open Questions

> [!IMPORTANT]
> **1. Database Engine Preference**
> Which database platform would you prefer to use for persisting chat history and limit logs?
> - **PostgreSQL** (Recommended for scalable SaaS hosting)
> - **SQLite** (Simpler, zero-config setup for local development)
>
> **2. Environment URLs**
> What is the target development domain/port where your Next.js Omega app is currently hosted? (e.g. `http://localhost:3001`)

---

## Verification Plan

### Manual Verification
- Log in to NexAlpha, press "Launch Omega", and confirm seamless SSO login redirection to the Omega dashboard.
- Verify that different users can run parallel queries on distinct datasets without overriding each other's execution context.
