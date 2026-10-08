import { getTestEntities, assertTest } from './test_helper.js';
import authorizationService from '../../services/authorizationService.js';
import masterAuthzService from '../../services/masterAuthzService.js';

export async function runTestBranchIsolation() {
  console.log('  ▶ Running test_branch_isolation...');
  const { gymMap, branchMap, userMap } = await getTestEntities();

  const fitZone = gymMap['GYM-TEST-001'];
  const ggnBranch = branchMap['BR-FZ-GGN'];
  const delBranch = branchMap['BR-FZ-DEL'];
  const noiBranch = branchMap['BR-FZ-NOI'];

  const manager = userMap['fitzone_manager@gymhood-test.com'];
  const trainer1 = userMap['fitzone_trainer1@gymhood-test.com'];
  const admin = userMap['fitzone_admin@gymhood-test.com'];

  // Test 1: Branch Manager has access to Gurgaon
  const mgrGgnContext = await masterAuthzService.resolveAuthContext(manager.id, fitZone.id, ggnBranch.id);
  assertTest(mgrGgnContext.branch && mgrGgnContext.branch.id === ggnBranch.id, 'Manager must access Gurgaon branch');

  // Test 2: Branch Manager is denied access to Delhi
  let blockedDelhi = false;
  try {
    await authorizationService.assertBranchAccess({ user: manager }, fitZone.id, delBranch.id);
  } catch (err) {
    if (err.statusCode === 403) blockedDelhi = true;
  }
  assertTest(blockedDelhi, 'Manager must be denied access to Delhi branch (403)');

  // Test 3: Branch Manager is denied access to Noida
  let blockedNoida = false;
  try {
    await authorizationService.assertBranchAccess({ user: manager }, fitZone.id, noiBranch.id);
  } catch (err) {
    if (err.statusCode === 403) blockedNoida = true;
  }
  assertTest(blockedNoida, 'Manager must be denied access to Noida branch (403)');

  // Test 4: Trainer 1 has access to Gurgaon and Delhi, but denied on Noida
  const t1Ggn = await masterAuthzService.resolveAuthContext(trainer1.id, fitZone.id, ggnBranch.id);
  assertTest(t1Ggn.branch.id === ggnBranch.id, 'Trainer 1 has Gurgaon access');

  const t1Del = await masterAuthzService.resolveAuthContext(trainer1.id, fitZone.id, delBranch.id);
  assertTest(t1Del.branch.id === delBranch.id, 'Trainer 1 has Delhi access');

  let t1NoidaBlocked = false;
  try {
    await authorizationService.assertBranchAccess({ user: trainer1 }, fitZone.id, noiBranch.id);
  } catch (err) {
    if (err.statusCode === 403) t1NoidaBlocked = true;
  }
  assertTest(t1NoidaBlocked, 'Trainer 1 must be blocked from Noida branch (403)');

  // Test 5: Admin has access to all 3 branches
  const adminGgn = await masterAuthzService.resolveAuthContext(admin.id, fitZone.id, ggnBranch.id);
  assertTest(adminGgn.branch.id === ggnBranch.id, 'Admin has Gurgaon access');

  const adminDel = await masterAuthzService.resolveAuthContext(admin.id, fitZone.id, delBranch.id);
  assertTest(adminDel.branch.id === delBranch.id, 'Admin has Delhi access');

  const adminNoi = await masterAuthzService.resolveAuthContext(admin.id, fitZone.id, noiBranch.id);
  assertTest(adminNoi.branch.id === noiBranch.id, 'Admin has Noida access');

  console.log('    ✓ Branch-level authorization & isolation verified for single, multi, and all-branch users');
  return { name: 'test_branch_isolation', passed: true };
}

