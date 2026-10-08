# EXISTING ARCHITECTURE ANALYSIS & AUDIT REPORT

**System:** GymHood / AI Gym OS Backend & Multi-Client Ecosystem  
**Audit Date:** October 2026  
**Architect:** Senior Software Architect + Backend Architect + Database Architect + Security Engineer + SaaS Architect  

---

## 1. Executive Summary

GymHood is currently an operational Gym Management platform consisting of:
1. **Backend:** Express.js (v4.21.2) + Node.js (ES Modules) with Sequelize ORM (v6.37.8) and PostgreSQL (v8.23.1).
2. **Frontend ecosystem:**
   - `Gymhood-Partner`: React 19 + Vite web dashboard for Gym Owners / Managers.
   - `gymhood-admin`: React 19 + Vite web dashboard for Platform Super Admins.
   - `gymsclient-frontend`: React Native (v0.81.5) + Expo (v54) mobile app for Gym Members / End Users.
3. **Database:** PostgreSQL on localhost:5432 (`gymhood`), with existing production schema housing users, gym records, subscriptions, media, and transactional models.

The current system was originally conceived as a **single-gym per owner** marketplace / directory with gym management features. Recent preliminary changes attempted to introduce a `client_master` tenant model and basic menu/permission schema tables, but the core business logic, authentication pipeline, authorization enforcement, and database relationships remain single-tenant and role-restricted.

This document presents the detailed architectural inspection, identifies critical security and scalability bottlenecks, and establishes the safe, non-destructive migration roadmap toward a **Scalable Multi-Tenant Multi-Branch AI Gym OS (supporting 100M+ users)**.

---

## 2. Current Architecture & Modules

### 2.1 Backend Architecture
```text
Express App (app.js)
  ├── Middlewares (cors, cookieParser, request-logger, multer, errorMiddleware)
  ├── Routes:
  │    ├── /auth                 -> authRouter.js (Auth, Registration, OTP, Passwords)
  │    ├── /gymdb                -> 1_gymShoodDbRoute.js (Gyms, Plans, Attendance, QR, Analytics)
  │    ├── /admin                -> adminRoutes.js (Platform SuperAdmin management)
  │    ├── /admin-plans          -> adminPlanRoutes.js (SaaS subscription plan master)
  │    ├── /partner-subscription -> gymSubscriptionRoutes.js (Gym subscription checkout & status)
  │    ├── /payment              -> payment.routes.js (Wallet, Settlements, Payouts)
  │    ├── /user-data            -> userDataRoutes.js (Fitness & onboarding surveys)
  │    └── /api/v1/menus         -> menuRoutes.js (Experimental RBAC menu endpoint)
  └── Database Layer:
       ├── Sequelize ORM (database/db.js)
       ├── Models (models/schema.js, models/auth_schema.js, models/index.js)
       ├── Repositories (controllers -> services -> repositories pattern)
```

### 2.2 Existing Business Modules
1. **Authentication & Identity (`authController.js`, `authService.js`):**
   - Email/password registration with 6-digit email OTP verification.
   - Google Sign-In (`google-auth-library`).
   - Role-based login (`User`, `GymOwner`, `Admin`).
   - Forgot & Reset password with time-expiring OTP and reset session ID.
   - FCM token registration for push notifications.
2. **Gym / Branch Management (`1_gymReg.js`, `gymService.js`):**
   - Gym profile registration, media gallery, verification KYC documents (GST, ID proof).
   - Capacity, opening/closing hours, facilities, equipment, geolocation (lat/long).
   - Restricted to **1 gym per owner** (enforced in `gymService.registerGymService`).
3. **Membership Plans & Purchases (`3_planMang.js`, `4_userPlanController.js`):**
   - Gym owners create plans (price, duration, discounts, trainer included).
   - Users purchase plans via Razorpay or Cash request.
   - Gym owners approve or reject cash enrollment requests.
4. **Attendance & QR Check-In (`4_userGymEntry.js`, `gymEntryService.js`):**
   - QR code check-in and check-out.
   - Active capacity tracking.
   - Streak calculation and yearly check-in heatmap.
   - Daily attendance register and auto-cleanup of expired active users.
5. **Wallet, Settlements & Revenue (`walletController.js`, `paymentService.js`):**
   - User wallet transactions (Credit/Debit via Razorpay).
   - Gym settlement payout requests and admin approval workflow.
6. **Analytics & Dashboard (`6_dashboardController.js`):**
   - Overview metrics, revenue charts, member growth analytics, active members table.
7. **Platform Admin (`2_adminController.js`, `adminPlanController.js`):**
   - Gym verification toggles, platform-wide announcements, SaaS subscription tier management.

---

## 3. Current Database Schema Audit

