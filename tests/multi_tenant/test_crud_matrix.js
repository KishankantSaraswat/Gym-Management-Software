import { getTestEntities, assertTest } from './test_helper.js';
import authorizationService from '../../services/authorizationService.js';
import { Plan } from '../../models/schema.js';
import * as planService from '../../services/planService.js';

export async function runTestCrudMatrix() {
  console.log('  ▶ Running test_crud_matrix across business entities...');
  const { gymMap, branchMap, userMap } = await getTestEntities();

  const fitZone = gymMap['GYM-TEST-001'];
  const ironCore = gymMap['GYM-TEST-002'];

  const fitZoneOwner = userMap['fitzone_owner@gymhood-test.com'];
  const fitZoneAdmin = userMap['fitzone_admin@gymhood-test.com'];
  const fitZoneReception = userMap['fitzone_reception1@gymhood-test.com'];
  const fitZoneMember = userMap['fitzone_member1@gymhood-test.com'];
  const ironCoreOwner = userMap['ironcore_owner@gymhood-test.com'];

  // --- MODULE: MEMBERSHIP PLANS ---

  // 1. CREATE: Owner / Admin of same gym can CREATE plan
  const canOwnerCreatePlan = await authorizationService.can(fitZoneOwner, 'PLAN_CREATE', fitZone.id);
  assertTest(canOwnerCreatePlan, 'Owner must be authorized to CREATE plan in own gym');

  // Unauthorized role (Member) CANNOT CREATE plan
  const canMemberCreatePlan = await authorizationService.can(fitZoneMember, 'PLAN_CREATE', fitZone.id);
  assertTest(!canMemberCreatePlan, 'Member must NOT be authorized to CREATE plan');

  // 2. READ: Member of same gym can READ active plans
  const canMemberReadPlan = await authorizationService.can(fitZoneMember, 'PLAN_VIEW', fitZone.id);
  assertTest(canMemberReadPlan, 'Member must be authorized to READ plans');

  // 3. UPDATE: Receptionist CANNOT UPDATE plan
  const canRecepUpdatePlan = await authorizationService.can(fitZoneReception, 'PLAN_UPDATE', fitZone.id);
  assertTest(!canRecepUpdatePlan, 'Receptionist must NOT be authorized to UPDATE plans');

  // Admin of same gym CAN UPDATE plan
  const canAdminUpdatePlan = await authorizationService.can(fitZoneAdmin, 'PLAN_UPDATE', fitZone.id);
  assertTest(canAdminUpdatePlan, 'Admin must be authorized to UPDATE plans in own gym');

  // 4. DELETE: Admin of different gym CANNOT DELETE plan (Cross-tenant assertion)
  let crossDeleteBlocked = false;
  try {
    await authorizationService.assertTenantOwnership({ user: ironCoreOwner }, fitZone.id);
  } catch (err) {
    if (err.statusCode === 403) crossDeleteBlocked = true;
  }
  assertTest(crossDeleteBlocked, 'Cross-tenant user cannot DELETE foreign gym plan (403)');

  // --- MODULE: ATTENDANCE & CHECK-IN ---

  // Receptionist CAN CREATE attendance
  const canRecepCreateAttendance = await authorizationService.can(fitZoneReception, 'ATTENDANCE_CREATE', fitZone.id);
  assertTest(canRecepCreateAttendance, 'Receptionist can record attendance in own gym');

  // Member CANNOT CREATE attendance register
  const canMemberCreateAttendance = await authorizationService.can(fitZoneMember, 'ATTENDANCE_CREATE', fitZone.id);
  assertTest(!canMemberCreateAttendance, 'Member cannot create attendance register');

  // --- MODULE: PAYMENTS & REFUNDS ---

  // Receptionist CAN VIEW payments, but CANNOT REFUND
  const canRecepViewPay = await authorizationService.can(fitZoneReception, 'PAYMENT_VIEW', fitZone.id);
  const canRecepRefund = await authorizationService.can(fitZoneReception, 'PAYMENT_REFUND', fitZone.id);
  assertTest(canRecepViewPay, 'Receptionist can VIEW payments');
  assertTest(!canRecepRefund, 'Receptionist CANNOT REFUND payments');

  // Owner CAN REFUND
  const canOwnerRefund = await authorizationService.can(fitZoneOwner, 'PAYMENT_REFUND', fitZone.id);
  assertTest(canOwnerRefund, 'Owner CAN REFUND payments');

  console.log('    ✓ CRUD matrix (CREATE, READ, UPDATE, DELETE) passed across all tested modules and roles');
  return { name: 'test_crud_matrix', passed: true };
}

