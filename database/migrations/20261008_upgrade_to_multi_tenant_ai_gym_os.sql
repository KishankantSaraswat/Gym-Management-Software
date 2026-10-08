-- ============================================================================
-- AI GYM OS: MASTER DATABASE MIGRATION SCRIPT
-- Version: 2.0.0
-- Target Architecture: Scalable Multi-Tenant Multi-Branch RBAC AI Gym OS
-- Safe & Non-Destructive: Preserves existing data in 'users', 'gyms', etc.
-- ============================================================================

BEGIN;

-- 1. EXTENSIONS & IDENTITY PREPARATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Alter 'users' to support normalized identity & authorization versioning
ALTER TABLE "users" 
  ADD COLUMN IF NOT EXISTS "first_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "last_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "country_code" VARCHAR(10) DEFAULT '+91',
  ADD COLUMN IF NOT EXISTS "authz_version" INTEGER DEFAULT 1;

-- Backfill first_name and last_name from name if currently empty
UPDATE "users"
SET 
  "first_name" = COALESCE("first_name", split_part("name", ' ', 1)),
  "last_name" = COALESCE("last_name", substring("name" from length(split_part("name", ' ', 1)) + 2))
WHERE "first_name" IS NULL AND "name" IS NOT NULL;

-- 2. TENANT MASTER (gym_master)
CREATE TABLE IF NOT EXISTS "gym_master" (
  "id" SERIAL PRIMARY KEY,
  "gym_code" VARCHAR(50) UNIQUE NOT NULL,
  "gym_name" VARCHAR(255) NOT NULL,
  "legal_name" VARCHAR(255),
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  "logo_url" TEXT,
  "owner_id" INTEGER REFERENCES "users"("id") ON DELETE RESTRICT,
  "subscription_plan_id" INTEGER,
  "status" VARCHAR(50) NOT NULL DEFAULT 'active', -- active, inactive, suspended
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backfill gym_master from client_master
INSERT INTO "gym_master" ("id", "gym_code", "gym_name", "email", "phone", "owner_id", "status", "created_at", "updated_at")
SELECT 
  c."id",
  'GYM_' || c."id",
  c."name",
  c."contactEmail",
  c."contactPhone",
  c."ownerId",
  COALESCE(c."status", 'active'),
  c."createdAt",
  c."updatedAt"
FROM "client_master" c
ON CONFLICT ("id") DO UPDATE 
SET 
  "gym_name" = EXCLUDED."gym_name",
  "email" = EXCLUDED."email",
  "phone" = EXCLUDED."phone",
  "owner_id" = EXCLUDED."owner_id",
  "status" = EXCLUDED."status";

-- If any gym has no client in client_master, create gym_master tenant for its owner
INSERT INTO "gym_master" ("gym_code", "gym_name", "email", "phone", "owner_id", "status", "created_at", "updated_at")
SELECT 
  'GYM_OWN_' || g."ownerId" || '_' || g."id",
  g."name",
  g."contactEmail",
  g."phone",
  g."ownerId",
  'active',
  NOW(),
  NOW()
FROM "gyms" g
WHERE g."clientId" IS NULL OR g."clientId" NOT IN (SELECT "id" FROM "gym_master")
ON CONFLICT ("gym_code") DO NOTHING;

-- Synchronize sequence
SELECT setval(pg_get_serial_sequence('gym_master', 'id'), COALESCE((SELECT MAX("id") FROM "gym_master"), 1));

-- 3. BRANCH ARCHITECTURE (gym_branch_master)
CREATE TABLE IF NOT EXISTS "gym_branch_master" (
  "id" SERIAL PRIMARY KEY,
  "gym_id" INTEGER NOT NULL REFERENCES "gym_master"("id") ON DELETE CASCADE,
  "branch_code" VARCHAR(50) NOT NULL,
  "branch_name" VARCHAR(255) NOT NULL,
  "address" TEXT NOT NULL,
  "city" VARCHAR(100),
  "pincode" VARCHAR(20),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "phone" VARCHAR(50),
  "contact_email" VARCHAR(255),
  "capacity" INTEGER DEFAULT 50,
  "open_time" VARCHAR(20) DEFAULT '06:00',
  "close_time" VARCHAR(20) DEFAULT '22:00',
  "status" VARCHAR(50) DEFAULT 'active', -- active, closed, maintenance
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "uq_branch_code_gym" UNIQUE ("gym_id", "branch_code")
);

-- Backfill gym_branch_master from gyms
INSERT INTO "gym_branch_master" (
  "id", "gym_id", "branch_code", "branch_name", "address", "pincode", 
  "latitude", "longitude", "phone", "contact_email", "capacity", 
  "open_time", "close_time", "status", "created_at", "updated_at"
)
SELECT 
  g."id",
  COALESCE(g."clientId", (SELECT "id" FROM "gym_master" WHERE "owner_id" = g."ownerId" LIMIT 1), 1),
  'BR_' || g."id",
  g."name",
  g."address",
  g."pincode",
  g."latitude",
  g."longitude",
  g."phone",
  g."contactEmail",
  g."capacity",
  g."openTime",
  g."closeTime",
  CASE WHEN g."status" = 'open' THEN 'active' ELSE 'closed' END,
  g."createdAt",
  g."updatedAt"
FROM "gyms" g
ON CONFLICT ("id") DO UPDATE
SET 
  "branch_name" = EXCLUDED."branch_name",
  "address" = EXCLUDED."address",
  "phone" = EXCLUDED."phone",
  "status" = EXCLUDED."status";

-- Synchronize sequence
SELECT setval(pg_get_serial_sequence('gym_branch_master', 'id'), COALESCE((SELECT MAX("id") FROM "gym_branch_master"), 1));

-- Ensure gyms table has clientId aligned with gym_master
UPDATE "gyms" g
SET "clientId" = b."gym_id"
FROM "gym_branch_master" b
WHERE g."id" = b."id" AND (g."clientId" IS NULL OR g."clientId" != b."gym_id");

-- 4. USER <-> GYM TENANT MEMBERSHIP (gym_user)
CREATE TABLE IF NOT EXISTS "gym_user" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "gym_id" INTEGER NOT NULL REFERENCES "gym_master"("id") ON DELETE CASCADE,
  "user_type" VARCHAR(50) NOT NULL DEFAULT 'MEMBER', -- OWNER, ADMIN, STAFF, MEMBER
  "status" VARCHAR(50) NOT NULL DEFAULT 'active',    -- active, inactive, suspended, pending
  "joined_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "uq_user_gym" UNIQUE ("user_id", "gym_id")
);

