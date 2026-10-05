import { sequelize, connectDB } from '../database/db.js';
import {
  User,
  Gym,
  VerificationDocument,
  GymMedia,
  Plan,
  GymPlanRevenue,
  AnalyticsCache,
  UserGymLog,
  GymDailyStats,
  GymRating,
  ProgressTracker,
  WalletTransaction,
  UserPlan,
  UserFitnessProfile,
  SettlementRequest,
  AdminAction,
  GymAnnouncement,
  Announcement,
  AdminPlan,
  GymSubscription,
  UserData
} from '../models/index.js';

async function runMigration() {
  try {
    console.log('🚀 Connecting to PostgreSQL database...');
    await connectDB();

    console.log('📦 Syncing all models with relationships and creating PostgreSQL tables...');
    await sequelize.sync({ alter: true });

    console.log('✅ All PostgreSQL tables and relationships created and synced successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
