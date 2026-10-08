import { getTestEntities, assertTest } from './test_helper.js';
import authorizationService from '../../services/authorizationService.js';

export async function runTestPermissionEscalation() {
  console.log('  ▶ Running test_permission_escalation...');
  const { gymMap, userMap } = await getTestEntities();
  const fitZone = gymMap['GYM-TEST-001'];

  const receptionist = userMap['fitzone_reception1@gymhood-test.com'];
  const trainer = userMap['fitzone_trainer1@gymhood-test.com'];
  const member = userMap['fitzone_member1@gymhood-test.com'];

  // 1. Receptionist Privilege Escalation Attempts
  const recepCanDeleteMember = await authorizationService.can(receptionist, 'MEMBER_DELETE', fitZone.id);
  assertTest(!recepCanDeleteMember, 'Receptionist must not escalate to MEMBER_DELETE');

  const recepCanRefund = await authorizationService.can(receptionist, 'PAYMENT_REFUND', fitZone.id);
  assertTest(!recepCanRefund, 'Receptionist must not escalate to PAYMENT_REFUND');

  const recepCanUpdateSettings = await authorizationService.can(receptionist, 'GYM_SETTINGS_UPDATE', fitZone.id);
  assertTest(!recepCanUpdateSettings, 'Receptionist must not escalate to GYM_SETTINGS_UPDATE');

  // 2. Trainer Privilege Escalation Attempts
  const trainerCanApprovePayment = await authorizationService.can(trainer, 'PAYMENT_APPROVE', fitZone.id);
  assertTest(!trainerCanApprovePayment, 'Trainer must not escalate to PAYMENT_APPROVE');

  const trainerCanUpdateSettings = await authorizationService.can(trainer, 'GYM_SETTINGS_UPDATE', fitZone.id);
  assertTest(!trainerCanUpdateSettings, 'Trainer must not escalate to GYM_SETTINGS_UPDATE');

  // 3. Member Privilege Escalation Attempts
  const memberCanCreatePlan = await authorizationService.can(member, 'PLAN_CREATE', fitZone.id);
  assertTest(!memberCanCreatePlan, 'Member must not escalate to PLAN_CREATE');

  const memberCanApprovePayment = await authorizationService.can(member, 'PAYMENT_APPROVE', fitZone.id);
  assertTest(!memberCanApprovePayment, 'Member must not escalate to PAYMENT_APPROVE');

  console.log('    ✓ All privilege escalation attack attempts strictly denied (403)');
  return { name: 'test_permission_escalation', passed: true };
}

