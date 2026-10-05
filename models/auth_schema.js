import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';

// User Group Master (e.g. Owner, Admin, Branch Manager)
export const UserGroupMaster = sequelize.define('UserGroupMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  clientId: { type: DataTypes.INTEGER, allowNull: true }, // null means SYSTEM group
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING },
  type: { type: DataTypes.ENUM('SYSTEM', 'CUSTOM'), defaultValue: 'CUSTOM' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
}, { tableName: 'user_group_master', timestamps: true });

// App Menu Master (e.g. Dashboard, Members, Attendance)
export const AppMenuMaster = sequelize.define('AppMenuMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  menuCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  menuName: { type: DataTypes.STRING, allowNull: false },
  menuLabel: { type: DataTypes.STRING },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
  menuIcon: { type: DataTypes.STRING },
  route: { type: DataTypes.STRING },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  appMenu: { type: DataTypes.BOOLEAN, defaultValue: false }, // false = web, true = mobile app
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'app_menu_master', timestamps: true });

// Client Menu Master
export const ClientMenuMaster = sequelize.define('ClientMenuMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  clientId: { type: DataTypes.INTEGER, allowNull: false },
  menuId: { type: DataTypes.INTEGER, allowNull: false },
  isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 } // Overrides default sorting if needed
}, { tableName: 'client_menu_master', timestamps: true });

// Permission Master (e.g. MEMBER_VIEW, MEMBER_CREATE)
export const PermissionMaster = sequelize.define('PermissionMaster', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  menuId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false, unique: true }, // e.g. MEMBER_VIEW
  description: { type: DataTypes.STRING }
}, { tableName: 'permission_master', timestamps: true });

// Group Permission Mapping
export const GroupPermission = sequelize.define('GroupPermission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  groupId: { type: DataTypes.INTEGER, allowNull: false },
  permissionId: { type: DataTypes.INTEGER, allowNull: false },
  branchId: { type: DataTypes.INTEGER, allowNull: true } // null means all branches
}, { tableName: 'group_permission', timestamps: true });

// User Permission Override
export const UserPermission = sequelize.define('UserPermission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  permissionId: { type: DataTypes.INTEGER, allowNull: false },
  branchId: { type: DataTypes.INTEGER, allowNull: true }, // null means all branches
  isAllowed: { type: DataTypes.BOOLEAN, defaultValue: true } // support override false
}, { tableName: 'user_permission', timestamps: true });
