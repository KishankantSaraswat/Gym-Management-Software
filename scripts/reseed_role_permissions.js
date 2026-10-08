import { sequelize } from '../database/db.js';

export async function reseedRolePermissions() {
  console.log('🔄 Re-seeding role permissions for RECEPTIONIST, TRAINER, ACCOUNTANT, MEMBER, BRANCH_MANAGER...');

  await sequelize.query(`
    DELETE FROM "user_group_permission" 
    WHERE "group_id" IN (
      SELECT "id" FROM "user_group_master" 
      WHERE "group_code" IN ('RECEPTIONIST', 'TRAINER', 'ACCOUNTANT', 'MEMBER', 'NUTRITIONIST', 'BRANCH_MANAGER')
    );
  `);

  // 0. GYM_ADMIN
  await sequelize.query(`
    INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
    SELECT (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'GYM_ADMIN'), "id", true, true, true, true, true
    FROM "user_permission_master"
    ON CONFLICT ("group_id", "permission_id") DO UPDATE
    SET "can_view" = true, "can_create" = true, "can_update" = true, "can_delete" = true, "is_active" = true;
  `);

  // 1. RECEPTIONIST
  await sequelize.query(`
    INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
    SELECT (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'RECEPTIONIST'), "id", true, true, false, false, true
    FROM "user_permission_master"
    WHERE "permission_code" IN ('MEMBER_VIEW', 'MEMBER_CREATE', 'ATTENDANCE_VIEW', 'ATTENDANCE_CREATE', 'PAYMENT_VIEW', 'PAYMENT_CREATE');
  `);

  // 2. TRAINER
  await sequelize.query(`
    INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
    SELECT (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'TRAINER'), "id", true, true, true, false, true
    FROM "user_permission_master"
    WHERE "permission_code" IN ('MEMBER_VIEW', 'ATTENDANCE_VIEW', 'ATTENDANCE_CREATE', 'WORKOUT_VIEW', 'WORKOUT_CREATE', 'WORKOUT_UPDATE');
  `);

  // 3. ACCOUNTANT
  await sequelize.query(`
    INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
    SELECT (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'ACCOUNTANT'), "id", true, true, true, false, true
    FROM "user_permission_master"
    WHERE "permission_code" IN ('PAYMENT_VIEW', 'PAYMENT_CREATE', 'PAYMENT_UPDATE', 'PAYMENT_APPROVE', 'REPORT_VIEW', 'REPORT_EXPORT');
  `);

  // 4. MEMBER
  await sequelize.query(`
    INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
    SELECT (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'MEMBER'), "id", true, false, false, false, true
    FROM "user_permission_master"
    WHERE "permission_code" IN ('MEMBER_VIEW', 'PLAN_VIEW', 'ATTENDANCE_VIEW', 'WORKOUT_VIEW');
  `);

  // 5. BRANCH_MANAGER
  await sequelize.query(`
    INSERT INTO "user_group_permission" ("group_id", "permission_id", "can_view", "can_create", "can_update", "can_delete", "is_active")
    SELECT (SELECT "id" FROM "user_group_master" WHERE "group_code" = 'BRANCH_MANAGER'), "id", true, true, true, false, true
    FROM "user_permission_master"
    WHERE "permission_code" IN (
      'MEMBER_VIEW', 'MEMBER_CREATE', 'MEMBER_UPDATE',
      'ATTENDANCE_VIEW', 'ATTENDANCE_CREATE', 'ATTENDANCE_UPDATE',
      'PLAN_VIEW', 'PLAN_CREATE', 'PLAN_UPDATE',
      'TRAINER_VIEW', 'WORKOUT_VIEW', 'REPORT_VIEW', 'BRANCH_MANAGE'
    );
  `);

  console.log('✅ Role permissions re-seeded accurately according to Master RBAC Matrix!');
}

if (process.argv[1]?.endsWith('reseed_role_permissions.js')) {
  reseedRolePermissions().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
