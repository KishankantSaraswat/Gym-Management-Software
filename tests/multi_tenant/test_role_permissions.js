import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import authorizationService from '../../services/authorizationService.js';

export async function runTestRolePermissions() {
  console.log('  ▶ Running test_role_permissions...');
  const { gymMap, userMap } = await getTestEntities();
  const fitZone = gymMap['GYM-TEST-001'];

  // Test Receptionist
  const receptionist = userMap['fitzone_reception1@gymhood-test.com'];
  const recepContext = await masterAuthzService.resolveAuthContext(receptionist.id, fitZone.id);
  assertTest(recepContext.role === 'RECEPTIONIST', 'Role must be RECEPTIONIST');
  assertTest(recepContext.permissions.includes('MEMBER_VIEW'), 'Receptionist must have MEMBER_VIEW');
  assertTest(recepContext.permissions.includes('MEMBER_CREATE'), 'Receptionist must have MEMBER_CREATE');
  assertTest(recepContext.permissions.includes('ATTENDANCE_VIEW'), 'Receptionist must have ATTENDANCE_VIEW');
  assertTest(!recepContext.permissions.includes('MEMBER_DELETE'), 'Receptionist must NOT have MEMBER_DELETE');
  assertTest(!recepContext.permissions.includes('PAYMENT_REFUND'), 'Receptionist must NOT have PAYMENT_REFUND');
  assertTest(!recepContext.permissions.includes('GYM_SETTINGS_UPDATE'), 'Receptionist must NOT have GYM_SETTINGS_UPDATE');

  // Test Accountant
  const accountant = userMap['fitzone_accountant@gymhood-test.com'];
  const accContext = await masterAuthzService.resolveAuthContext(accountant.id, fitZone.id);
  assertTest(accContext.role === 'ACCOUNTANT', 'Role must be ACCOUNTANT');
  assertTest(accContext.permissions.includes('PAYMENT_VIEW'), 'Accountant must have PAYMENT_VIEW');
  assertTest(accContext.permissions.includes('REPORT_VIEW'), 'Accountant must have REPORT_VIEW');
  assertTest(!accContext.permissions.includes('WORKOUT_CREATE'), 'Accountant must NOT have WORKOUT_CREATE');
  assertTest(!accContext.permissions.includes('GYM_SETTINGS_UPDATE'), 'Accountant must NOT have GYM_SETTINGS_UPDATE');

  // Test Member
  const member = userMap['fitzone_member1@gymhood-test.com'];
  const memContext = await masterAuthzService.resolveAuthContext(member.id, fitZone.id);
  assertTest(memContext.role === 'MEMBER', 'Role must be MEMBER');
  assertTest(memContext.permissions.includes('MEMBER_VIEW'), 'Member must have MEMBER_VIEW');
  assertTest(!memContext.permissions.includes('PAYMENT_APPROVE'), 'Member must NOT have PAYMENT_APPROVE');
  assertTest(!memContext.permissions.includes('MEMBER_CREATE'), 'Member must NOT have MEMBER_CREATE');
  assertTest(!memContext.permissions.includes('MEMBER_DELETE'), 'Member must NOT have MEMBER_DELETE');

  // Test Multi-Role User (Specialist with TRAINER + BRANCH_MANAGER)
  const multiRoleUser = userMap['fitzone.multirole@gymhood-test.com'];
  const mrContext = await masterAuthzService.resolveAuthContext(multiRoleUser.id, fitZone.id);
  assertTest(mrContext.permissions.includes('WORKOUT_CREATE'), 'Multi-role user must have WORKOUT_CREATE from Trainer');
  assertTest(mrContext.permissions.includes('BRANCH_MANAGE'), 'Multi-role user must have BRANCH_MANAGE from Branch Manager');

  console.log('    ✓ RBAC permissions matrix and multi-role union verified');
  return { name: 'test_role_permissions', passed: true };
}

