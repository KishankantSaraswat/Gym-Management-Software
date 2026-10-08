import { runTestUserGymMembership } from './test_user_gym_membership.js';
import { runTestMultiGymUser } from './test_multi_gym_user.js';
import { runTestGymIsolation } from './test_gym_isolation.js';
import { runTestBranchIsolation } from './test_branch_isolation.js';
import { runTestRolePermissions } from './test_role_permissions.js';
import { runTestMenuPermissions } from './test_menu_permissions.js';
import { runTestSubscriptionAccess } from './test_subscription_access.js';
import { runTestIdor } from './test_idor.js';
import { runTestInactiveGym } from './test_inactive_gym.js';
import { runTestInactiveUser } from './test_inactive_user.js';
import { runTestInactiveBranch } from './test_inactive_branch.js';
import { runTestPermissionEscalation } from './test_permission_escalation.js';
import { runTestAuthContext } from './test_auth_context.js';
import { runTestDatabaseIntegrity } from './test_database_integrity.js';
import { runTestCrudMatrix } from './test_crud_matrix.js';
import { runTestPerformance } from './test_performance.js';

async function main() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE MULTI-TENANT TEST SUITE (16 TEST MODULES)');
  console.log('================================================================\n');

  const tests = [
    { name: '1. User Gym Membership Resolution', fn: runTestUserGymMembership },
    { name: '2. Multi-Gym User (Dual Memberships)', fn: runTestMultiGymUser },
    { name: '3. Cross-Gym Tenant Isolation (403)', fn: runTestGymIsolation },
    { name: '4. Branch Scoping & Isolation', fn: runTestBranchIsolation },
    { name: '5. Role Permissions Matrix (RBAC)', fn: runTestRolePermissions },
    { name: '6. Dynamic Client Menu Tree', fn: runTestMenuPermissions },
    { name: '7. Subscription Feature Paywalls', fn: runTestSubscriptionAccess },
    { name: '8. IDOR Prevention (Foreign IDs)', fn: runTestIdor },
    { name: '9. Suspended Gym Access Denial', fn: runTestInactiveGym },
    { name: '10. Inactive User Session Denial', fn: runTestInactiveUser },
    { name: '11. Inactive Branch Access Denial', fn: runTestInactiveBranch },
    { name: '12. Role Privilege Escalation Denial', fn: runTestPermissionEscalation },
    { name: '13. Dynamic /me Context & Compact JWT', fn: runTestAuthContext },
    { name: '14. Database Relational Integrity & Orphans', fn: runTestDatabaseIntegrity },
    { name: '15. CRUD Matrix Across Roles & Modules', fn: runTestCrudMatrix },
    { name: '16. Latency Benchmark & EXPLAIN ANALYZE', fn: runTestPerformance },
  ];

  const results = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const test of tests) {
    const t0 = performance.now();
    try {
      const res = await test.fn();
      const duration = (performance.now() - t0).toFixed(1);
      results.push({ name: test.name, status: 'PASSED', duration: `${duration}ms`, details: res.metrics });
      passedCount++;
    } catch (err) {
      const duration = (performance.now() - t0).toFixed(1);
      results.push({ name: test.name, status: 'FAILED', duration: `${duration}ms`, error: err.message });
      failedCount++;
      console.error(`    ❌ ${test.name} FAILED:`, err.message);
    }
    console.log('');
  }

  console.log('================================================================');
  console.log('📊 CONSOLIDATED TEST EXECUTION SUMMARY');
  console.log('================================================================');
  console.table(results.map(r => ({
    'Test Scenario': r.name,
    'Status': r.status,
    'Duration': r.duration
  })));

  console.log(`\nTOTAL TESTS: ${tests.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);

  if (failedCount > 0) {
    console.log('❌ SOME TESTS FAILED.');
    process.exit(1);
  } else {
    console.log('✅ ALL MULTI-TENANT BACKEND & SECURITY TESTS PASSED (100%)!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

