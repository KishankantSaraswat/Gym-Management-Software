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
  UserGroupMaster,
  AppMenuMaster,
  ClientMenuMaster,
  PermissionMaster,
  GroupPermission,
  UserPermission
} from './auth_schema.js';

export function setupAssociations() {
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

  // 1D. Auth / Permissions
  Client.hasMany(UserGroupMaster, { foreignKey: 'clientId', as: 'userGroups' });
  UserGroupMaster.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
  
  AppMenuMaster.hasMany(PermissionMaster, { foreignKey: 'menuId', as: 'permissions' });
  PermissionMaster.belongsTo(AppMenuMaster, { foreignKey: 'menuId', as: 'menu' });

  AppMenuMaster.hasMany(ClientMenuMaster, { foreignKey: 'menuId', as: 'clientMenus' });
  ClientMenuMaster.belongsTo(AppMenuMaster, { foreignKey: 'menuId', as: 'menu' });
  
  Client.hasMany(ClientMenuMaster, { foreignKey: 'clientId', as: 'menus' });
  ClientMenuMaster.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
  
  UserGroupMaster.hasMany(GroupPermission, { foreignKey: 'groupId', as: 'permissions' });
  GroupPermission.belongsTo(UserGroupMaster, { foreignKey: 'groupId', as: 'group' });
  
  PermissionMaster.hasMany(GroupPermission, { foreignKey: 'permissionId', as: 'groupMappings' });
  GroupPermission.belongsTo(PermissionMaster, { foreignKey: 'permissionId', as: 'permission' });
  
  User.hasMany(UserPermission, { foreignKey: 'userId', as: 'userPermissions' });
  UserPermission.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  
  PermissionMaster.hasMany(UserPermission, { foreignKey: 'permissionId', as: 'userMappings' });
  UserPermission.belongsTo(PermissionMaster, { foreignKey: 'permissionId', as: 'permission' });

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

// Execute associations setup immediately when index file is loaded
setupAssociations();

// Export standard model accessors & index entry point
export {
  Client,
  UserGymMapping,
  UserGroupMaster,
  AppMenuMaster,
  ClientMenuMaster,
  PermissionMaster,
  GroupPermission,
  UserPermission,
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
