# authorization

## 1. Master Authorization Query

To eliminate repetitive 7-table SQL joins on every HTTP request, authorization resolution is centralized into `MasterAuthzService.resolveAuthContext(userId, gymId, branchId)`:

```sql
SELECT 
  u.id, u.name, u.authz_version,
  gm.id as gym_id, gm.gym_name,
  bm.id as branch_id, bm.branch_name,
  sp.plan_code as subscription_plan,
  ugm.group_code as role,
  array_agg(DISTINCT upm.permission_code) as permissions
FROM users u
JOIN gym_user gu ON gu.user_id = u.id
JOIN gym_master gm ON gm.id = gu.gym_id
LEFT JOIN gym_branch_master bm ON bm.gym_id = gm.id
LEFT JOIN subscription_plan sp ON sp.id = gm.subscription_plan_id
LEFT JOIN gym_user_group gug ON gug.gym_user_id = gu.id
LEFT JOIN user_group_master ugm ON ugm.id = gug.group_id
LEFT JOIN user_group_permission ugp ON ugp.group_id = ugm.id
LEFT JOIN user_permission_master upm ON upm.id = ugp.permission_id
LEFT JOIN gym_permission gp ON gp.permission_id = upm.id AND gp.gym_id = gm.id
WHERE u.id = :userId AND gm.id = :gymId AND gp.is_enabled = true
GROUP BY u.id, gm.id, bm.id, sp.plan_code, ugm.group_code;
```

---

## 2. Redis Authorization Cache Structure

Key Pattern: `authz:u:<userId>:g:<gymId>:b:<branchId>`  
TTL: 3600 seconds (1 hour) with in-memory fallback.

```json
{
  "user": {
    "id": 6,
    "name": "krishankant.s",
    "email": "test@gmail.com",
    "phone": "9638527410"
  },
  "gym": {
    "id": 1,
    "code": "GYM_1",
    "name": "Saraswat (Franchise)"
  },
  "branch": {
    "id": 1,
    "code": "BR_1",
    "name": "Saraswat",
    "city": "Gurgaon"
  },
  "subscription": {
    "code": "PRO",
    "name": "Pro Multi-Branch",
    "features": {
      "ai_coach": true,
      "multi_branch": true,
      "whatsapp": true,
      "advanced_analytics": true
    }
  },
  "role": "GYM_OWNER",
  "permissions": [
    "MEMBER_VIEW", "MEMBER_CREATE", "MEMBER_UPDATE", "MEMBER_DELETE",
    "ATTENDANCE_VIEW", "ATTENDANCE_CREATE", "PAYMENT_VIEW", "PAYMENT_APPROVE",
    "AI_COACH_VIEW", "AI_COACH_USE", "BRANCH_MANAGE"
  ],
  "menus": [
    { "id": 1, "code": "DASHBOARD", "name": "Overview", "route": "/dashboard", "icon": "fas fa-home" },
    { "id": 2, "code": "MEMBERS", "name": "Members", "route": "/members", "icon": "fas fa-users" }
  ],
  "available_gyms": [{ "id": 1, "code": "GYM_1", "name": "Saraswat (Franchise)" }],
  "available_branches": [{ "id": 1, "code": "BR_1", "name": "Saraswat" }],
  "authz_version": 1
}
```

---

## 3. Effective Permission Formula

A request is allowed if and only if:
```text
Effective Permission = 
    User Role Permission (user_group_permission)
    AND Gym Feature Permission (gym_permission)
    AND Branch Access Authorized (gym_branch_user)
    AND User Active
    AND Tenant Active
    AND Subscription Active
```

---

## 4. Authorization Invalidation (authz_version)

When any permission, role, or subscription change occurs:
1. `authz_version` is incremented on `users` table.
2. `redisService.invalidatePattern("authz:u:<userId>:*")` purges stale context.
3. Next request triggers Master Authorization Query to re-cache fresh context within 2ms.