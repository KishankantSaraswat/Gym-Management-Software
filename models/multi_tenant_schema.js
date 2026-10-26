import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';

// 1. Gym Master (Tenant)
export const GymMaster = sequelize.define('GymMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymCode: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'gym_code' },
  gymName: { type: DataTypes.STRING(255), allowNull: false, field: 'gym_name' },
  legalName: { type: DataTypes.STRING(255), field: 'legal_name' },
  email: { type: DataTypes.STRING(255) },
  phone: { type: DataTypes.STRING(50) },
  logoUrl: { type: DataTypes.TEXT, field: 'logo_url' },
  ownerId: { type: DataTypes.INTEGER, allowNull: true, field: 'owner_id' },
  subscriptionPlanId: { type: DataTypes.INTEGER, field: 'subscription_plan_id' },
  status: { type: DataTypes.STRING(50), defaultValue: 'active' }
}, {
  tableName: 'gym_master',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 2. Gym Branch Master
export const GymBranchMaster = sequelize.define('GymBranchMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false, field: 'gym_id' },
  branchCode: { type: DataTypes.STRING(50), allowNull: false, field: 'branch_code' },
  branchName: { type: DataTypes.STRING(255), allowNull: false, field: 'branch_name' },
  address: { type: DataTypes.TEXT, allowNull: false },
  city: { type: DataTypes.STRING(100) },
  pincode: { type: DataTypes.STRING(20) },
  latitude: { type: DataTypes.DOUBLE },
  longitude: { type: DataTypes.DOUBLE },
  phone: { type: DataTypes.STRING(50) },
  contactEmail: { type: DataTypes.STRING(255), field: 'contact_email' },
  capacity: { type: DataTypes.INTEGER, defaultValue: 50 },
  openTime: { type: DataTypes.STRING(20), defaultValue: '06:00', field: 'open_time' },
  closeTime: { type: DataTypes.STRING(20), defaultValue: '22:00', field: 'close_time' },
  status: { type: DataTypes.STRING(50), defaultValue: 'active' }
}, {
  tableName: 'gym_branch_master',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 3. User <-> Gym Membership
export const GymUser = sequelize.define('GymUser', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  gymId: { type: DataTypes.INTEGER, allowNull: false, field: 'gym_id' },
  userType: { type: DataTypes.STRING(50), defaultValue: 'MEMBER', field: 'user_type' },
  status: { type: DataTypes.STRING(50), defaultValue: 'active' },
  joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'joined_at' }
}, {
  tableName: 'gym_user',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 4. User <-> Branch Access
export const GymBranchUser = sequelize.define('GymBranchUser', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false, field: 'gym_id' },
  branchId: { type: DataTypes.INTEGER, allowNull: false, field: 'branch_id' },
  gymUserId: { type: DataTypes.INTEGER, allowNull: false, field: 'gym_user_id' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  tableName: 'gym_branch_user',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 5. User Group Master (Roles)
export const UserGroupMaster = sequelize.define('UserGroupMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  groupCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'group_code' },
  groupName: { type: DataTypes.STRING(150), allowNull: false, field: 'group_name' },
  description: { type: DataTypes.TEXT },
  gymId: { type: DataTypes.INTEGER, allowNull: true, field: 'gym_id' },
  isSystem: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_system' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  tableName: 'user_group_master',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 6. Gym User Group Assignment
export const GymUserGroup = sequelize.define('GymUserGroup', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymUserId: { type: DataTypes.INTEGER, allowNull: false, field: 'gym_user_id' },
  groupId: { type: DataTypes.INTEGER, allowNull: false, field: 'group_id' },
  branchId: { type: DataTypes.INTEGER, allowNull: true, field: 'branch_id' },
  isPrimary: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_primary' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  tableName: 'gym_user_group',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 7. Permission Master
export const UserPermissionMaster = sequelize.define('UserPermissionMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  permissionCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'permission_code' },
  permissionName: { type: DataTypes.STRING(150), allowNull: false, field: 'permission_name' },
  description: { type: DataTypes.TEXT },
  module: { type: DataTypes.STRING(50), allowNull: false },
  action: { type: DataTypes.STRING(50), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  tableName: 'user_permission_master',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 8. Group Permission
export const UserGroupPermission = sequelize.define('UserGroupPermission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  groupId: { type: DataTypes.INTEGER, allowNull: false, field: 'group_id' },
  permissionId: { type: DataTypes.INTEGER, allowNull: false, field: 'permission_id' },
  canView: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'can_view' },
  canCreate: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_create' },
  canUpdate: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_update' },
  canDelete: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_delete' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  tableName: 'user_group_permission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 9. Gym Permission (Feature Permissions)
export const GymPermission = sequelize.define('GymPermission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  gymId: { type: DataTypes.INTEGER, allowNull: false, field: 'gym_id' },
  permissionId: { type: DataTypes.INTEGER, allowNull: false, field: 'permission_id' },
  isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_enabled' }
}, {
  tableName: 'gym_permission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 10. Subscription Plan
export const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  planCode: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'plan_code' },
  planName: { type: DataTypes.STRING(100), allowNull: false, field: 'plan_name' },
  description: { type: DataTypes.TEXT },
  price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
  billingCycle: { type: DataTypes.STRING(20), defaultValue: 'monthly', field: 'billing_cycle' },
  maxBranches: { type: DataTypes.INTEGER, defaultValue: 1, field: 'max_branches' },
  maxMembers: { type: DataTypes.INTEGER, defaultValue: 100, field: 'max_members' },
  features: { type: DataTypes.JSONB, defaultValue: {} },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  tableName: 'subscription_plan',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 11. Client Menu Master
export const ClientMenuMaster = sequelize.define('ClientMenuMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  parentId: { type: DataTypes.INTEGER, allowNull: true, field: 'parent_id' },
  menuCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'menu_code' },
  menuName: { type: DataTypes.STRING(100), allowNull: false, field: 'menu_name' },
  route: { type: DataTypes.STRING(255), allowNull: false },
  icon: { type: DataTypes.STRING(100) },
  menuType: { type: DataTypes.STRING(50), defaultValue: 'sidebar', field: 'menu_type' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  platform: { type: DataTypes.STRING(50), defaultValue: 'web' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' }
}, {
  tableName: 'client_menu_master',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 12. Client Menu Permission Mapping
export const ClientMenuPermission = sequelize.define('ClientMenuPermission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  menuId: { type: DataTypes.INTEGER, allowNull: false, field: 'menu_id' },
  permissionId: { type: DataTypes.INTEGER, allowNull: false, field: 'permission_id' }
}, {
  tableName: 'client_menu_permission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 13. User Session
export const UserSession = sequelize.define('UserSession', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sessionId: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'session_id' },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  gymId: { type: DataTypes.INTEGER, allowNull: true, field: 'gym_id' },
  branchId: { type: DataTypes.INTEGER, allowNull: true, field: 'branch_id' },
  deviceId: { type: DataTypes.STRING(255), field: 'device_id' },
  refreshTokenHash: { type: DataTypes.STRING(255), field: 'refresh_token_hash' },
  ipAddress: { type: DataTypes.STRING(50), field: 'ip_address' },
  userAgent: { type: DataTypes.TEXT, field: 'user_agent' },
  authzVersion: { type: DataTypes.INTEGER, defaultValue: 1, field: 'authz_version' },
  userType: { type: DataTypes.STRING(50), defaultValue: 'User', field: 'user_type' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' }
}, {
  tableName: 'user_session',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 14. Audit Log
export const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  actorUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'actor_user_id' },
  gymId: { type: DataTypes.INTEGER, allowNull: true, field: 'gym_id' },
  branchId: { type: DataTypes.INTEGER, allowNull: true, field: 'branch_id' },
  action: { type: DataTypes.STRING(100), allowNull: false },
  resourceType: { type: DataTypes.STRING(100), allowNull: false, field: 'resource_type' },
  resourceId: { type: DataTypes.STRING(100), field: 'resource_id' },
  oldValue: { type: DataTypes.JSONB, field: 'old_value' },
  newValue: { type: DataTypes.JSONB, field: 'new_value' },
  ipAddress: { type: DataTypes.STRING(50), field: 'ip_address' },
  userAgent: { type: DataTypes.TEXT, field: 'user_agent' }
}, {
  tableName: 'audit_log',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

