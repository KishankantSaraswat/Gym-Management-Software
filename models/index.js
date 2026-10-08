import {
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
  UserData
} from './schema.js';

import {
  GymMaster,
  GymBranchMaster,
  GymUser,
  GymBranchUser,
  UserGroupMaster,
  GymUserGroup,
  UserPermissionMaster,
  UserGroupPermission,
  GymPermission,
  SubscriptionPlan,
  ClientMenuMaster,
  ClientMenuPermission,
  UserSession,
  AuditLog
} from './multi_tenant_schema.js';

export function setupAssociations() {
  // =========================================================================
  // 1. MULTI-TENANT SAAS & RBAC ASSOCIATIONS
  // =========================================================================

  // GymMaster (Tenant) <-> User (Owner)
  User.hasMany(GymMaster, { foreignKey: 'owner_id', as: 'ownedTenants' });
  GymMaster.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

  // GymMaster <-> GymBranchMaster (Branches)
  GymMaster.hasMany(GymBranchMaster, { foreignKey: 'gym_id', as: 'branches' });
  GymBranchMaster.belongsTo(GymMaster, { foreignKey: 'gym_id', as: 'tenant' });

  // User <-> GymMaster (via GymUser)
  User.hasMany(GymUser, { foreignKey: 'user_id', as: 'tenantMemberships' });
  GymUser.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  GymMaster.hasMany(GymUser, { foreignKey: 'gym_id', as: 'members' });
  GymUser.belongsTo(GymMaster, { foreignKey: 'gym_id', as: 'gym' });

  // GymUser <-> GymBranchMaster (via GymBranchUser)
  GymUser.hasMany(GymBranchUser, { foreignKey: 'gym_user_id', as: 'branchAccessList' });
  GymBranchUser.belongsTo(GymUser, { foreignKey: 'gym_user_id', as: 'gymUser' });
  GymBranchMaster.hasMany(GymBranchUser, { foreignKey: 'branch_id', as: 'assignedUsers' });
  GymBranchUser.belongsTo(GymBranchMaster, { foreignKey: 'branch_id', as: 'branch' });

  // GymUser <-> UserGroupMaster (via GymUserGroup)
  GymUser.hasMany(GymUserGroup, { foreignKey: 'gym_user_id', as: 'roles' });
  GymUserGroup.belongsTo(GymUser, { foreignKey: 'gym_user_id', as: 'gymUser' });
  UserGroupMaster.hasMany(GymUserGroup, { foreignKey: 'group_id', as: 'assignedGymUsers' });
  GymUserGroup.belongsTo(UserGroupMaster, { foreignKey: 'group_id', as: 'group' });

  // UserGroupMaster <-> UserPermissionMaster (via UserGroupPermission)
  UserGroupMaster.hasMany(UserGroupPermission, { foreignKey: 'group_id', as: 'permissions' });
  UserGroupPermission.belongsTo(UserGroupMaster, { foreignKey: 'group_id', as: 'group' });
  UserPermissionMaster.hasMany(UserGroupPermission, { foreignKey: 'permission_id', as: 'groupMappings' });
  UserGroupPermission.belongsTo(UserPermissionMaster, { foreignKey: 'permission_id', as: 'permission' });

  // GymMaster <-> UserPermissionMaster (via GymPermission Feature Flags)
  GymMaster.hasMany(GymPermission, { foreignKey: 'gym_id', as: 'featurePermissions' });
  GymPermission.belongsTo(GymMaster, { foreignKey: 'gym_id', as: 'gym' });
  UserPermissionMaster.hasMany(GymPermission, { foreignKey: 'permission_id', as: 'gymFeatureMappings' });
  GymPermission.belongsTo(UserPermissionMaster, { foreignKey: 'permission_id', as: 'permission' });

  // ClientMenuMaster <-> UserPermissionMaster (via ClientMenuPermission)
  ClientMenuMaster.hasMany(ClientMenuPermission, { foreignKey: 'menu_id', as: 'menuPermissions' });
  ClientMenuPermission.belongsTo(ClientMenuMaster, { foreignKey: 'menu_id', as: 'menu' });
  UserPermissionMaster.hasMany(ClientMenuPermission, { foreignKey: 'permission_id', as: 'menuMappings' });
  ClientMenuPermission.belongsTo(UserPermissionMaster, { foreignKey: 'permission_id', as: 'permission' });

  // Self-referencing menu tree
  ClientMenuMaster.hasMany(ClientMenuMaster, { foreignKey: 'parent_id', as: 'children' });
  ClientMenuMaster.belongsTo(ClientMenuMaster, { foreignKey: 'parent_id', as: 'parent' });

  // GymMaster <-> SubscriptionPlan
  GymMaster.belongsTo(SubscriptionPlan, { foreignKey: 'subscription_plan_id', as: 'subscriptionPlan' });
  SubscriptionPlan.hasMany(GymMaster, { foreignKey: 'subscription_plan_id', as: 'gyms' });

  // User <-> UserSession
  User.hasMany(UserSession, { foreignKey: 'user_id', as: 'sessions' });
  UserSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // GymMaster <-> AuditLog
  GymMaster.hasMany(AuditLog, { foreignKey: 'gym_id', as: 'auditLogs' });
  AuditLog.belongsTo(GymMaster, { foreignKey: 'gym_id', as: 'gym' });

  // =========================================================================
  // 2. LEGACY / BACKWARD-COMPATIBLE ASSOCIATIONS
  // =========================================================================

  // 1A. Client & User (Owner)
  User.hasMany(Client, { foreignKey: 'ownerId', as: 'ownedClients' });
  Client.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

  // 1B. Client & Gym (Branch)
  Client.hasMany(Gym, { foreignKey: 'clientId', as: 'branches' });
  Gym.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

  // 1C. User Branch Mapping
  User.hasMany(UserGymMapping, { foreignKey: 'userId', as: 'branchMappings' });
  UserGymMapping.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Gym.hasMany(UserGymMapping, { foreignKey: 'gymId', as: 'userMappings' });
  UserGymMapping.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });

  // 1. User & Gym
  User.hasMany(Gym, { foreignKey: 'ownerId', as: 'gyms' });
  Gym.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

  // 2. Gym & VerificationDocument
  Gym.hasOne(VerificationDocument, { foreignKey: 'gymId', as: 'verificationDocument' });
  VerificationDocument.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });

  // 3. Gym & GymMedia
  Gym.hasOne(GymMedia, { foreignKey: 'gymId', as: 'media' });
  GymMedia.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });

  // 4. Gym & Plan
  Gym.hasMany(Plan, { foreignKey: 'gymId', as: 'plans' });
  Plan.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });

  // 5. GymPlanRevenue & Plan / Gym
  Plan.hasMany(GymPlanRevenue, { foreignKey: 'planId', as: 'planRevenues' });
  GymPlanRevenue.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });
  Gym.hasMany(GymPlanRevenue, { foreignKey: 'gymId', as: 'gymRevenues' });
  GymPlanRevenue.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });

  // 6. User & UserGymLog
  User.hasMany(UserGymLog, { foreignKey: 'userId', as: 'gymLogs' });
  UserGymLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // 7. Gym & GymDailyStats
  Gym.hasMany(GymDailyStats, { foreignKey: 'gymId', as: 'dailyStats' });
  GymDailyStats.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });

  // 8. GymRating & User / Gym
  User.hasMany(GymRating, { foreignKey: 'userId', as: 'ratings' });
  GymRating.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Gym.hasMany(GymRating, { foreignKey: 'gymId', as: 'ratings' });
  GymRating.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });

  // 9. User & ProgressTracker
  User.hasMany(ProgressTracker, { foreignKey: 'userId', as: 'progressTrackers' });
  ProgressTracker.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // 10. User & WalletTransaction
  User.hasMany(WalletTransaction, { foreignKey: 'userId', as: 'walletTransactions' });
  WalletTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // 11. UserPlan & User / Gym / Plan
  User.hasMany(UserPlan, { foreignKey: 'userId', as: 'userPlans' });
  UserPlan.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Gym.hasMany(UserPlan, { foreignKey: 'gymId', as: 'userPlans' });
  UserPlan.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });
  Plan.hasMany(UserPlan, { foreignKey: 'planId', as: 'userPlans' });
  UserPlan.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });

  // 12. User & UserFitnessProfile
  User.hasOne(UserFitnessProfile, { foreignKey: 'userId', as: 'fitnessProfile' });
  UserFitnessProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // 13. SettlementRequest & Gym / Owner (User)
  Gym.hasMany(SettlementRequest, { foreignKey: 'gymId', as: 'settlementRequests' });
  SettlementRequest.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });
  User.hasMany(SettlementRequest, { foreignKey: 'ownerId', as: 'settlementRequests' });
  SettlementRequest.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

  // 14. AdminAction & Gym / Admin (User)
  Gym.hasMany(AdminAction, { foreignKey: 'gymId', as: 'adminActions' });
  AdminAction.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });
  User.hasMany(AdminAction, { foreignKey: 'performedBy', as: 'performedAdminActions' });
  AdminAction.belongsTo(User, { foreignKey: 'performedBy', as: 'performedByAdmin' });

  // 15. GymAnnouncement & Gym / User
  Gym.hasMany(GymAnnouncement, { foreignKey: 'gymId', as: 'announcements' });
  GymAnnouncement.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });
  User.hasMany(GymAnnouncement, { foreignKey: 'createdBy', as: 'gymAnnouncements' });
  GymAnnouncement.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

  // 15b. Announcement & User
  User.hasMany(Announcement, { foreignKey: 'createdBy', as: 'announcements' });
  Announcement.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

  // 15c. Gym & AdminPlan (assigned plan)
  Gym.belongsTo(AdminPlan, { foreignKey: 'assignedPlanId', as: 'assignedPlan' });
  AdminPlan.hasMany(Gym, { foreignKey: 'assignedPlanId', as: 'assignedGyms' });

  // 16. AdminPlan & GymSubscription / Gym
  AdminPlan.hasMany(GymSubscription, { foreignKey: 'adminPlanId', as: 'subscriptions' });
  GymSubscription.belongsTo(AdminPlan, { foreignKey: 'adminPlanId', as: 'adminPlan' });
  Gym.hasMany(GymSubscription, { foreignKey: 'gymId', as: 'subscriptions' });
  GymSubscription.belongsTo(Gym, { foreignKey: 'gymId', as: 'gym' });

  // 17. User & UserData
  User.hasOne(UserData, { foreignKey: 'userId', as: 'userData' });
  UserData.belongsTo(User, { foreignKey: 'userId', as: 'user' });
}

// Execute associations setup immediately
setupAssociations();

// Export models
export {
  // Target Multi-Tenant Entities
  GymMaster,
  GymBranchMaster,
  GymUser,
  GymBranchUser,
  UserGroupMaster,
  GymUserGroup,
  UserPermissionMaster,
  UserGroupPermission,
  GymPermission,
  SubscriptionPlan,
  ClientMenuMaster,
  ClientMenuPermission,
  UserSession,
  AuditLog,

  // Legacy entities for complete compatibility
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
  UserData
};
