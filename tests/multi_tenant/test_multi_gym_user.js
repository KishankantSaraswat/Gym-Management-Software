import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import { GymUser } from '../../models/multi_tenant_schema.js';
import { User } from '../../models/schema.js';

export async function runTestMultiGymUser() {
  console.log('  ▶ Running test_multi_gym_user...');
  const { gymMap, userMap } = await getTestEntities();

  const fitZone = gymMap['GYM-TEST-001'];
  const ironCore = gymMap['GYM-TEST-002'];
  const powerHouse = gymMap['GYM-TEST-003'];
  const eliteFit = gymMap['GYM-TEST-004'];

  const rahul = userMap['rahul.sharma@gymhood-test.com'];
  const amit = userMap['amit.verma@gymhood-test.com'];
  const priya = userMap['priya.singh@gymhood-test.com'];

  assertTest(rahul, 'Rahul Sharma must exist');
  assertTest(amit, 'Amit Verma must exist');
  assertTest(priya, 'Priya Singh must exist');

  // Verify only 1 global User record exists per multi-gym person
  const rahulUserCount = await User.count({ where: { email: 'rahul.sharma@gymhood-test.com' } });
  assertTest(rahulUserCount === 1, 'Rahul Sharma must have exactly ONE user record in users table');

  // Verify Rahul has multiple gym_user memberships
  const rahulMemberships = await GymUser.findAll({ where: { userId: rahul.id } });
  assertTest(rahulMemberships.length >= 2, 'Rahul must have at least 2 gym_user memberships');
  const rahulGymIds = rahulMemberships.map(m => m.gymId);
  assertTest(rahulGymIds.includes(fitZone.id), 'Rahul must have membership in FitZone');
  assertTest(rahulGymIds.includes(ironCore.id), 'Rahul must have membership in IronCore');

  // Test switching context: Resolve FitZone
  const fitZoneContext = await masterAuthzService.resolveAuthContext(rahul.id, fitZone.id);
  assertTest(fitZoneContext.gym.id === fitZone.id, 'Rahul context must resolve to FitZone when gymId=FitZone');
  assertTest(fitZoneContext.gym.name === 'FitZone Fitness', 'FitZone context name matches');

  // Test switching context: Resolve IronCore
  const ironCoreContext = await masterAuthzService.resolveAuthContext(rahul.id, ironCore.id);
  assertTest(ironCoreContext.gym.id === ironCore.id, 'Rahul context must resolve to IronCore when gymId=IronCore');
  assertTest(ironCoreContext.gym.name === 'IronCore Gym', 'IronCore context name matches');

  // Test Amit Verma across PowerHouse & EliteFit
  const amitMemberships = await GymUser.findAll({ where: { userId: amit.id } });
  assertTest(amitMemberships.length >= 2, 'Amit must belong to multiple gyms');
  const amitGymIds = amitMemberships.map(m => m.gymId);
  assertTest(amitGymIds.includes(powerHouse.id), 'Amit belongs to PowerHouse');
  assertTest(amitGymIds.includes(eliteFit.id), 'Amit belongs to EliteFit');

  // Test Priya Singh (Trainer in FitZone and PowerHouse)
  const priyaFitZoneContext = await masterAuthzService.resolveAuthContext(priya.id, fitZone.id);
  assertTest(priyaFitZoneContext.role === 'TRAINER', 'Priya must have role TRAINER in FitZone');

  const priyaPowerHouseContext = await masterAuthzService.resolveAuthContext(priya.id, powerHouse.id);
  assertTest(priyaPowerHouseContext.role === 'TRAINER', 'Priya must have role TRAINER in PowerHouse');

  console.log('    ✓ Multi-gym memberships & context switching verified for 3 users');
  return { name: 'test_multi_gym_user', passed: true };
}

