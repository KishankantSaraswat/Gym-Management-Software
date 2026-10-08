import { getTestEntities, assertTest } from './test_helper.js';
import masterAuthzService from '../../services/masterAuthzService.js';
import { sequelize } from '../../database/db.js';

export async function runTestPerformance() {
  console.log('  ▶ Running test_performance & latency benchmarking...');
  const { gymMap, userMap } = await getTestEntities();
  const fitZone = gymMap['GYM-TEST-001'];
  const owner = userMap['fitzone_owner@gymhood-test.com'];

  // 1. Cold Query Measurement
  await masterAuthzService.invalidateUserAuthz(owner.id, fitZone.id);
  const coldStart = performance.now();
  await masterAuthzService.resolveAuthContext(owner.id, fitZone.id);
  const coldLatency = performance.now() - coldStart;

  // 2. Warm Cache Latency Measurement (50 iterations)
  const latencies = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    await masterAuthzService.resolveAuthContext(owner.id, fitZone.id);
    latencies.push(performance.now() - t0);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);

  // 3. PostgreSQL EXPLAIN ANALYZE
  const [explainResult] = await sequelize.query(`
    EXPLAIN ANALYZE
    SELECT gu.id AS gym_user_id, gu.gym_id, gm.gym_code, gm.gym_name, gm.status
    FROM gym_user gu
    JOIN gym_master gm ON gu.gym_id = gm.id
    WHERE gu.user_id = ${owner.id} AND gu.gym_id = ${fitZone.id} AND gu.status = 'active';
  `);

  const executionTimeLine = explainResult.find(r => r['QUERY PLAN'].includes('Execution Time'));
  const executionPlanSummary = executionTimeLine ? executionTimeLine['QUERY PLAN'] : 'Analyzed successfully';

  console.log(`    ✓ Cold latency: ${coldLatency.toFixed(2)}ms`);
  console.log(`    ✓ Warm Cache Latency: p50 = ${p50}ms, p95 = ${p95}ms, p99 = ${p99}ms`);
  console.log(`    ✓ DB Query Plan: ${executionPlanSummary}`);

  assertTest(parseFloat(p50) < 5.0, `p50 cache latency must be under 5ms (Actual: ${p50}ms)`);

  return {
    name: 'test_performance',
    passed: true,
    metrics: { coldLatency: coldLatency.toFixed(2), p50, p95, p99, dbPlan: executionPlanSummary }
  };
}

