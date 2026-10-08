import { sequelize } from '../../database/db.js';
import { assertTest } from './test_helper.js';

export async function runTestDatabaseIntegrity() {
  console.log('  ▶ Running test_database_integrity...');

  // 1. Check for Orphan gym_user records
  const [orphanGymUsers] = await sequelize.query(`
    SELECT gu.id FROM gym_user gu
    LEFT JOIN users u ON gu.user_id = u.id
    LEFT JOIN gym_master gm ON gu.gym_id = gm.id
    WHERE u.id IS NULL OR gm.id IS NULL
  `);
  assertTest(orphanGymUsers.length === 0, `No orphan gym_user records allowed. Found: ${orphanGymUsers.length}`);

  // 2. Check for Orphan gym_branch_user records
  const [orphanBranchUsers] = await sequelize.query(`
    SELECT gbu.id FROM gym_branch_user gbu
    LEFT JOIN gym_master gm ON gbu.gym_id = gm.id
    LEFT JOIN gym_branch_master gbm ON gbu.branch_id = gbm.id
    LEFT JOIN gym_user gu ON gbu.gym_user_id = gu.id
    WHERE gm.id IS NULL OR gbm.id IS NULL OR gu.id IS NULL
  `);
  assertTest(orphanBranchUsers.length === 0, `No orphan gym_branch_user records allowed. Found: ${orphanBranchUsers.length}`);

  // 3. Check for Orphan gym_user_group records
  const [orphanUserGroups] = await sequelize.query(`
    SELECT gug.id FROM gym_user_group gug
    LEFT JOIN gym_user gu ON gug.gym_user_id = gu.id
    LEFT JOIN user_group_master ugm ON gug.group_id = ugm.id
    WHERE gu.id IS NULL OR ugm.id IS NULL
  `);
  assertTest(orphanUserGroups.length === 0, `No orphan gym_user_group records allowed. Found: ${orphanUserGroups.length}`);

  // 4. Check for Orphan gym_permission records
  const [orphanGymPerms] = await sequelize.query(`
    SELECT gp.id FROM gym_permission gp
    LEFT JOIN gym_master gm ON gp.gym_id = gm.id
    LEFT JOIN user_permission_master upm ON gp.permission_id = upm.id
    WHERE gm.id IS NULL OR upm.id IS NULL
  `);
  assertTest(orphanGymPerms.length === 0, `No orphan gym_permission records allowed. Found: ${orphanGymPerms.length}`);

  // 5. Unique constraint check on gym_user (user_id, gym_id)
  const [dupGymUsers] = await sequelize.query(`
    SELECT user_id, gym_id, count(*) FROM gym_user
    GROUP BY user_id, gym_id HAVING count(*) > 1
  `);
  assertTest(dupGymUsers.length === 0, `No duplicate (user_id, gym_id) allowed. Found: ${dupGymUsers.length}`);

  // 6. Unique constraint check on gym_branch_user (gym_id, branch_id, gym_user_id)
  const [dupBranchUsers] = await sequelize.query(`
    SELECT gym_id, branch_id, gym_user_id, count(*) FROM gym_branch_user
    GROUP BY gym_id, branch_id, gym_user_id HAVING count(*) > 1
  `);
  assertTest(dupBranchUsers.length === 0, `No duplicate (gym_id, branch_id, gym_user_id) allowed. Found: ${dupBranchUsers.length}`);

  console.log('    ✓ Zero orphan records, zero duplicate mappings, all foreign keys verified');
  return { name: 'test_database_integrity', passed: true };
}