-- Backfill gym owners into gym_user
INSERT INTO "gym_user" ("user_id", "gym_id", "user_type", "status", "joined_at", "created_at", "updated_at")
SELECT 
  gm."owner_id",
  gm."id",
  'OWNER',
  'active',
  gm."created_at",
  gm."created_at",
  gm."updated_at"
FROM "gym_master" gm
WHERE gm."owner_id" IS NOT NULL
ON CONFLICT ("user_id", "gym_id") DO UPDATE
SET "user_type" = 'OWNER', "status" = 'active';

-- Backfill members from user_plans into gym_user
INSERT INTO "gym_user" ("user_id", "gym_id", "user_type", "status", "joined_at", "created_at", "updated_at")
SELECT DISTINCT
  up."userId",
  bm."gym_id",
  'MEMBER',
  'active',
  up."purchaseDate",
  NOW(),
  NOW()
FROM "user_plans" up
JOIN "gym_branch_master" bm ON bm."id" = up."gymId"
ON CONFLICT ("user_id", "gym_id") DO NOTHING;

-- 5. USER <-> BRANCH ACCESS (gym_branch_user)
CREATE TABLE IF NOT EXISTS "gym_branch_user" (
  "id" SERIAL PRIMARY KEY,
  "gym_id" INTEGER NOT NULL REFERENCES "gym_master"("id") ON DELETE CASCADE,
  "branch_id" INTEGER NOT NULL REFERENCES "gym_branch_master"("id") ON DELETE CASCADE,
  "gym_user_id" INTEGER NOT NULL REFERENCES "gym_user"("id") ON DELETE CASCADE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "uq_gym_user_branch" UNIQUE ("gym_user_id", "branch_id")
);