| Table Name | Existing Columns / Purpose | Status / Issue |
|---|---|---|
| `users` | `id, name, email, password, role, isSuperAdmin, phone, address, pincode, lat/lng, profile_picture, accountVerified, fcmToken, etc.` | **Global User**: Role is hardcoded enum (`User`, `GymOwner`, `Admin`). A user cannot belong to multiple gyms with different roles. Phone is not uniquely constrained. |
| `client_master` | `id, name, contactEmail, contactPhone, ownerId, status, isDeleted` | Tenant master exists in draft form, but is decoupled from user memberships and branch permissions. |
| `gyms` | `id, clientId, name, address, lat, lng, capacity, contactEmail, phone, ownerId, subscriptionStatus, etc.` | Represents both a Gym and a Branch interchangeably. `clientId` is nullable. Business logic still ties gym directly to single `ownerId`. |
| `user_branch_mapping` | `id, userId, gymId, roleId, isPrimary, status` | Created as preliminary table (0 rows). Unused in live auth and business controllers. |
| `user_group_master` | `id, clientId, name, description, type, status` | 0 rows. Not linked to platform RBAC. |
| `app_menu_master` | `id, menuCode, menuName, parentId, route, sortOrder, appMenu, isActive` | 0 rows. Menus are currently hardcoded on frontends. |
| `client_menu_master` | `id, clientId, menuId, isEnabled, sortOrder` | 0 rows. Not enforced. |
| `permission_master` | `id, menuId, name, description` | 0 rows. No permissions populated. |
| `group_permission` | `id, groupId, permissionId, branchId` | 0 rows. |
| `user_permission` | `id, userId, permissionId, branchId, isAllowed` | 0 rows. |
| `admin_plans` | `id, name, description, duration, price, isActive` | SaaS subscription plans master (1 row). |
| `gym_subscriptions` | `id, gymId, adminPlanId, startDate, endDate, status, amountPaid` | Gym tenant subscription tracking (1 row). |
| `plans` | `id, gymId, name, validity, price, duration, features, isActive` | Gym membership plans (0 rows). |
| `user_plans` | `id, userId, gymId, planId, purchaseDate, totalDays, isExpired` | User gym memberships (0 rows). |
| `wallet_transactions` | `id, userId, amount, type, status, razorpayPaymentId` | Financial wallet ledger (0 rows). |
| `analytics_cache` | `id, gymId, type, data` | Cached revenue/member analytics JSON (2 rows). |
| `verification_documents` | `id, gymId, gstUrl, idProofUrl, certificationUrl` | Gym KYC documents (1 row). |

---

## 4. Current Authentication & Authorization Flaws

### 4.1 Authentication Flaws
1. **Flat Single-Role Token:**
   - JWT payload contains only `{ id: user.id }`.
   - Token does not encode active `gym_id`, active `branch_id`, or session identifiers.
   - No token refresh mechanism or session invalidation table (`user_session`).
   - If an admin revokes a user's permissions or branch access, the user retains access until token expiry (3 to 7 days).
2. **Phone Number Handling:**
   - Phone is optional and not unique across the table (`phone` is not constrained `UNIQUE(phone)` or `UNIQUE(country_code, phone)`).
   - Mobile-first login cannot reliably identify a user without normalized international E.164 phone numbers.
3. **No Multi-Gym Selection at Login:**
   - The login endpoint returns a single user profile. It cannot return the list of tenant gyms the user is authorized to access.

### 4.2 Authorization Flaws & Security Risks
1. **Broken Role-Based Authorization:**
   - Routes rely on `isGymOwner`, `isAdmin`, or `isMember`.
   - There are no intermediate roles (`BRANCH_MANAGER`, `TRAINER`, `RECEPTIONIST`, `ACCOUNTANT`, `NUTRITIONIST`).
   - A Gym Owner has God-mode access across all branch data, while staff cannot have granular permissions.
2. **Critical IDOR (Insecure Direct Object Reference) Vulnerabilities:**
   - In `routes/1_gymShoodDbRoute.js`:
     - `GET /dashboard/stats/:gymId`
     - `GET /dashboard/revenue/:gymId`
     - `GET /dashboard/members/:gymId`
     - `GET /gym/:id`
     - `PUT /gym/:id`
   - These routes take `:gymId` from URL params. While `isGymOwner` checks that the user's role is `GymOwner`, **several endpoints do not verify whether `gym.ownerId === req.user.id` or if the user is authorized for that specific branch**. An owner of Gym A could query `/dashboard/stats/2` to view Gym B's revenue!
