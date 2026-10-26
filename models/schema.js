import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { AdminUser } from './admin_user_schema.js';

// 1. Unified User
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  registrationSessionId: { type: DataTypes.STRING, defaultValue: null },
  isPwdAuth: { type: DataTypes.BOOLEAN, defaultValue: false },
  password: { type: DataTypes.STRING },
  tempPassword: { type: DataTypes.STRING },
  googleId: { type: DataTypes.STRING },
  role: { type: DataTypes.ENUM('User', 'GymOwner', 'Admin'), defaultValue: 'User' },
  isSuperAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
  walletBalance: { type: DataTypes.FLOAT, defaultValue: 0 },
  address: { type: DataTypes.STRING },
  pincode: { type: DataTypes.STRING },
  latitude: { type: DataTypes.FLOAT },
  longitude: { type: DataTypes.FLOAT },
  phone: { type: DataTypes.STRING },
  profile_picture: { type: DataTypes.JSONB },
  accountVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  pwdSetupAttempts: { type: DataTypes.JSONB, defaultValue: { count: 0 } },
  forgotPasswordAttempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  forgotPasswordAttemptsExpire: { type: DataTypes.DATE },
  verificationCode: { type: DataTypes.INTEGER },
  verificationCodeExpire: { type: DataTypes.DATE },
  resetPasswordToken: { type: DataTypes.STRING },
  resetPasswordExpire: { type: DataTypes.DATE },
  resetPasswordOTP: { type: DataTypes.INTEGER },
  resetPasswordOTPExpire: { type: DataTypes.DATE },
  resetPasswordSessionId: { type: DataTypes.STRING },
  resetPasswordSessionExpire: { type: DataTypes.DATE },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  fcmToken: { type: DataTypes.STRING }
}, { tableName: 'users', timestamps: true });

User.prototype.generateVerificationCode = function () {
  const firstDigit = Math.floor(Math.random() * 9) + 1;
  const remainingDigits = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  const code = parseInt(firstDigit + remainingDigits, 10);
  this.verificationCode = code;
  this.verificationCodeExpire = new Date(Date.now() + 15 * 60 * 1000);
  return code;
};

User.prototype.generateToken = function () {
  const secret = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  return jwt.sign({ id: this.id }, secret, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

User.prototype.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
  return resetToken;
};

User.prototype.comparePassword = async function (password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

Object.defineProperty(User.prototype, '_id', { get() { return this.id; } });
Object.defineProperty(User.prototype, 'location', {
  get() {
    return {
      address: this.address,
      pincode: this.pincode,
      coordinates: [this.longitude || 0, this.latitude || 0]
    };
  }
});

User.findById = (id) => (!id ? Promise.resolve(null) : User.findByPk(id));
User.findOneByEmail = (email) => (!email ? Promise.resolve(null) : User.findOne({ where: { email: email.toLowerCase() } }));


// 1A. Client (Tenant Master)
const Client = sequelize.define('Client', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  contactEmail: { type: DataTypes.STRING },
  contactPhone: { type: DataTypes.STRING },
  ownerId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('active', 'inactive', 'suspended'), defaultValue: 'active' },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'client_master', timestamps: true });

Object.defineProperty(Client.prototype, '_id', { get() { return this.id; } });
Client.findById = (id) => (!id ? Promise.resolve(null) : Client.findByPk(id));


