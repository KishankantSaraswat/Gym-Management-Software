import { getTestEntities, assertTest, createSessionForUser } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import jwt from 'jsonwebtoken';

export async function runTestAuthContext() {
  console.log('  ▶ Running test_auth_context...');
  const { gymMap, branchMap, userMap } = await getTestEntities();
  const fitZone = gymMap['GYM-TEST-001'];
  const ggnBranch = branchMap['BR-FZ-GGN'];
  const owner = userMap['fitzone_owner@gymhood-test.com'];

  // Test session creation and compact token structure
  const { token, sessionId } = await createSessionForUser(owner, fitZone.id, ggnBranch.id);
  assertTest(token, 'Session JWT token must be generated');
  assertTest(sessionId, 'Session ID UUID must be generated');

  const secret = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  const decoded = jwt.verify(token, secret);

  assertTest(String(decoded.sub) === String(owner.id), 'Token sub must equal user id');
  assertTest(String(decoded.gym_id) === String(fitZone.id), 'Token gym_id must equal FitZone id');
  assertTest(String(decoded.branch_id) === String(ggnBranch.id), 'Token branch_id must equal branch id');
  assertTest(decoded.session_id === sessionId, 'Token session_id must match session');

  // Verify token is compact (less than 350 characters)
  assertTest(token.length < 350, `Token length must be compact (<350 chars). Actual: ${token.length}`);

  // Test full auth context resolution
  const context = await masterAuthzService.resolveAuthContext(owner.id, fitZone.id, ggnBranch.id);
  assertTest(context.user && context.user.id === owner.id, 'Context user matches');
  assertTest(context.gym && context.gym.id === fitZone.id, 'Context gym matches');
  assertTest(context.branch && context.branch.id === ggnBranch.id, 'Context branch matches');
  assertTest(context.subscription && context.subscription.code === 'PRO', 'Context subscription matches');
  assertTest(context.role === 'GYM_OWNER', 'Context role matches');
  assertTest(Array.isArray(context.permissions) && context.permissions.length > 0, 'Permissions array populated');
  assertTest(Array.isArray(context.menus) && context.menus.length > 0, 'Menus array populated');
  assertTest(Array.isArray(context.available_gyms), 'Available gyms array populated');
  assertTest(Array.isArray(context.available_branches), 'Available branches array populated');
  assertTest(typeof context.authz_version === 'number', 'Authz version is integer');

  console.log('    ✓ Dynamic authorization context, compact JWT, and session verified');
  return { name: 'test_auth_context', passed: true };
}
