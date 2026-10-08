import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import { GymUser } from '../../models/multi_tenant_schema.js';

export async function runTestInactiveUser() {
  console.log('  ▶ Running test_inactive_user...');
  const { gymMap, userMap } = await getTestEntities();
  const fitZone = gymMap['GYM-TEST-001'];
  const member = userMap['fitzone_member1@gymhood-test.com'];

  let blocked = false;
  try {
    // Deactivate user in gym_user
    await GymUser.update({ status: 'suspended' }, { where: { userId: member.id, gymId: fitZone.id } });
    await masterAuthzService.invalidateUserAuthz(member.id, fitZone.id);

    const context = await masterAuthzService.resolveAuthContext(member.id, fitZone.id);
    if (!context || !context.gym) blocked = true;
  } catch (err) {
    blocked = true;
  } finally {
    // Always restore user status
    await GymUser.update({ status: 'active' }, { where: { userId: member.id, gymId: fitZone.id } });
    await masterAuthzService.invalidateUserAuthz(member.id, fitZone.id);
  }

  assertTest(blocked, 'Suspended gym user must be denied authorization context');
  console.log('    ✓ Suspended user denied authorization context successfully');
  return { name: 'test_inactive_user', passed: true };
}