// 2. Gym (Branch)
const Gym = sequelize.define('Gym', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  clientId: { type: DataTypes.INTEGER, allowNull: true }, // Added for SaaS Tenant
  name: { type: DataTypes.STRING, allowNull: false },
  gymSlogan: { type: DataTypes.STRING(500) },
  address: { type: DataTypes.STRING, allowNull: false },
  latitude: { type: DataTypes.FLOAT, allowNull: false },
  longitude: { type: DataTypes.FLOAT, allowNull: false },
  pincode: { type: DataTypes.STRING },
  capacity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  openTime: { type: DataTypes.STRING, allowNull: false },
  closeTime: { type: DataTypes.STRING, allowNull: false },
  contactEmail: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  alternatePhone: { type: DataTypes.STRING },
  gymType: { type: DataTypes.ENUM('unisex', 'men-only', 'women-only', 'fitness-studio'), defaultValue: 'unisex' },
  facilities: { type: DataTypes.JSONB, defaultValue: [] },
  onboardingStep: { type: DataTypes.INTEGER, defaultValue: 1 },
  onboardingStatus: { type: DataTypes.ENUM('pending', 'completed'), defaultValue: 'pending' },
  about: { type: DataTypes.TEXT },
  equipmentList: { type: DataTypes.JSONB, defaultValue: [] },
  status: { type: DataTypes.ENUM('open', 'closed', 'maintenance'), defaultValue: 'open' },
  avgRating: { type: DataTypes.FLOAT, defaultValue: 0 },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  mediaId: { type: DataTypes.INTEGER },
  ownerId: { type: DataTypes.INTEGER, allowNull: false },
  verificationDocumentsId: { type: DataTypes.INTEGER },
  shifts: { type: DataTypes.JSONB, defaultValue: [] },
  razorpayAccountId: { type: DataTypes.STRING },
  kycVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  kycNotes: { type: DataTypes.STRING },
  commissionRate: { type: DataTypes.FLOAT, defaultValue: 0 },
  assignedPlanId: { type: DataTypes.INTEGER },
  subscriptionStatus: { type: DataTypes.ENUM('pending', 'active', 'expired'), defaultValue: 'pending' },
  subscriptionExpiry: { type: DataTypes.DATE }
}, { tableName: 'gyms', timestamps: true });

Object.defineProperty(Gym.prototype, '_id', { get() { return this.id; } });
Object.defineProperty(Gym.prototype, 'location', {
  get() {
    return {
      address: this.address,
      pincode: this.pincode,
      coordinates: [this.longitude || 0, this.latitude || 0]
    };
  }
});
Gym.findById = (id) => (!id ? Promise.resolve(null) : Gym.findByPk(id));


// 2B. User Branch Mapping
const UserGymMapping = sequelize.define('UserGymMapping', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  roleId: { type: DataTypes.INTEGER }, // To map to user_group_master later
  isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
}, { tableName: 'user_branch_mapping', timestamps: true });

Object.defineProperty(UserGymMapping.prototype, '_id', { get() { return this.id; } });
UserGymMapping.findById = (id) => (!id ? Promise.resolve(null) : UserGymMapping.findByPk(id));

// 3. Verification Document
const VerificationDocument = sequelize.define('VerificationDocument', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  documentUrls: { type: DataTypes.JSONB, defaultValue: [] },
  gstUrl: { type: DataTypes.STRING },
  idProofUrl: { type: DataTypes.STRING },
  certificationUrl: { type: DataTypes.STRING }
}, { tableName: 'verification_documents', timestamps: true });

Object.defineProperty(VerificationDocument.prototype, '_id', { get() { return this.id; } });
VerificationDocument.findById = (id) => VerificationDocument.findByPk(id);


// 4. Gym Media
const GymMedia = sequelize.define('GymMedia', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  mediaUrls: { type: DataTypes.JSONB, defaultValue: [] },
  logoUrl: { type: DataTypes.STRING },
  bannerPhotoUrl: { type: DataTypes.STRING },
  frontPhotoUrl: { type: DataTypes.STRING },
  receptionPhotoUrl: { type: DataTypes.STRING },
  workoutFloorPhotoUrl: { type: DataTypes.STRING },
  lockerRoomPhotoUrl: { type: DataTypes.STRING },
  trainerTeamPhotoUrl: { type: DataTypes.STRING }
}, { tableName: 'gym_media', timestamps: true });

Object.defineProperty(GymMedia.prototype, '_id', { get() { return this.id; } });
GymMedia.findById = (id) => GymMedia.findByPk(id);


