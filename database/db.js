import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config({ path: './config/config.env' });

const dbName = process.env.PG_DATABASE || process.env.DB_NAME || 'gymhood';
const dbUser = process.env.PG_USER || process.env.DB_USER || 'postgres';
const dbPassword = process.env.PG_PASSWORD || process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.PG_HOST || process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.PG_PORT || process.env.DB_PORT || '5432', 10);

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? (msg) => {
    const prefixMatch = msg.match(/^(Executing \([^)]+\):)\s*(.*)/);
    if (prefixMatch) {
      const [, prefix, query] = prefixMatch;
      // SQL Queries in bright Cyan, "Executing..." prefix in dim gray
      console.log(`\x1b[90m${prefix}\x1b[0m \x1b[36m${query}\x1b[0m`);
    } else {
      console.log(`\x1b[36m${msg}\x1b[0m`);
    }
  } : false,
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
    await sequelize.sync({ alter: true });
    console.log('All PostgreSQL tables synced successfully.');
  } catch (error) {
    console.error('Unable to connect to the PostgreSQL database:', error);
    process.exit(1);
  }
};
