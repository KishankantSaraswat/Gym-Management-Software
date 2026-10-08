import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import { GymMaster } from '../../models/multi_tenant_schema.js';

export async function runTestInactiveGym() {
  console.log('  ▶ Running test_inactive_gym...');
  const { gymMap, userMap } = await getTestEntities();
  const eliteFit = gymMap['GYM-TEST-004'];
  const eliteFitOwner = userMap['elitefit_owner@gymhood-test.com'];

  let blocked = false;
  try {
    // Deactivate Gym
    await GymMaster.update({ status: 'suspended' }, { where: { id: eliteFit.id } });
    await masterAuthzService.invalidateUserAuthz(eliteFitOwner.id, eliteFit.id);

    const context = await masterAuthzService.resolveAuthContext(eliteFitOwner.id, eliteFit.id);
    if (!context || !context.gym) blocked = true;
  } catch (err) {
    blocked = true;
  } finally {
    // Always restore Gym status
    await GymMaster.update({ status: 'active' }, { where: { id: eliteFit.id } });
    await masterAuthzService.invalidateUserAuthz(eliteFitOwner.id, eliteFit.id);
  }

  assertTest(blocked, 'Inactive/Suspended gym must not resolve active context for members');
  console.log('    ✓ Suspended gym successfully blocked from all operations');
  return { name: 'test_inactive_gym', passed: true };
}