// 5. Plan
const Plan = sequelize.define('Plan', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  validity: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  discountPercent: { type: DataTypes.FLOAT, defaultValue: 0 },
  duration: { type: DataTypes.FLOAT, allowNull: false },
  features: { type: DataTypes.TEXT },
  planType: { type: DataTypes.STRING },
  isTrainerIncluded: { type: DataTypes.BOOLEAN, defaultValue: false },
  maxExpiryFactor: { type: DataTypes.FLOAT, defaultValue: 1 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastUpdatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'plans', timestamps: true });

Object.defineProperty(Plan.prototype, '_id', { get() { return this.id; } });
Plan.findById = (id) => Plan.findByPk(id);


// 6. Gym Plan Revenue & Analytics Cache
const GymPlanRevenue = sequelize.define('GymPlanRevenue', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  planId: { type: DataTypes.INTEGER, allowNull: false },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  revenue: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  commission: { type: DataTypes.FLOAT, defaultValue: 0 }
}, { tableName: 'gym_plan_revenues', timestamps: true });

const AnalyticsCache = sequelize.define('AnalyticsCache', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('revenue', 'members'), allowNull: false },
  data: { type: DataTypes.JSONB, allowNull: false }
}, { tableName: 'analytics_cache', timestamps: true });

Object.defineProperty(GymPlanRevenue.prototype, '_id', { get() { return this.id; } });
Object.defineProperty(AnalyticsCache.prototype, '_id', { get() { return this.id; } });


// 7. User Gym Log
const UserGymLog = sequelize.define('UserGymLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  startingDate: { type: DataTypes.DATE, allowNull: false },
  dateArray: { type: DataTypes.JSONB, defaultValue: Array(300).fill(-1) },
  currentStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
  currentWeekStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
  thisWeekStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
  previousLogId: { type: DataTypes.INTEGER }
}, { tableName: 'user_gym_logs', timestamps: true });

Object.defineProperty(UserGymLog.prototype, '_id', { get() { return this.id; } });
UserGymLog.findById = (id) => UserGymLog.findByPk(id);


// 8. Gym Daily Stats
const GymDailyStats = sequelize.define('GymDailyStats', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  totalUsersToday: { type: DataTypes.INTEGER, defaultValue: 0 },
  activeUsers: { type: DataTypes.INTEGER, defaultValue: 0 },
  register: { type: DataTypes.JSONB, defaultValue: [] },
  capacity: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'gym_daily_stats', timestamps: true });

Object.defineProperty(GymDailyStats.prototype, '_id', { get() { return this.id; } });
GymDailyStats.findById = (id) => GymDailyStats.findByPk(id);


// 9. Gym Rating
const GymRating = sequelize.define('GymRating', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  rating: { type: DataTypes.FLOAT, allowNull: false },
  feedback: { type: DataTypes.TEXT }
}, { tableName: 'gym_ratings', timestamps: true });

Object.defineProperty(GymRating.prototype, '_id', { get() { return this.id; } });
GymRating.findById = (id) => GymRating.findByPk(id);


// 10. Progress Tracker
const ProgressTracker = sequelize.define('ProgressTracker', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  phyMetrics: { type: DataTypes.JSONB },
  perfMetrics: { type: DataTypes.JSONB },
  notes: { type: DataTypes.TEXT }
}, { tableName: 'progress_trackers', timestamps: true });

Object.defineProperty(ProgressTracker.prototype, '_id', { get() { return this.id; } });
ProgressTracker.findById = (id) => ProgressTracker.findByPk(id);


// 11. Wallet Transaction
const WalletTransaction = sequelize.define('WalletTransaction', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  type: { type: DataTypes.ENUM('Credit', 'Debit'), allowNull: false },
  status: { type: DataTypes.ENUM('Pending', 'Completed', 'Failed', 'Refunded', 'Pending Approval', 'Rejected'), defaultValue: 'Pending' },
  razorpayOrderId: { type: DataTypes.STRING },
  razorpayPaymentId: { type: DataTypes.STRING },
  razorpayRefundId: { type: DataTypes.STRING },
  reason: { type: DataTypes.STRING },
  transactionDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  adminTransferTxnId: { type: DataTypes.STRING },
  adminNotes: { type: DataTypes.TEXT },
  metadata: { type: DataTypes.JSONB }
}, { tableName: 'wallet_transactions', timestamps: true });

