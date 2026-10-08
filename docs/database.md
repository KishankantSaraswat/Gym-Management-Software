# database

## 1. Entity Relationship Diagram (ERD)

```text
  users (Global Identity)
    │
    ├──< gym_user >───────────┐
    │        │                │
    │        ▼                ▼
    │   gym_branch_user   gym_master (Tenant)
    │        │                │
    │        ▼                ├──< gym_branch_master (Branches)
    │   gym_branch_master     │
    │                         ├──< gym_permission >──── user_permission_master
    │                         │
    │                         └──< gym_subscription >── subscription_plan
    │
    └──< gym_user_group >──── user_group_master
                                  │
                                  └──< user_group_permission >──── user_permission_master
                                                                       │
                                  client_menu_master <────── client_menu_permission
```

---

## 2. Target Core Data Tables

### 2.1 `users` (Global Identity)
- `id` (PK, SERIAL)
- `first_name` VARCHAR(100)
- `last_name` VARCHAR(100)
- `name` VARCHAR(255)
- `email` VARCHAR(255) UNIQUE
- `phone` VARCHAR(50)
- `country_code` VARCHAR(10) DEFAULT '+91'
- `password` VARCHAR(255)
- `role` ENUM('User', 'GymOwner', 'Admin')
- `isSuperAdmin` BOOLEAN
- `accountVerified` BOOLEAN
- `authz_version` INTEGER DEFAULT 1

### 2.2 `gym_master` (Tenant Organization)
- `id` (PK, SERIAL)
- `gym_code` VARCHAR(50) UNIQUE
- `gym_name` VARCHAR(255) NOT NULL
- `legal_name` VARCHAR(255)
- `email` VARCHAR(255)
- `phone` VARCHAR(50)
- `logo_url` TEXT
- `owner_id` INTEGER FK -> users(id)
- `subscription_plan_id` INTEGER FK -> subscription_plan(id)
- `status` VARCHAR(50) DEFAULT 'active'

### 2.3 `gym_branch_master` (Branch Location)
- `id` (PK, SERIAL)
- `gym_id` INTEGER NOT NULL FK -> gym_master(id)
- `branch_code` VARCHAR(50) NOT NULL
- `branch_name` VARCHAR(255) NOT NULL
- `address` TEXT NOT NULL
- `city` VARCHAR(100)
- `pincode` VARCHAR(20)
- `latitude` DOUBLE PRECISION
- `longitude` DOUBLE PRECISION
- `capacity` INTEGER DEFAULT 50
- `open_time` VARCHAR(20) DEFAULT '06:00'
- `close_time` VARCHAR(20) DEFAULT '22:00'
- `status` VARCHAR(50) DEFAULT 'active'
- CONSTRAINT: `UNIQUE(gym_id, branch_code)`

### 2.4 `gym_user` (Tenant Membership)
- `id` (PK, SERIAL)
- `user_id` INTEGER NOT NULL FK -> users(id)
- `gym_id` INTEGER NOT NULL FK -> gym_master(id)
- `user_type` VARCHAR(50) DEFAULT 'MEMBER' (OWNER, STAFF, MEMBER)
- `status` VARCHAR(50) DEFAULT 'active'
- `joined_at` TIMESTAMP
- CONSTRAINT: `UNIQUE(user_id, gym_id)`

### 2.5 `gym_branch_user` (Branch Access)
- `id` (PK, SERIAL)
- `gym_id` INTEGER NOT NULL FK -> gym_master(id)
- `branch_id` INTEGER NOT NULL FK -> gym_branch_master(id)
- `gym_user_id` INTEGER NOT NULL FK -> gym_user(id)
- `is_active` BOOLEAN DEFAULT true
- CONSTRAINT: `UNIQUE(gym_user_id, branch_id)`

### 2.6 `user_group_master` (Role Master)
- `id` (PK, SERIAL)
- `group_code` VARCHAR(100) UNIQUE NOT NULL (SUPER_ADMIN, GYM_OWNER, BRANCH_MANAGER, TRAINER, RECEPTIONIST, etc.)
- `group_name` VARCHAR(150) NOT NULL
- `gym_id` INTEGER FK -> gym_master(id) (NULL for system roles)
- `is_system` BOOLEAN DEFAULT true

### 2.7 `gym_user_group` (Role Assignment)
- `id` (PK, SERIAL)
- `gym_user_id` INTEGER NOT NULL FK -> gym_user(id)
- `group_id` INTEGER NOT NULL FK -> user_group_master(id)
- `branch_id` INTEGER FK -> gym_branch_master(id) (NULL = Tenant-wide)
- `is_primary` BOOLEAN DEFAULT true
- `is_active` BOOLEAN DEFAULT true

### 2.8 `user_permission_master` & `user_group_permission`
- Granular permission registry (MEMBER_VIEW, ATTENDANCE_CREATE, PAYMENT_APPROVE, AI_COACH_USE).
- Maps roles to view, create, update, delete capabilities.

### 2.9 `user_session` & `audit_log`
- Tracks multi-device sessions, revocations, and business audit logs.