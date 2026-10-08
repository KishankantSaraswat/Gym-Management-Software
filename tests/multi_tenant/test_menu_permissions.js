import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';

export async function runTestMenuPermissions() {
  console.log('  ▶ Running test_menu_permissions...');
  const { gymMap, userMap } = await getTestEntities();
  const fitZone = gymMap['GYM-TEST-001'];

  // 1. Receptionist Menus
  const receptionist = userMap['fitzone_reception1@gymhood-test.com'];
  const recepContext = await masterAuthzService.resolveAuthContext(receptionist.id, fitZone.id);
  const recepMenuCodes = recepContext.menus.map(m => m.code);

  assertTest(recepMenuCodes.includes('MEMBERS'), 'Receptionist must see Members menu');
  assertTest(recepMenuCodes.includes('ATTENDANCE'), 'Receptionist must see Attendance menu');
  assertTest(!recepMenuCodes.includes('SETTINGS'), 'Receptionist must NOT see Gym Settings menu');
  assertTest(!recepMenuCodes.includes('REVENUE'), 'Receptionist must NOT see Revenue Analytics menu');

  // 2. Accountant Menus
  const accountant = userMap['fitzone_accountant@gymhood-test.com'];
  const accContext = await masterAuthzService.resolveAuthContext(accountant.id, fitZone.id);
  const accMenuCodes = accContext.menus.map(m => m.code);

  assertTest(accMenuCodes.includes('PAYMENTS') || accMenuCodes.includes('TRANSACTIONS'), 'Accountant must see Payments / Transactions menu');
  assertTest(accMenuCodes.includes('REVENUE'), 'Accountant must see Revenue menu');
  assertTest(!accMenuCodes.includes('SETTINGS'), 'Accountant must NOT see Gym Settings menu');

  // 3. Owner Menus
  const owner = userMap['fitzone_owner@gymhood-test.com'];
  const ownerContext = await masterAuthzService.resolveAuthContext(owner.id, fitZone.id);
  const ownerMenuCodes = ownerContext.menus.map(m => m.code);

  assertTest(ownerMenuCodes.includes('SETTINGS'), 'Owner must see Gym Settings menu');
  assertTest(ownerMenuCodes.includes('REVENUE'), 'Owner must see Revenue Analytics menu');
  assertTest(ownerMenuCodes.includes('MEMBERS'), 'Owner must see Members menu');
  assertTest(ownerMenuCodes.includes('BRANCHES'), 'Owner must see Branch Switcher menu');

  console.log('    ✓ Dynamic client menu visibility strictly aligned with user permissions');
  return { name: 'test_menu_permissions', passed: true };
}