-- Automatically give gym owners access to all their branches
INSERT INTO "gym_branch_user" ("gym_id", "branch_id", "gym_user_id", "is_active", "created_at", "updated_at")
SELECT 
  gu."gym_id",
  bm."id",
  gu."id",
  true,
  NOW(),
  NOW()
FROM "gym_user" gu
JOIN "gym_branch_master" bm ON bm."gym_id" = gu."gym_id"
WHERE gu."user_type" = 'OWNER'
ON CONFLICT ("gym_user_id", "branch_id") DO NOTHING;

-- 6. DROP EMPTY PRELIMINARY TABLES IF THEY HAVE OLD DRAFT SCHEMAS
-- We safely drop only if count is 0
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_permission' AND table_schema = 'public') THEN
    IF (SELECT count(*) FROM "user_permission") = 0 THEN
      DROP TABLE "user_permission" CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'group_permission' AND table_schema = 'public') THEN
    IF (SELECT count(*) FROM "group_permission") = 0 THEN
      DROP TABLE "group_permission" CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'client_menu_permission' AND table_schema = 'public') THEN
    IF (SELECT count(*) FROM "client_menu_permission") = 0 THEN
      DROP TABLE "client_menu_permission" CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'client_menu_master' AND table_schema = 'public') THEN
    IF (SELECT count(*) FROM "client_menu_master") = 0 THEN
      DROP TABLE "client_menu_master" CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'permission_master' AND table_schema = 'public') THEN
    IF (SELECT count(*) FROM "permission_master") = 0 THEN
      DROP TABLE "permission_master" CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_group_master' AND table_schema = 'public') THEN
    IF (SELECT count(*) FROM "user_group_master") = 0 THEN
      DROP TABLE "user_group_master" CASCADE;
    END IF;
  END IF;
END $$;

