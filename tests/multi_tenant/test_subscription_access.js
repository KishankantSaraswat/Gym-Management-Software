import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import authorizationService from '../../services/authorizationService.js';
import { GymPermission, UserPermissionMaster } from '../../models/multi_tenant_schema.js';

export async function runTestSubscriptionAccess() {
  console.log('  ▶ Running test_subscription_access...');
  const { gymMap, userMap } = await getTestEntities();

  const fitZone = gymMap['GYM-TEST-001']; // PRO
  const ironCore = gymMap['GYM-TEST-002']; // BASIC
  const fitZoneOwner = userMap['fitzone_owner@gymhood-test.com'];
  const ironCoreOwner = userMap['ironcore_owner@gymhood-test.com'];

  // Test 1: FitZone (PRO) has AI Coach enabled
  const isFitZoneAiEnabled = await authorizationService.isFeatureEnabled(fitZone.id, 'ai_coach');
  assertTest(isFitZoneAiEnabled === true, 'FitZone (PRO) must have ai_coach enabled in subscription features');

  const fzContext = await masterAuthzService.resolveAuthContext(fitZoneOwner.id, fitZone.id);
  assertTest(fzContext.permissions.includes('AI_COACH_USE'), 'FitZone Owner must have AI_COACH_USE');

  // Test 2: IronCore (BASIC) has AI Coach disabled
  const isIronCoreAiEnabled = await authorizationService.isFeatureEnabled(ironCore.id, 'ai_coach');
  assertTest(isIronCoreAiEnabled === false, 'IronCore (BASIC) must have ai_coach disabled in subscription features');

  const icContext = await masterAuthzService.resolveAuthContext(ironCoreOwner.id, ironCore.id);
  assertTest(!icContext.permissions.includes('AI_COACH_USE'), 'IronCore Owner must NOT have AI_COACH_USE on BASIC plan');

  // Test 3: Dynamic feature toggling
  const aiPerm = await UserPermissionMaster.findOne({ where: { permissionCode: 'AI_COACH_USE' } });
  if (aiPerm) {
    // Enable feature temporarily
    await GymPermission.update({ isEnabled: true }, { where: { gymId: ironCore.id, permissionId: aiPerm.id } });
    await masterAuthzService.invalidateUserAuthz(ironCoreOwner.id, ironCore.id);

    const toggledContext = await masterAuthzService.resolveAuthContext(ironCoreOwner.id, ironCore.id);
    assertTest(toggledContext.permissions.includes('AI_COACH_USE'), 'IronCore Owner must gain AI_COACH_USE when feature is enabled');

    // Re-disable feature
    await GymPermission.update({ isEnabled: false }, { where: { gymId: ironCore.id, permissionId: aiPerm.id } });
    await masterAuthzService.invalidateUserAuthz(ironCoreOwner.id, ironCore.id);

    const restoredContext = await masterAuthzService.resolveAuthContext(ironCoreOwner.id, ironCore.id);
    assertTest(!restoredContext.permissions.includes('AI_COACH_USE'), 'IronCore Owner must lose AI_COACH_USE after feature re-disabled');
  }

  console.log('    ✓ Subscription feature gating & dynamic permission enablement verified');
  return { name: 'test_subscription_access', passed: true };
}