3. **Subscription Feature Bypass:**
   - `isSubscriptionActive` checks whether `gym.subscriptionStatus === 'active'`.
   - However, **it does not check feature permissions**. Whether a gym is on a `FREE`, `BASIC`, or `ENTERPRISE` plan, all features (AI Coach, WhatsApp, Multi-Branch, Advanced Analytics) are accessible identically if the backend route is reached.
4. **Hardcoded Menus:**
   - The frontend `Sidebar.jsx` hardcodes navigation tabs. A receptionist or trainer sees buttons for revenue or full gym deletion unless protected.

---

## 5. Scalability & Architectural Bottlenecks (Path to 100M+ Users)

1. **Dangerous Automatic Sync (`sequelize.sync({ alter: true })`):**
   - Running `alter: true` on every server boot executes metadata locking queries against PostgreSQL. In a production cluster with multiple API nodes, concurrent `alter` statements cause deadlocks and catastrophic downtime.
2. **Missing Essential Indexes:**
   - No composite indexes on `(user_id, gym_id)`, `(gym_id, branch_id)`, or `(phone)`.
   - As table volumes reach millions of rows, QR check-ins, attendance scans, and revenue queries will trigger full-table scans.
3. **Absence of Redis Authorization Cache:**
   - Every request with dynamic permissions or multi-tenant authorization would require a 6-to-8 table SQL join (`user -> gym_user -> gym_branch_user -> gym_user_group -> group_permission -> gym_permission`). At 10,000 requests/sec, this will overwhelm PostgreSQL.
4. **No Connection Pool Optimization:**
   - Single connection pool configuration without read-replica routing or connection pooling proxy (such as PgBouncer).
5. **No Event/Audit Logging:**
   - Zero audit tracking for role assignments, permission mutations, payments, cash approvals, or subscription updates.

---

## 6. Migration Strategy & Principles

To safely transform the system without breaking existing functionality or losing data:

1. **Zero Data Loss Principle:**
   - All 7 existing users and existing gym records must be seamlessly migrated into the new `user_master`, `gym_master`, `gym_branch_master`, `gym_user`, and `gym_branch_user` structure.
   - Maintain compatibility views or model aliases so existing API endpoints continue to work without abrupt breaking changes.
2. **Database Migration Pipeline:**
   - Create explicit SQL migration scripts using PostgreSQL DDL.
   - Disable `sequelize.sync({ alter: true })` in production and use versioned, transaction-safe migration scripts.
3. **Backward-Compatible Layer:**
   - Existing endpoints (`/auth/login`, `/gymdb/gym/owner/me`, `/gymdb/gyms`) continue to return their expected JSON payloads.
   - New versioned endpoints (`/api/v1/auth/me`, `/api/v1/auth/login`, `/api/v1/tenants`, `/api/v1/branches`, `/api/v1/menus`) provide the multi-tenant AI Gym OS capabilities.
4. **Target Architecture Alignment:**
   - Follow the target core data model, RBAC system, gym-level feature permissions, compact JWT tokens, Redis cache abstraction, and tenant-isolated data queries.

---

## 7. Target Architecture Blueprint

```text
                               AI GYM OS (100M+ SCALE)
                                          │
                     ┌────────────────────┴────────────────────┐
                     │                                         │
             PLATFORM ADMIN                              TENANT GYMS
             (Super Admin)                                     │
                                                          GYM TENANT
                                                    (gym_master / Client)
                                                               │
                                       ┌───────────────────────┼───────────────────────┐
                                       │                       │                       │
                                   Branch 1                Branch 2                Branch N
                             (gym_branch_master)     (gym_branch_master)     (gym_branch_master)
                                       │                       │                       │
                                 Gym Employees           Gym Employees           Gym Employees
                                       │                       │                       │
                                  Gym Members             Gym Members             Gym Members
```

**Security Pipeline for Every Request:**
```text
Request (Header: Bearer JWT + X-Gym-Id + X-Branch-Id)
   │
   ▼
1. Rate Limiter (Redis)
   │
   ▼
2. JWT Token Verification (Compact: { sub, gym_id, branch_id, session_id, authz_version })
   │
   ▼
3. Redis Auth Context Cache Lookup (permissions, menus, subscription_plan, authz_version)
   ├── HIT: Verify authz_version & active status -> Proceed in < 2ms
   └── MISS: Execute Master Authorization Query -> Populate Redis -> Proceed
   │
   ▼
4. Tenant & Branch Isolation Enforcement (req.tenant.id, req.branch.id)
   │
   ▼
5. RBAC & Feature Permission Guard (AuthorizationService.can(user, permission, gym_id, branch_id))
   │
   ▼
6. Business Logic & Tenant-Scoped Database Query (WHERE gym_id = ? AND branch_id = ?)
   │
   ▼
7. Audit Log (Async Queue / Redis Stream / PostgreSQL)
```

