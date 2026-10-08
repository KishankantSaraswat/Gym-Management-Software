# architecture

## 1. High-Level Architecture Overview

AI Gym OS is a production-ready, multi-tenant, multi-branch, RBAC-powered SaaS platform designed to scale to **10+ crore (100M+) users**, 10,000+ gyms, and 100,000+ branches.

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

---

## 2. Layered Architecture

1. **Client Layer:**
   - Web Partner SaaS (`Gymhood-Partner`): React 19 + Vite dashboard with dynamic menus and gym/branch switchers.
   - Web Platform Admin (`gymhood-admin`): Global management, plans, and tenant verification.
   - Mobile Member App (`gymsclient-frontend`): React Native / Expo iOS & Android app.

2. **Edge & Ingress Layer:**
   - Cloudflare CDN / WAF: SSL termination, DDoS protection, rate limiting, and static file caching.
   - Load Balancer: Round-robin / least-connections proxy across horizontal API server nodes.

3. **Application Layer (Node.js & Express):**
   - Versioned API Routers: `/api/v1/auth`, `/api/v1/tenants`, `/api/v1/branches`, `/api/v1/menus`, etc.
   - Middlewares: Compact JWT verification, Session revocation check, Tenant isolation guard, RBAC permission checker, Audit logger.
   - Modular Domain Services: `AuthService`, `SessionService`, `MasterAuthzService`, `AuthorizationService`, `GymService`, `PlanService`, etc.

4. **Cache & State Layer (Redis):**
   - Redis Cluster / Standalone:
     - Authorization Context Cache (`authz:u:<userId>:g:<gymId>:b:<branchId>`).
     - Session tracking & rate-limiting.
     - Sub-2ms authorization response times.

5. **Persistence Layer (PostgreSQL):**
   - Master-Replica architecture: Primary instance for ACID transactions (writes), Read Replicas for reporting and analytics.
   - Strict Foreign Key constraints, tenant isolation indexing, and connection pooling (PgBouncer).