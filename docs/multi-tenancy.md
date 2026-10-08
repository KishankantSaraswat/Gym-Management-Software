# multi-tenancy

## 1. Multi-Tenancy Model: Shared Database, Isolated Schemas / Foreign Keys

AI Gym OS uses a high-performance **Pooled Multi-Tenant Architecture**:
- All tenant business tables carry `gym_id` (foreign key to `gym_master`).
- All branch-level business tables carry `branch_id` (foreign key to `gym_branch_master`).
- Composite indexes enforce fast, isolated lookups without data leakage:
  ```sql
  CREATE INDEX idx_user_plans_tenant ON user_plans(gym_id, userId);
  CREATE INDEX idx_gym_daily_stats_tenant ON gym_daily_stats(gym_id, date);
  ```

---

## 2. Strict IDOR Prevention Rules

1. **Golden Rule:** Never trust `gymId` or `branchId` provided by client headers or URL params.
2. In all controllers:
   ```javascript
   await authorizationService.assertTenantOwnership(req, targetGymId);
   await authorizationService.assertBranchAccess(req, targetGymId, targetBranchId);
   ```
3. Queries MUST be scoped:
   ```sql
   SELECT * FROM plans WHERE gymId = :authenticatedGymId AND id = :planId;
   ```

---

## 3. Multi-Gym Membership Capability

A single user can belong to multiple gyms simultaneously:
```text
User A (user_master)
  ├── Gym 1 (gym_master: FitZone)      -> Role: GYM_OWNER
  ├── Gym 2 (gym_master: Gold's Gym)   -> Role: TRAINER
  └── Gym 3 (gym_master: Iron Den)     -> Role: MEMBER
```
Gym switching is handled via `POST /api/v1/auth/switch-gym` without requiring separate user accounts or logging out.