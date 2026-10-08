import { getTestEntities, assertTest } from './test_helper.js';
import authorizationService from '../../services/authorizationService.js';

export async function runTestGymIsolation() {
  console.log('  ▶ Running test_gym_isolation...');
  const { gymMap, userMap } = await getTestEntities();

  const fitZone = gymMap['GYM-TEST-001'];
  const ironCore = gymMap['GYM-TEST-002'];
  const powerHouse = gymMap['GYM-TEST-003'];
  const eliteFit = gymMap['GYM-TEST-004'];

  const fitZoneUser = userMap['fitzone_member1@gymhood-test.com'];
  const ironCoreUser = userMap['ironcore_member1@gymhood-test.com'];
  const powerHouseOwner = userMap['powerhouse_owner@gymhood-test.com'];
  const eliteFitOwner = userMap['elitefit_owner@gymhood-test.com'];

  // Test 1: FitZone user attempting to access IronCore
  let blocked = false;
  try {
    await authorizationService.assertTenantOwnership({ user: fitZoneUser }, ironCore.id);
  } catch (err) {
    if (err.statusCode === 403) blocked = true;
  }
  assertTest(blocked, 'FitZone user must be blocked from accessing IronCore (403)');

  // Test 2: FitZone user attempting to access PowerHouse
  blocked = false;
  try {
    await authorizationService.assertTenantOwnership({ user: fitZoneUser }, powerHouse.id);
  } catch (err) {
    if (err.statusCode === 403) blocked = true;
  }
  assertTest(blocked, 'FitZone user must be blocked from accessing PowerHouse (403)');

  // Test 3: IronCore user attempting to access FitZone
  blocked = false;
  try {
    await authorizationService.assertTenantOwnership({ user: ironCoreUser }, fitZone.id);
  } catch (err) {
    if (err.statusCode === 403) blocked = true;
  }
  assertTest(blocked, 'IronCore user must be blocked from accessing FitZone (403)');

  // Test 4: PowerHouse owner attempting to access EliteFit
  blocked = false;
  try {
    await authorizationService.assertTenantOwnership({ user: powerHouseOwner }, eliteFit.id);
  } catch (err) {
    if (err.statusCode === 403) blocked = true;
  }
  assertTest(blocked, 'PowerHouse owner must be blocked from accessing EliteFit (403)');

  // Test 5: EliteFit owner attempting to access PowerHouse
  blocked = false;
  try {
    await authorizationService.assertTenantOwnership({ user: eliteFitOwner }, powerHouse.id);
  } catch (err) {
    if (err.statusCode === 403) blocked = true;
  }
  assertTest(blocked, 'EliteFit owner must be blocked from accessing PowerHouse (403)');

  console.log('    ✓ Cross-gym isolation verified in all directions (403 Forbidden enforced)');
  return { name: 'test_gym_isolation', passed: true };
}