-- 7. ROLE & GROUP MASTER (user_group_master)
CREATE TABLE IF NOT EXISTS "user_group_master" (
  "id" SERIAL PRIMARY KEY,
  "group_code" VARCHAR(100) UNIQUE NOT NULL,
  "group_name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "gym_id" INTEGER REFERENCES "gym_master"("id") ON DELETE CASCADE, -- NULL for system-wide groups
  "is_system" BOOLEAN DEFAULT true,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed standard system roles
INSERT INTO "user_group_master" ("group_code", "group_name", "description", "is_system", "is_active")
VALUES 
  ('SUPER_ADMIN', 'Platform Super Admin', 'Full access to entire SaaS platform across all tenants', true, true),
  ('GYM_OWNER', 'Gym Owner', 'Full ownership and administrative control over tenant gym and all branches', true, true),
  ('GYM_ADMIN', 'Gym Administrator', 'Tenant administrator with management access across assigned branches', true, true),
  ('BRANCH_MANAGER', 'Branch Manager', 'Manager in charge of day-to-day operations for specific branch', true, true),
  ('TRAINER', 'Gym Fitness Trainer', 'Trainer managing assigned members, workout regimens, and fitness logs', true, true),
  ('RECEPTIONIST', 'Receptionist / Front Desk', 'Front desk staff handling check-ins, memberships, and payments', true, true),
  ('ACCOUNTANT', 'Accountant / Financial Officer', 'Financial officer handling payments, invoicing, and settlements', true, true),
  ('NUTRITIONIST', 'Nutritionist', 'Diet and nutrition specialist managing member nutrition profiles', true, true),
  ('MEMBER', 'Gym Member', 'End-user client visiting gym, purchasing plans, and checking in', true, true)
ON CONFLICT ("group_code") DO UPDATE
SET "group_name" = EXCLUDED."group_name", "description" = EXCLUDED."description";

-- 8. USER ROLE ASSIGNMENT (gym_user_group)
CREATE TABLE IF NOT EXISTS "gym_user_group" (
  "id" SERIAL PRIMARY KEY,
  "gym_user_id" INTEGER NOT NULL REFERENCES "gym_user"("id") ON DELETE CASCADE,
  "group_id" INTEGER NOT NULL REFERENCES "user_group_master"("id") ON DELETE CASCADE,
  "branch_id" INTEGER REFERENCES "gym_branch_master"("id") ON DELETE CASCADE, -- NULL for tenant-wide role
  "is_primary" BOOLEAN DEFAULT true,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "uq_user_group_assignment" UNIQUE ("gym_user_id", "group_id", "branch_id")
);

-- Backfill GYM_OWNER role for all owner memberships
INSERT INTO "gym_user_group" ("gym_user_id", "group_id", "branch_id", "is_primary", "is_active", "created_at", "updated_at")
SELECT 
  gu."id",
  (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'GYM_OWNER'),
  NULL,
  true,
  true,
  NOW(),
  NOW()
FROM "gym_user" gu
WHERE gu."user_type" = 'OWNER'
ON CONFLICT ("gym_user_id", "group_id", "branch_id") DO NOTHING;

-- Backfill MEMBER role for all member memberships
INSERT INTO "gym_user_group" ("gym_user_id", "group_id", "branch_id", "is_primary", "is_active", "created_at", "updated_at")
SELECT 
  gu."id",
  (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'MEMBER'),
  NULL,
  true,
  true,
  NOW(),
  NOW()
FROM "gym_user" gu
WHERE gu."user_type" = 'MEMBER'
ON CONFLICT ("gym_user_id", "group_id", "branch_id") DO NOTHING;

-- 9. PERMISSION MASTER (user_permission_master)
CREATE TABLE IF NOT EXISTS "user_permission_master" (
  "id" SERIAL PRIMARY KEY,
  "permission_code" VARCHAR(100) UNIQUE NOT NULL,
  "permission_name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "module" VARCHAR(50) NOT NULL, -- MEMBERS, ATTENDANCE, PAYMENTS, WORKOUT, AI, SETTINGS, etc.
  "action" VARCHAR(50) NOT NULL, -- VIEW, CREATE, UPDATE, DELETE, EXPORT, USE
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed granular permissions
INSERT INTO "user_permission_master" ("permission_code", "permission_name", "description", "module", "action")
VALUES
  -- Members Module
  ('MEMBER_VIEW', 'View Members', 'View member profiles and lists', 'MEMBERS', 'VIEW'),
  ('MEMBER_CREATE', 'Create Member', 'Add new members or memberships', 'MEMBERS', 'CREATE'),
  ('MEMBER_UPDATE', 'Update Member', 'Edit member profile and plan assignments', 'MEMBERS', 'UPDATE'),
  ('MEMBER_DELETE', 'Delete Member', 'Deactivate or delete member accounts', 'MEMBERS', 'DELETE'),
  ('MEMBER_EXPORT', 'Export Members', 'Export member database to CSV/Excel', 'MEMBERS', 'EXPORT'),

  -- Attendance Module
  ('ATTENDANCE_VIEW', 'View Attendance', 'View live check-ins and attendance history', 'ATTENDANCE', 'VIEW'),
  ('ATTENDANCE_CREATE', 'Log Attendance', 'Perform QR or manual check-in/out', 'ATTENDANCE', 'CREATE'),
  ('ATTENDANCE_UPDATE', 'Modify Attendance', 'Adjust attendance and check-out logs', 'ATTENDANCE', 'UPDATE'),

  -- Payments & Plans Module
  ('PLAN_VIEW', 'View Plans', 'View gym membership plan offerings', 'PLANS', 'VIEW'),
  ('PLAN_CREATE', 'Create Plan', 'Create new membership tiers and pricing', 'PLANS', 'CREATE'),
  ('PLAN_UPDATE', 'Update Plan', 'Edit membership plan pricing and features', 'PLANS', 'UPDATE'),
  ('PLAN_DELETE', 'Delete Plan', 'Disable or archive membership plans', 'PLANS', 'DELETE'),

  -- Cash & Payments
  ('PAYMENT_VIEW', 'View Payments', 'View transaction history and billing records', 'PAYMENTS', 'VIEW'),
  ('PAYMENT_CREATE', 'Collect Payment', 'Process member payments and cash requests', 'PAYMENTS', 'CREATE'),
  ('PAYMENT_APPROVE', 'Approve Cash Payment', 'Approve or reject cash plan purchases', 'PAYMENTS', 'UPDATE'),
  ('PAYMENT_REFUND', 'Process Refund', 'Issue payment refunds to members', 'PAYMENTS', 'DELETE'),

  -- Trainers Module
  ('TRAINER_VIEW', 'View Trainers', 'View staff and trainer profiles', 'TRAINERS', 'VIEW'),
  ('TRAINER_CREATE', 'Create Trainer', 'Hire and assign trainers to branches', 'TRAINERS', 'CREATE'),
  ('TRAINER_UPDATE', 'Update Trainer', 'Edit trainer credentials and schedules', 'TRAINERS', 'UPDATE'),
  ('TRAINER_DELETE', 'Delete Trainer', 'Remove trainer access', 'TRAINERS', 'DELETE'),

  -- Workouts & Fitness
  ('WORKOUT_VIEW', 'View Workouts', 'View workout plans and exercise libraries', 'WORKOUT', 'VIEW'),
  ('WORKOUT_CREATE', 'Create Workout', 'Design customized workout regimens', 'WORKOUT', 'CREATE'),
  ('WORKOUT_UPDATE', 'Update Workout', 'Adjust member workout routines', 'WORKOUT', 'UPDATE'),

  -- Reports & Analytics
  ('REPORT_VIEW', 'View Reports', 'View revenue and member dashboard analytics', 'REPORTS', 'VIEW'),
  ('REPORT_EXPORT', 'Export Reports', 'Download financial and attendance summaries', 'REPORTS', 'EXPORT'),

  -- AI OS Features
  ('AI_COACH_VIEW', 'View AI Coach', 'Access AI coaching dashboard and insights', 'AI', 'VIEW'),
  ('AI_COACH_USE', 'Use AI Coach', 'Execute AI workout and nutrition generators', 'AI', 'USE'),
  ('AI_ANALYTICS_VIEW', 'View AI Predictions', 'View member churn and revenue predictions', 'AI', 'VIEW'),

  -- Gym & Branch Settings
  ('GYM_SETTINGS_VIEW', 'View Gym Settings', 'View gym profile, KYC, and branch configurations', 'SETTINGS', 'VIEW'),
  ('GYM_SETTINGS_UPDATE', 'Update Gym Settings', 'Modify branch details, operating hours, and media', 'SETTINGS', 'UPDATE'),
  ('BRANCH_MANAGE', 'Manage Branches', 'Add, configure, or close gym branches', 'SETTINGS', 'UPDATE')
ON CONFLICT ("permission_code") DO UPDATE
SET "permission_name" = EXCLUDED."permission_name", "description" = EXCLUDED."description";

-- 10. ROLE <-> PERMISSION MAPPING (user_group_permission)
CREATE TABLE IF NOT EXISTS "user_group_permission" (
  "id" SERIAL PRIMARY KEY,
  "group_id" INTEGER NOT NULL REFERENCES "user_group_master"("id") ON DELETE CASCADE,
  "permission_id" INTEGER NOT NULL REFERENCES "user_permission_master"("id") ON DELETE CASCADE,
  "can_view" BOOLEAN NOT NULL DEFAULT true,
  "can_create" BOOLEAN NOT NULL DEFAULT false,
  "can_update" BOOLEAN NOT NULL DEFAULT false,
  "can_delete" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "uq_group_permission" UNIQUE ("group_id", "permission_id")
);

-- Give GYM_OWNER all permissions
INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
SELECT 
  (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'GYM_OWNER'),
  p."id",
  true, true, true, true, true
FROM "user_permission_master" p
ON CONFLICT ("group_id", "permission_id") DO UPDATE
SET "can_view" = true, "can_create" = true, "can_update" = true, "can_delete" = true, "is_active" = true;

-- Give BRANCH_MANAGER operational permissions (no deletion of branches/gym)
INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
SELECT 
  (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'BRANCH_MANAGER'),
  p."id",
  true, true, true, false, true
FROM "user_permission_master" p
WHERE p."permission_code" NOT IN ('BRANCH_MANAGE', 'PLAN_DELETE')
ON CONFLICT ("group_id", "permission_id") DO NOTHING;

-- Give RECEPTIONIST member, attendance, payment permissions
INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
SELECT 
  (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'RECEPTIONIST'),
  p."id",
  true, 
  p."permission_code" IN ('MEMBER_CREATE', 'ATTENDANCE_CREATE', 'PAYMENT_CREATE', 'PAYMENT_APPROVE'),
  p."permission_code" IN ('MEMBER_UPDATE', 'ATTENDANCE_UPDATE'),
  false,
  true
FROM "user_permission_master" p
WHERE p."module" IN ('MEMBERS', 'ATTENDANCE', 'PAYMENTS', 'PLANS')
ON CONFLICT ("group_id", "permission_id") DO NOTHING;

-- Give TRAINER member view, attendance, and workout permissions
INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
SELECT 
  (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'TRAINER'),
  p."id",
  true,
  p."permission_code" IN ('WORKOUT_CREATE', 'ATTENDANCE_CREATE'),
  p."permission_code" IN ('WORKOUT_UPDATE'),
  false,
  true
FROM "user_permission_master" p
WHERE p."module" IN ('MEMBERS', 'ATTENDANCE', 'WORKOUT', 'AI')
ON CONFLICT ("group_id", "permission_id") DO NOTHING;

-- Give MEMBER view permissions
INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
SELECT 
  (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'MEMBER'),
  p."id",
  true,
  p."permission_code" IN ('ATTENDANCE_CREATE'),
  false,
  false,
  true
FROM "user_permission_master" p
WHERE p."permission_code" IN ('ATTENDANCE_VIEW', 'ATTENDANCE_CREATE', 'PLAN_VIEW', 'PAYMENT_VIEW', 'WORKOUT_VIEW')
ON CONFLICT ("group_id", "permission_id") DO NOTHING;

-- 11. SAAS SUBSCRIPTION TIERS (subscription_plan)
CREATE TABLE IF NOT EXISTS "subscription_plan" (
  "id" SERIAL PRIMARY KEY,
  "plan_code" VARCHAR(50) UNIQUE NOT NULL, -- FREE, BASIC, PRO, ENTERPRISE
  "plan_name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "price" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  "billing_cycle" VARCHAR(20) DEFAULT 'monthly', -- monthly, annual
  "max_branches" INTEGER DEFAULT 1,
  "max_members" INTEGER DEFAULT 100,
  "features" JSONB DEFAULT '{}',
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Subscription Plans
INSERT INTO "subscription_plan" ("plan_code", "plan_name", "description", "price", "max_branches", "max_members", "features", "is_active")
VALUES
  ('FREE', 'Free Starter', 'Free single-branch starter for boutique gyms', 0.00, 1, 50, '{"ai_coach": false, "multi_branch": false, "whatsapp": false, "advanced_analytics": false}', true),
  ('BASIC', 'Basic Growth', 'Single branch with automated billing and member management', 999.00, 1, 300, '{"ai_coach": false, "multi_branch": false, "whatsapp": true, "advanced_analytics": false}', true),
  ('PRO', 'Pro Multi-Branch', 'Multi-branch operations with AI Coach and analytics', 2499.00, 5, 2000, '{"ai_coach": true, "multi_branch": true, "whatsapp": true, "advanced_analytics": true}', true),
  ('ENTERPRISE', 'Enterprise Franchise', 'Unlimited branches, white-label, full AI OS suite, API access', 7999.00, 9999, 999999, '{"ai_coach": true, "multi_branch": true, "whatsapp": true, "advanced_analytics": true, "white_label": true, "api_access": true}', true)
ON CONFLICT ("plan_code") DO UPDATE
SET "plan_name" = EXCLUDED."plan_name", "features" = EXCLUDED."features", "max_branches" = EXCLUDED."max_branches";

-- 12. GYM-LEVEL FEATURE PERMISSIONS (gym_permission)
CREATE TABLE IF NOT EXISTS "gym_permission" (
  "id" SERIAL PRIMARY KEY,
  "gym_id" INTEGER NOT NULL REFERENCES "gym_master"("id") ON DELETE CASCADE,
  "permission_id" INTEGER NOT NULL REFERENCES "user_permission_master"("id") ON DELETE CASCADE,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "uq_gym_permission" UNIQUE ("gym_id", "permission_id")
);

-- Enable all standard permissions for existing gym tenants by default
INSERT INTO "gym_permission" ("gym_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT 
  gm."id",
  p."id",
  true,
  NOW(),
  NOW()
FROM "gym_master" gm
CROSS JOIN "user_permission_master" p
ON CONFLICT ("gym_id", "permission_id") DO NOTHING;

-- 13. DYNAMIC CLIENT MENU SYSTEM (client_menu_master & client_menu_permission)
CREATE TABLE IF NOT EXISTS "client_menu_master" (
  "id" SERIAL PRIMARY KEY,
  "parent_id" INTEGER REFERENCES "client_menu_master"("id") ON DELETE CASCADE,
  "menu_code" VARCHAR(100) UNIQUE NOT NULL,
  "menu_name" VARCHAR(100) NOT NULL,
  "route" VARCHAR(255) NOT NULL,
  "icon" VARCHAR(100),
  "menu_type" VARCHAR(50) DEFAULT 'sidebar', -- sidebar, header, quick_action
  "sort_order" INTEGER DEFAULT 0,
  "platform" VARCHAR(50) DEFAULT 'web',      -- web, mobile, both
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Dynamic Navigation Menu Master
INSERT INTO "client_menu_master" ("id", "parent_id", "menu_code", "menu_name", "route", "icon", "sort_order", "platform", "is_active")
VALUES
  (1, NULL, 'DASHBOARD', 'Overview', '/dashboard', 'fas fa-home', 10, 'web', true),
  (2, NULL, 'MEMBERS', 'Members', '/members', 'fas fa-users', 20, 'web', true),
  (3, NULL, 'ATTENDANCE', 'Attendance', '/attendance', 'fas fa-calendar-check', 30, 'web', true),
  (4, NULL, 'PLANS', 'Membership Plans', '/plans', 'fas fa-tags', 40, 'web', true),
  (5, NULL, 'PAYMENTS', 'Enrollment Requests', '/cash-payments', 'fas fa-money-bill-wave', 50, 'web', true),
  (6, NULL, 'REVENUE', 'Revenue Analytics', '/revenue', 'fas fa-chart-line', 60, 'web', true),
  (7, NULL, 'ANNOUNCEMENTS', 'Announcements', '/announcements', 'fas fa-bullhorn', 70, 'web', true),
  (8, NULL, 'TRANSACTIONS', 'Transaction History', '/payment-history', 'fas fa-history', 80, 'web', true),
  (9, NULL, 'AI_COACH', 'AI Gym Coach', '/ai-coach', 'fas fa-robot', 90, 'both', true),
  (10, NULL, 'SETTINGS', 'Gym Settings', '/profile', 'fas fa-building', 100, 'web', true),
  (11, NULL, 'BRANCHES', 'Branch Switcher', '/branches', 'fas fa-code-branch', 110, 'web', true)
ON CONFLICT ("id") DO UPDATE
SET "menu_name" = EXCLUDED."menu_name", "route" = EXCLUDED."route", "icon" = EXCLUDED."icon";

SELECT setval(pg_get_serial_sequence('client_menu_master', 'id'), COALESCE((SELECT MAX("id") FROM "client_menu_master"), 1));

-- Menu <-> Permission Mapping
CREATE TABLE IF NOT EXISTS "client_menu_permission" (
  "id" SERIAL PRIMARY KEY,
  "menu_id" INTEGER NOT NULL REFERENCES "client_menu_master"("id") ON DELETE CASCADE,
  "permission_id" INTEGER NOT NULL REFERENCES "user_permission_master"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "uq_menu_permission" UNIQUE ("menu_id", "permission_id")
);

-- Connect menus to required permissions
INSERT INTO "client_menu_permission" ("menu_id", "permission_id")
SELECT 
  m."id",
  p."id"
FROM "client_menu_master" m
JOIN "user_permission_master" p ON 
  (m."menu_code" = 'MEMBERS' AND p."permission_code" = 'MEMBER_VIEW') OR
  (m."menu_code" = 'ATTENDANCE' AND p."permission_code" = 'ATTENDANCE_VIEW') OR
  (m."menu_code" = 'PLANS' AND p."permission_code" = 'PLAN_VIEW') OR
  (m."menu_code" = 'PAYMENTS' AND p."permission_code" = 'PAYMENT_VIEW') OR
  (m."menu_code" = 'REVENUE' AND p."permission_code" = 'REPORT_VIEW') OR
  (m."menu_code" = 'AI_COACH' AND p."permission_code" = 'AI_COACH_VIEW') OR
  (m."menu_code" = 'SETTINGS' AND p."permission_code" = 'GYM_SETTINGS_VIEW')
ON CONFLICT ("menu_id", "permission_id") DO NOTHING;

-- 14. SESSION MANAGEMENT & REVOCATION (user_session)
CREATE TABLE IF NOT EXISTS "user_session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" VARCHAR(100) UNIQUE NOT NULL,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "gym_id" INTEGER REFERENCES "gym_master"("id") ON DELETE CASCADE,
  "branch_id" INTEGER REFERENCES "gym_branch_master"("id") ON DELETE CASCADE,
  "device_id" VARCHAR(255),
  "refresh_token_hash" VARCHAR(255),
  "ip_address" VARCHAR(50),
  "user_agent" TEXT,
  "authz_version" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "revoked_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. AUDIT LOGGING SYSTEM (audit_log)
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" BIGSERIAL PRIMARY KEY,
  "actor_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "gym_id" INTEGER REFERENCES "gym_master"("id") ON DELETE CASCADE,
  "branch_id" INTEGER REFERENCES "gym_branch_master"("id") ON DELETE SET NULL,
  "action" VARCHAR(100) NOT NULL,
  "resource_type" VARCHAR(100) NOT NULL,
  "resource_id" VARCHAR(100),
  "old_value" JSONB,
  "new_value" JSONB,
  "ip_address" VARCHAR(50),
  "user_agent" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. OPTIMIZED HIGH-PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS "idx_users_phone" ON "users"("phone");
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "idx_gym_master_owner" ON "gym_master"("owner_id");
CREATE INDEX IF NOT EXISTS "idx_gym_branch_master_gym" ON "gym_branch_master"("gym_id");
CREATE INDEX IF NOT EXISTS "idx_gym_user_user_status" ON "gym_user"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_gym_user_gym_status" ON "gym_user"("gym_id", "status");
CREATE INDEX IF NOT EXISTS "idx_gym_branch_user_active" ON "gym_branch_user"("gym_user_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_gym_branch_user_branch" ON "gym_branch_user"("branch_id", "gym_user_id");
CREATE INDEX IF NOT EXISTS "idx_gym_user_group_active" ON "gym_user_group"("gym_user_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_user_group_perm_group" ON "user_group_permission"("group_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_gym_perm_enabled" ON "gym_permission"("gym_id", "permission_id", "is_enabled");
CREATE INDEX IF NOT EXISTS "idx_client_menu_perm" ON "client_menu_permission"("permission_id", "menu_id");
CREATE INDEX IF NOT EXISTS "idx_user_session_lookup" ON "user_session"("session_id", "expires_at");
CREATE INDEX IF NOT EXISTS "idx_user_session_user" ON "user_session"("user_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "idx_audit_log_tenant" ON "audit_log"("gym_id", "created_at");

COMMIT;

