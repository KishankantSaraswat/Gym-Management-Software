import { sequelize } from '../database/db.js';
import {
  GymMaster,
  GymBranchMaster,
  GymUser,
  GymBranchUser,
  GymUserGroup,
  GymPermission,
  UserSession,
  AuditLog
} from '../models/multi_tenant_schema.js';
import { User, Gym, Plan, UserPlan } from '../models/schema.js';
import { Op } from 'sequelize';

export async function cleanupTestData() {
  console.log('================================================================');
  console.log('🧹 RUNNING SAFE TEST DATA CLEANUP (REMOVING ONLY TEST RECORDS)');
  console.log('================================================================');

  // 1. Identify test gyms
  const testGyms = await GymMaster.findAll({
    where: {
      gymCode: { [Op.like]: 'GYM-TEST-%' }
    }
  });

  const testGymIds = testGyms.map(g => g.id);
  console.log(`Found ${testGymIds.length} test gym(s) to clean:`, testGymIds);

  // 2. Identify test users
  const testUsers = await User.findAll({
    where: {
      [Op.or]: [
        { email: { [Op.like]: '%@gymhood-test.com' } },
        { phone: { [Op.like]: '+91987000%' } },
        { phone: { [Op.like]: '+91981110%' } }
      ]
    }
  });

  const testUserIds = testUsers.map(u => u.id);
  console.log(`Found ${testUserIds.length} test user(s) to clean.`);

  if (testGymIds.length === 0 && testUserIds.length === 0) {
    console.log('No test records found. Production data intact.');
    return;
  }

  // Transactional deletion of test records only
  const transaction = await sequelize.transaction();

  try {
    // Audit logs for test users or gyms
    await AuditLog.destroy({
      where: {
        [Op.or]: [
          { gymId: { [Op.in]: testGymIds } },
          { actorUserId: { [Op.in]: testUserIds } }
        ]
      },
      transaction
    });

    // User sessions
    await UserSession.destroy({
      where: {
        [Op.or]: [
          { gymId: { [Op.in]: testGymIds } },
          { userId: { [Op.in]: testUserIds } }
        ]
      },
      transaction
    });

    // Branch users
    await GymBranchUser.destroy({
      where: {
        gymId: { [Op.in]: testGymIds }
      },
      transaction
    });

    // Gym users
    const gymUsers = await GymUser.findAll({
      where: {
        [Op.or]: [
          { gymId: { [Op.in]: testGymIds } },
          { userId: { [Op.in]: testUserIds } }
        ]
      },
      transaction
    });
    const gymUserIds = gymUsers.map(gu => gu.id);

    if (gymUserIds.length > 0) {
      await GymUserGroup.destroy({
        where: { gymUserId: { [Op.in]: gymUserIds } },
        transaction
      });
      await GymUser.destroy({
        where: { id: { [Op.in]: gymUserIds } },
        transaction
      });
    }

    // Gym permissions
    await GymPermission.destroy({
      where: { gymId: { [Op.in]: testGymIds } },
      transaction
    });

    // Branches
    await GymBranchMaster.destroy({
      where: { gymId: { [Op.in]: testGymIds } },
      transaction
    });

    // Legacy gym records & plans
    const legacyTestGyms = await Gym.findAll({
      where: {
        name: {
          [Op.in]: [
            'FitZone Fitness',
            'IronCore Gym',
            'PowerHouse Fitness',
            'EliteFit Club'
          ]
        }
      },
      transaction
    });
    const legacyGymIds = legacyTestGyms.map(g => g.id);

    if (legacyGymIds.length > 0) {
      await Plan.destroy({
        where: { gymId: { [Op.in]: legacyGymIds } },
        transaction
      });
      await Gym.destroy({
        where: { id: { [Op.in]: legacyGymIds } },
        transaction
      });
    }

    // Gym master records
    await GymMaster.destroy({
      where: { id: { [Op.in]: testGymIds } },
      transaction
    });

    // Users
    await User.destroy({
      where: { id: { [Op.in]: testUserIds } },
      transaction
    });

    await transaction.commit();
    console.log('✅ Safely removed all test records without touching production data!');
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Cleanup failed, rolled back:', err);
    throw err;
  }
}

if (process.argv[1]?.endsWith('cleanup_test_data.js')) {
  cleanupTestData().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

