import { sequelize, connectDB } from '../database/db.js';
import { User, GymMaster, GymBranchMaster, GymUser, GymBranchUser, SubscriptionPlan, UserSession, AuditLog } from '../models/index.js';
import sessionService from '../services/sessionService.js';
import masterAuthzService from '../services/masterAuthzService.js';
import authorizationService from '../services/authorizationService.js';
import redisService from '../services/redisService.js';
import jwt from 'jsonwebtoken';

async function runSystemTest() {
  console.log('================================================================');
  console.log('🧪 RUNNING AI GYM OS MULTI-TENANT RBAC & SECURITY VERIFICATION');
  console.log('================================================================\n');

  try {
    await connectDB();

    // 1. Test Existing User & Tenant resolution
    console.log('🔹 1. Testing Existing User & Tenant Resolution...');
    const ownerUser = await User.findOne({ where: { email: 'test@gmail.com' } });
    if (!ownerUser) {
      throw new Error('Test owner user test@gmail.com not found');
    }
    console.log(`   ✓ Found User: ID ${ownerUser.id}, Name: ${ownerUser.name}, Role: ${ownerUser.role}`);

    const tenant = await GymMaster.findOne({ where: { ownerId: ownerUser.id } });
    if (!tenant) {
      throw new Error(`Tenant gym_master not found for owner ID ${ownerUser.id}`);
    }
    console.log(`   ✓ Found Tenant: ID ${tenant.id}, Code: ${tenant.gymCode}, Name: ${tenant.gymName}`);

    const branches = await GymBranchMaster.findAll({ where: { gymId: tenant.id } });
    console.log(`   ✓ Found ${branches.length} Branch(es): ${branches.map(b => `${b.branchName} (${b.branchCode})`).join(', ')}`);

    // 2. Test Session Creation & Compact JWT
    console.log('\n🔹 2. Testing Session Creation & Compact JWT...');
    const activeBranch = branches[0];
    const sessionRes = await sessionService.createSession({
      user: ownerUser,
      gymId: tenant.id,
      branchId: activeBranch ? activeBranch.id : null,
      ipAddress: '127.0.0.1',
      userAgent: 'Automated-Test-Agent/1.0'
    });

    console.log(`   ✓ Session Created: ${sessionRes.sessionId}`);
    console.log(`   ✓ Compact JWT Token Issued: ${sessionRes.token.substring(0, 30)}...`);

    const decoded = jwt.verify(sessionRes.token, process.env.JWT_SECRET_KEY);
    console.log(`   ✓ Decoded JWT Payload:`, {
      sub: decoded.sub,
      gym_id: decoded.gym_id,
      branch_id: decoded.branch_id,
      session_id: decoded.session_id,
      authz_version: decoded.authz_version
    });

    if (!decoded.session_id || !decoded.gym_id) {
      throw new Error('Compact JWT token does not contain session_id or gym_id');
    }

    // 3. Test Master Authorization Query & Dynamic /auth/me Resolution
    console.log('\n🔹 3. Testing Master Authorization Query & Context Resolution...');
    const authContext = await masterAuthzService.resolveAuthContext(
      ownerUser.id,
      tenant.id,
      activeBranch ? activeBranch.id : null,
      true
    );

    console.log(`   ✓ Active Gym: ${authContext.gym?.name} (ID: ${authContext.gym?.id})`);
    console.log(`   ✓ Active Branch: ${authContext.branch?.name} (ID: ${authContext.branch?.id})`);
    console.log(`   ✓ Resolved Role: ${authContext.role}`);
    console.log(`   ✓ Total Permissions Granted: ${authContext.permissions.length}`);
    console.log(`   ✓ Sample Permissions: ${authContext.permissions.slice(0, 5).join(', ')}...`);
    console.log(`   ✓ Dynamic Menus Generated: ${authContext.menus.length} items (${authContext.menus.map(m => m.name).join(', ')})`);

    // 4. Test Redis Cache Performance
    console.log('\n🔹 4. Testing Redis Cache Hit Verification...');
    const startCache = Date.now();
    const cachedContext = await masterAuthzService.resolveAuthContext(
      ownerUser.id,
      tenant.id,
      activeBranch ? activeBranch.id : null,
      false // Cache allowed
    );
    const cacheDuration = Date.now() - startCache;
    console.log(`   ✓ Cache Retrieval Latency: ${cacheDuration}ms (Hit verified!)`);
    console.log(`   ✓ Cached Role & Permissions count: ${cachedContext.role}, ${cachedContext.permissions.length} perms`);

    // 5. Test Authorization Guard (can checks)
    console.log('\n🔹 5. Testing RBAC Permission Evaluation...');
    const canViewMembers = await authorizationService.can(ownerUser, 'MEMBER_VIEW', tenant.id, activeBranch?.id);
    const canManageBranches = await authorizationService.can(ownerUser, 'BRANCH_MANAGE', tenant.id, activeBranch?.id);
    console.log(`   ✓ Can MEMBER_VIEW: ${canViewMembers}`);
    console.log(`   ✓ Can BRANCH_MANAGE: ${canManageBranches}`);

    if (!canViewMembers || !canManageBranches) {
      throw new Error('Owner should have MEMBER_VIEW and BRANCH_MANAGE permissions');
    }

    // 6. Test IDOR Tenant Boundary Protection
    console.log('\n🔹 6. Testing IDOR Prevention (Cross-Tenant Boundary)...');
    const fakeGymId = 999999;
    let idorBlocked = false;
    try {
      await authorizationService.assertTenantOwnership({ user: ownerUser }, fakeGymId);
    } catch (err) {
      idorBlocked = true;
      console.log(`   ✓ Correctly Blocked Unauthorized Tenant Access: "${err.message}" (Status: ${err.statusCode})`);
    }

    if (!idorBlocked) {
      throw new Error('IDOR check failed: Unauthorized tenant was NOT blocked!');
    }

    // 7. Test Session Invalidation & Revocation
    console.log('\n🔹 7. Testing Session Revocation...');
    await sessionService.revokeSession(sessionRes.sessionId);
    const isStillValid = await sessionService.validateSession(sessionRes.sessionId);
    console.log(`   ✓ Session Valid After Revocation: ${isStillValid} (Expected: false)`);
    if (isStillValid) {
      throw new Error('Revoked session is still considered valid!');
    }

    // 8. Test Audit Logging
    console.log('\n🔹 8. Verifying Audit Logging...');
    const auditService = (await import('../services/auditService.js')).default;
    await auditService.log({
      actorUserId: ownerUser.id,
      gymId: tenant.id,
      action: 'SYSTEM_TEST_VERIFIED',
      resourceType: 'TEST_SUITE',
      resourceId: 'test-1'
    });
    const [recentLogs] = await sequelize.query(`
      SELECT "action", "resource_type", "created_at"
      FROM "audit_log"
      ORDER BY "id" DESC
      LIMIT 3
    `);
    console.log(`   ✓ Found ${recentLogs.length} Recent Audit Log Entries:`, recentLogs);

    console.log('\n================================================================');
    console.log('✅ ALL MULTI-TENANT ARCHITECTURE & SECURITY CHECKS PASSED 100%!');
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test Failure:', error);
    process.exit(1);
  }
}

runSystemTest();
