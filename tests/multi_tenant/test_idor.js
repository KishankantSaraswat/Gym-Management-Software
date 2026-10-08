import { getTestEntities, assertTest } from './test_helper.js';
import authorizationService from '../../services/authorizationService.js';
import { Plan } from '../../models/schema.js';

export async function runTestIdor() {
  console.log('  ▶ Running test_idor...');
  const { gymMap, userMap } = await getTestEntities();

  const fitZone = gymMap['GYM-TEST-001'];
  const ironCore = gymMap['GYM-TEST-002'];
  const fitZoneOwner = userMap['fitzone_owner@gymhood-test.com'];

  // Test 1: FitZone Owner attempting to access IronCore's plan
  const ironCorePlan = await Plan.findOne({ where: { name: { [Plan.sequelize.Sequelize.Op.like]: 'IronCore%' } } });
  
  if (ironCorePlan) {
    let planBlocked = false;
    try {
      // Direct tenant assertion on the plan's gymId
      await authorizationService.assertTenantOwnership({ user: fitZoneOwner }, ironCorePlan.gymId);
    } catch (err) {
      if (err.statusCode === 403) planBlocked = true;
    }
    assertTest(planBlocked, 'FitZone user must be prevented from accessing IronCore Plan via IDOR (403)');
  }

  // Test 2: FitZone Owner attempting to access IronCore register
  let registerBlocked = false;
  try {
    await authorizationService.assertTenantOwnership({ user: fitZoneOwner }, ironCore.id);
  } catch (err) {
    if (err.statusCode === 403) registerBlocked = true;
  }
  assertTest(registerBlocked, 'FitZone user must be prevented from reading IronCore attendance register (403)');

  // Test 3: FitZone Owner attempting to access PowerHouse
  const powerHouse = gymMap['GYM-TEST-003'];
  let phBlocked = false;
  try {
    await authorizationService.assertTenantOwnership({ user: fitZoneOwner }, powerHouse.id);
  } catch (err) {
    if (err.statusCode === 403) phBlocked = true;
  }
  assertTest(phBlocked, 'FitZone user must be prevented from accessing PowerHouse dashboard (403)');

  console.log('    ✓ IDOR vulnerabilities prevented across plans, registers, and analytics');
  return { name: 'test_idor', passed: true };
}

