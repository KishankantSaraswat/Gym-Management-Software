import { sequelize } from '../database/db.js';

export async function fixBasicGymPermissions() {
  await sequelize.query(`
    UPDATE gym_permission gp
    SET is_enabled = false
    FROM gym_master gm, user_permission_master upm
    WHERE gp.gym_id = gm.id 
      AND gp.permission_id = upm.id
      AND gm.gym_code IN ('GYM-TEST-002', 'GYM-TEST-004')
      AND upm.permission_code IN ('AI_COACH_USE', 'AI_ANALYTICS_VIEW');
  `);
  console.log('✅ Updated gym_permission: disabled AI features for BASIC gyms');
}

if (process.argv[1]?.endsWith('fix_basic_gym_permissions.js')) {
  fixBasicGymPermissions().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

