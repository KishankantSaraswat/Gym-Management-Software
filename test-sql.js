import { sequelize } from './database/db.js';

async function check() {
  try {
    const [cols] = await sequelize.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name IN ('user_group_master', 'permission_master', 'group_permission', 'client_menu_master', 'client_master', 'user_branch_mapping', 'app_menu_master', 'user_permission')
      ORDER BY table_name, ordinal_position;
    `);
    cols.forEach(c => console.log(`${c.table_name}.${c.column_name}`));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();