Object.defineProperty(WalletTransaction.prototype, '_id', { get() { return this.id; } });
WalletTransaction.findById = (id) => WalletTransaction.findByPk(id);


// 12. User Plan
const UserPlan = sequelize.define('UserPlan', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  planId: { type: DataTypes.INTEGER, allowNull: false },
  perDayCost: { type: DataTypes.FLOAT, allowNull: false },
  planDuration: { type: DataTypes.INTEGER, allowNull: false },
  amountDeducted: { type: DataTypes.FLOAT, allowNull: false },
  purchaseDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  usedDays: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalDays: { type: DataTypes.INTEGER, allowNull: false },
  maxExpiryDate: { type: DataTypes.DATE },
  isExpired: { type: DataTypes.BOOLEAN, defaultValue: false },
  metadata: { type: DataTypes.JSONB }
}, { tableName: 'user_plans', timestamps: true });

Object.defineProperty(UserPlan.prototype, '_id', { get() { return this.id; } });
UserPlan.findById = (id) => UserPlan.findByPk(id);


// 13. User Fitness Profile
const UserFitnessProfile = sequelize.define('UserFitnessProfile', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  age: { type: DataTypes.INTEGER },
  gender: { type: DataTypes.STRING },
  height: { type: DataTypes.FLOAT },
  weight: { type: DataTypes.FLOAT },
  bmi: { type: DataTypes.FLOAT },
  bodyFatPercent: { type: DataTypes.FLOAT },
  bodyMeasurement: { type: DataTypes.JSONB },
  goal: { type: DataTypes.ENUM('Weight Loss', 'Muscle Gain', 'Maintenance', 'Endurance', 'Other') },
  targetWeight: { type: DataTypes.FLOAT },
  goalTimeFrame: { type: DataTypes.STRING },
  activityLevel: { type: DataTypes.ENUM('Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extremely Active') },
  fitnessLevel: { type: DataTypes.ENUM('Beginner', 'Intermediate', 'Advanced') },
  trainingHistory: { type: DataTypes.TEXT },
  preferredWorkoutTime: { type: DataTypes.STRING },
  injuriesOrConstraints: { type: DataTypes.TEXT },
  preferredWorkoutType: { type: DataTypes.JSONB },
  availability: { type: DataTypes.JSONB },
  preTrainingLocation: { type: DataTypes.ENUM('Gym', 'Home', 'Outdoor', 'Studio') },
  dietType: { type: DataTypes.ENUM('Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Mediterranean', 'Flexitarian', 'Other') },
  caloricIntakeGoal: { type: DataTypes.INTEGER }
}, { tableName: 'user_fitness_profiles', timestamps: true });

Object.defineProperty(UserFitnessProfile.prototype, '_id', { get() { return this.id; } });
UserFitnessProfile.findById = (id) => UserFitnessProfile.findByPk(id);


// 14. Settlement Request
const SettlementRequest = sequelize.define('SettlementRequest', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  ownerId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  status: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), defaultValue: 'Pending' },
  bankDetails: { type: DataTypes.JSONB },
  adminNotes: { type: DataTypes.TEXT },
  transactionId: { type: DataTypes.STRING },
  requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  processedAt: { type: DataTypes.DATE }
}, { tableName: 'settlement_requests', timestamps: true });

Object.defineProperty(SettlementRequest.prototype, '_id', { get() { return this.id; } });
SettlementRequest.findById = (id) => SettlementRequest.findByPk(id);


// 15. Admin Action
const AdminAction = sequelize.define('AdminAction', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  actionType: { type: DataTypes.ENUM('Verification', 'Suspension', 'FeatureUpdate', 'ContentModeration', 'Other'), allowNull: false },
  notes: { type: DataTypes.TEXT },
  actionData: { type: DataTypes.JSONB },
  performedBy: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'admin_actions', timestamps: true });

