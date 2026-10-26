import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config({ path: './config/config.env' });

const dbName = process.env.PG_DATABASE || process.env.DB_NAME || 'gymhood';
const dbUser = process.env.PG_USER || process.env.DB_USER || 'postgres';
const dbPassword = process.env.PG_PASSWORD || process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.PG_HOST || process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.PG_PORT || process.env.DB_PORT || '5432', 10);

import { recordSequelizeQuery, getCurrentRequestId } from '../middlewares/apiLogger.js';

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  benchmark: true,
  logging: (sql, timing) => {
    // Record query in the active request's log trace
    const currentReqId = getCurrentRequestId();
    if (currentReqId) {
      recordSequelizeQuery(currentReqId, {
        sql,
        duration: typeof timing === 'number' ? timing : 0
      });
    }

    if (process.env.NODE_ENV === 'development' && (process.env.ENABLE_LOG === 'true' || process.env.API_LOGGER_ENABLED === 'true')) {
      const timingStr = typeof timing === 'number' ? ` \x1b[33m[${timing}ms]\x1b[0m` : '';
      console.log(`\x1b[90m[SQL]${timingStr}\x1b[0m \x1b[36m${sql}\x1b[0m`);
    }
  },
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: false
  }
});

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL Connection has been established successfully.');
    // Enable PostGIS extension if needed
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    } catch (extErr) {
      console.warn('PostGIS extension check/creation warning:', extErr.message);
    }
    // Sync Rights-based tables, AdminUser table, and ClientCompanyMaster
    try {
      const { UserGroup, UserGroupRight, UserMasterRight, UserBranchRight } = await import('../models/rights_schema.js');
      const { AdminUser } = await import('../models/admin_user_schema.js');
      const { ClientCompanyMaster } = await import('../models/client_company_schema.js');
      const {
        AdminCompany,
        AdminUserGroup,
        AdminUserHierarchical,
        AdminUserGroupPermission,
        AdminUserPermission
      } = await import('../models/admin_hierarchy_schema.js');
      const {
        ClientCompanyUserGroup,
        ClientCompanyUser,
        ClientCompanyUserGroupPermission,
        ClientCompanyUserPermission
      } = await import('../models/client_hierarchy_schema.js');

      await UserGroup.sync({ alter: true });
      await UserGroupRight.sync({ alter: true });
      await UserMasterRight.sync({ alter: true });
      await UserBranchRight.sync({ alter: true });
      await AdminUser.sync({ alter: true });
      await ClientCompanyMaster.sync({ alter: true });

      // Sync Admin Hierarchy Tables
      await AdminCompany.sync({ alter: true });
      await AdminUserGroup.sync({ alter: true });
      await AdminUserHierarchical.sync({ alter: true });
      await AdminUserGroupPermission.sync({ alter: true });
      await AdminUserPermission.sync({ alter: true });

      // Sync Client Company Hierarchy Tables
      await ClientCompanyUserGroup.sync({ alter: true });
      await ClientCompanyUser.sync({ alter: true });
      await ClientCompanyUserGroupPermission.sync({ alter: true });
      await ClientCompanyUserPermission.sync({ alter: true });

      // Sync Global Menu Master
      const { GlobalMenuMaster } = await import('../models/global_menu_schema.js');
      await GlobalMenuMaster.sync({ alter: true });
    } catch (syncErr) {
      console.warn('Hierarchy & Rights table sync warning:', syncErr.message);
    }

    if (process.env.DB_AUTO_SYNC === 'true') {
      await sequelize.sync({ alter: true });
      console.log('All PostgreSQL tables synced successfully via auto-sync.');
    } else {
      console.log('PostgreSQL schema managed via versioned database migrations.');
    }
  } catch (error) {
    console.error('Unable to connect to the PostgreSQL database:', error);
    process.exit(1);
  }
};
