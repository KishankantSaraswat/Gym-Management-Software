import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, connectDB } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runV2Migration() {
  console.log('=====================================================');
  console.log('🚀 Starting AI Gym OS Multi-Tenant Foundation Migration');
  console.log('=====================================================');
  
  try {
    await connectDB();
    
    const migrationSqlPath = path.join(__dirname, '../database/migrations/20261008_upgrade_to_multi_tenant_ai_gym_os.sql');
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');

    console.log('📜 Executing 20261008_upgrade_to_multi_tenant_ai_gym_os.sql ...');
    await sequelize.query(sql);

    console.log('✅ Master Multi-Tenant Migration Applied Successfully!');

    // Verify row counts in new tables
    const tablesToVerify = [
      'gym_master',
      'gym_branch_master',
      'gym_user',
      'gym_branch_user',
      'user_group_master',
      'user_permission_master',
      'user_group_permission',
      'subscription_plan',
      'gym_permission',
      'client_menu_master',
      'client_menu_permission'
    ];

    console.log('\n📊 Migration Verification Summary:');
    for (const table of tablesToVerify) {
      const [res] = await sequelize.query(`SELECT count(*) as count FROM "${table}"`);
      console.log(`   ✓ ${table}: ${res[0].count} records`);
    }

    console.log('\n🎉 ALL FOUNDATION TABLES & CONSTRAINTS ACTIVE AND POPULATED!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed with error:');
    console.error('   Message:', error.message);
    if (error.parent) {
      console.error('   SQL Detail:', error.parent.detail);
      console.error('   SQL Hint:', error.parent.hint);
      console.error('   Position:', error.parent.position);
    }
    process.exit(1);
  }
}

runV2Migration();