Object.defineProperty(AdminAction.prototype, '_id', { get() { return this.id; } });
AdminAction.findById = (id) => AdminAction.findByPk(id);


// 16. Announcements
const GymAnnouncement = sequelize.define('GymAnnouncement', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  createdBy: { type: DataTypes.INTEGER },
  message: { type: DataTypes.TEXT, allowNull: false },
  targetUsers: { type: DataTypes.JSONB, defaultValue: [] }
}, { tableName: 'gym_announcements', timestamps: true });

const Announcement = sequelize.define('Announcement', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT, allowNull: false },
  createdBy: { type: DataTypes.INTEGER },
  targetType: { type: DataTypes.ENUM('ALL', 'ALL_USERS', 'ALL_GYMS', 'SPECIFIC_GYMS', 'SPECIFIC_USERS'), defaultValue: 'ALL_USERS' },
  targetGyms: { type: DataTypes.JSONB, defaultValue: [] },
  targetUsers: { type: DataTypes.JSONB, defaultValue: [] }
}, { tableName: 'admin_announcements', timestamps: true });

Object.defineProperty(GymAnnouncement.prototype, '_id', { get() { return this.id; } });
Object.defineProperty(Announcement.prototype, '_id', { get() { return this.id; } });


// 17. Admin Plan
const AdminPlan = sequelize.define('AdminPlan', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  duration: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'admin_plans', timestamps: true });

Object.defineProperty(AdminPlan.prototype, '_id', { get() { return this.id; } });
AdminPlan.findById = (id) => AdminPlan.findByPk(id);


// 18. Gym Subscription
const GymSubscription = sequelize.define('GymSubscription', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false },
  adminPlanId: { type: DataTypes.INTEGER, allowNull: false },
  startDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  endDate: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'active', 'expired'), defaultValue: 'pending' },
  paymentId: { type: DataTypes.STRING },
  orderId: { type: DataTypes.STRING },
  amountPaid: { type: DataTypes.FLOAT }
}, { tableName: 'gym_subscriptions', timestamps: true });

Object.defineProperty(GymSubscription.prototype, '_id', { get() { return this.id; } });
GymSubscription.findById = (id) => GymSubscription.findByPk(id);


// 19. User Data
const UserData = sequelize.define('UserData', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  gender: { type: DataTypes.ENUM('Male', 'Female', 'Other') },
  dob: { type: DataTypes.DATE },
  weight: { type: DataTypes.FLOAT },
  height: { type: DataTypes.FLOAT },
  location: { type: DataTypes.STRING },
  workoutExperience: { type: DataTypes.ENUM('Beginner', 'Intermediate', 'Advanced') },
  jobProfile: { type: DataTypes.ENUM('Student', 'Employee', 'Self-employed', 'Business person') },
  bodyType: { type: DataTypes.ENUM('Ectomorph', 'Mesomorph', 'Endomorph') },
  sleepHoursPerDay: { type: DataTypes.FLOAT },
  smokingStatus: { type: DataTypes.ENUM('Non-smoker', 'Occasional', 'Regular', 'Heavy') },
  alcoholConsumption: { type: DataTypes.ENUM('None', 'Social', 'Moderate', 'Regular') },
  dailyWaterIntake: { type: DataTypes.FLOAT },
  foodAllergies: { type: DataTypes.STRING },
  foodType: { type: DataTypes.ENUM('Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian') },
  income: { type: DataTypes.ENUM('Less than 4 LPA', '4-9 LPA', '9+ LPA') },
  pastInjury: { type: DataTypes.STRING },
  preferredGymTime: { type: DataTypes.ENUM('Early Morning (5-8 AM)', 'Morning (8-11 AM)', 'Afternoon (12-4 PM)', 'Evening (5-8 PM)', 'Night (8-11 PM)') }
}, { tableName: 'user_datas', timestamps: true });

Object.defineProperty(UserData.prototype, '_id', { get() { return this.id; } });
UserData.findById = (id) => UserData.findByPk(id);


// Centralized export block at the bottom of schema.js
export {
  Client,
  UserGymMapping,
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
  UserData,
  AdminUser
};
