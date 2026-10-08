# migration

## 1. Migration Execution Pipeline

The migration pipeline follows the Zero Data Loss Principle:

```text
Existing Software (users, gyms, client_master)
       │
       ▼
1. Backup Validation (pg_dump)
       │
       ▼
2. DDL Execution (20261008_upgrade_to_multi_tenant_ai_gym_os.sql)
       │
       ▼
3. Non-Destructive Data Backfill:
     - users -> populated with first_name, last_name, country_code, authz_version
     - client_master -> gym_master
     - gyms -> gym_branch_master
     - owners -> gym_user & gym_user_group (GYM_OWNER)
     - members -> gym_user & gym_user_group (MEMBER)
     - owner branches -> gym_branch_user
       │
       ▼
4. Seed Masters (user_group_master, user_permission_master, subscription_plan, client_menu_master)
       │
       ▼
5. Post-Migration Verification (`scripts/test_multi_tenant_system.js`)
```

---

## 2. Verification Command

To apply and verify database migrations:

```bash
node scripts/migrate_v2_foundation.js
node scripts/test_multi_tenant_system.js
```

---

## 3. Rollback Strategy

In the event of an unexpected rollback requirement:
1. All legacy tables (`users`, `gyms`, `client_master`, `user_plans`, `plans`, `wallet_transactions`) retain their original schema and row data intact.
2. The legacy application code can continue functioning against the original tables.
3. If necessary, newly created tables (`gym_master`, `gym_branch_master`, `gym_user`, etc.) can be archived or dropped without affecting legacy columns.