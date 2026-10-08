import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import { GymUser } from '../../models/multi_tenant_schema.js';

export async function runTestUserGymMembership() {
  console.log('  ▶ Running test_user_gym_membership...');
  const { gymMap, userMap } = await getTestEntities();

  const fitZone = gymMap['GYM-TEST-001'];
  const fitZoneOwner = userMap['fitzone_owner@gymhood-test.com'];

  assertTest(fitZoneOwner, 'FitZone owner user must exist in DB');
  assertTest(fitZone, 'FitZone gym must exist in DB');

  // Verify GymUser membership in DB
  const membership = await GymUser.findOne({
    where: { userId: fitZoneOwner.id, gymId: fitZone.id }
  });
  assertTest(membership, 'User must have a gym_user membership record');
  assertTest(membership.status === 'active', 'Membership status must be active');

  // Verify context resolves correctly for the member
  const authContext = await masterAuthzService.resolveAuthContext(fitZoneOwner.id, fitZone.id);
  assertTest(authContext, 'Auth context must resolve for valid gym member');
  assertTest(authContext.gym.id === fitZone.id, 'Resolved gym must match FitZone ID');
  assertTest(authContext.gym.name === 'FitZone Fitness', 'Resolved gym name must match');

  console.log('    ✓ Membership resolution verified for single-gym user');
  return { name: 'test_user_gym_membership', passed: true };
}

