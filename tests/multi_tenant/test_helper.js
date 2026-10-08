import { GymMaster, GymBranchMaster, GymUser, GymBranchUser, UserGroupMaster, GymUserGroup } from '../../models/multi_tenant_schema.js';
import { User, Gym, Plan } from '../../models/schema.js';
import sessionService from '../../services/sessionService.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import authorizationService from '../../services/authorizationService.js';

export async function getTestEntities() {
  const gyms = await GymMaster.findAll({
    where: { gymCode: ['GYM-TEST-001', 'GYM-TEST-002', 'GYM-TEST-003', 'GYM-TEST-004'] },
    order: [['gymCode', 'ASC']]
  });

  const branches = await GymBranchMaster.findAll({
    order: [['branchCode', 'ASC']]
  });

  const testUsers = await User.findAll({
    where: {
      email: [
        'fitzone_owner@gymhood-test.com',
        'fitzone_admin@gymhood-test.com',
        'fitzone_manager@gymhood-test.com',
        'fitzone_trainer1@gymhood-test.com',
        'fitzone_trainer2@gymhood-test.com',
        'fitzone_reception1@gymhood-test.com',
        'fitzone_accountant@gymhood-test.com',
        'fitzone_nutritionist@gymhood-test.com',
        'fitzone_member1@gymhood-test.com',
        'fitzone.multirole@gymhood-test.com',
        'ironcore_owner@gymhood-test.com',
        'ironcore_member1@gymhood-test.com',
        'powerhouse_owner@gymhood-test.com',
        'elitefit_owner@gymhood-test.com',
        'rahul.sharma@gymhood-test.com',
        'amit.verma@gymhood-test.com',
        'priya.singh@gymhood-test.com'
      ]
    }
  });

  const userMap = {};
  testUsers.forEach(u => { userMap[u.email] = u; });

  const gymMap = {};
  gyms.forEach(g => { gymMap[g.gymCode] = g; });

  const branchMap = {};
  branches.forEach(b => { branchMap[b.branchCode] = b; });

  return { gyms, gymMap, branches, branchMap, testUsers, userMap };
}

export async function createSessionForUser(user, gymId, branchId) {
  return await sessionService.createSession({
    user,
    gymId,
    branchId
  });
}

export function assertTest(condition, description) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${description}`);
  }
}

