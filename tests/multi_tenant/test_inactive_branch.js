import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import { GymBranchMaster } from '../../models/multi_tenant_schema.js';

export async function runTestInactiveBranch() {
  console.log('  ▶ Running test_inactive_branch...');
  const { gymMap, branchMap, userMap } = await getTestEntities();
  const fitZone = gymMap['GYM-TEST-001'];
  const delBranch = branchMap['BR-FZ-DEL'];
  const trainer2 = userMap['fitzone_trainer2@gymhood-test.com'];

  let blocked = false;
  try {
    // Deactivate Delhi branch
    await GymBranchMaster.update({ status: 'inactive' }, { where: { id: delBranch.id } });
    await masterAuthzService.invalidateUserAuthz(trainer2.id, fitZone.id);

    const context = await masterAuthzService.resolveAuthContext(trainer2.id, fitZone.id, delBranch.id);
    if (!context || !context.branch || context.branch.id !== delBranch.id) {
      blocked = true;
    }
  } catch (err) {
    blocked = true;
  } finally {
    // Always restore branch status
    await GymBranchMaster.update({ status: 'active' }, { where: { id: delBranch.id } });
    await masterAuthzService.invalidateUserAuthz(trainer2.id, fitZone.id);
  }

  assertTest(blocked, 'Inactive branch must not be accessible to assigned users');
  console.log('    ✓ Deactivated branch isolated and access denied cleanly');
  return { name: 'test_inactive_branch', passed: true };
}

