import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';

// 1. User Group Master
export const UserGroup = sequelize.define('UserGroup', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  group_name: { type: DataTypes.STRING(100) },
  status: { type: DataTypes.BOOLEAN, defaultValue: true },
  allow_ip: { type: DataTypes.STRING(255), defaultValue: "" },
  cr_usr: { type: DataTypes.INTEGER, allowNull: true, references: { model: "users", key: "id" } },
  md_usr: { type: DataTypes.INTEGER, allowNull: true, references: { model: "users", key: "id" } },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE },
}, {
  tableName: 'users_group_master',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 2. User Group Right (Group-level page rights)
export const UserGroupRight = sequelize.define('UserGroupRight', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  group_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: "users_group_master", key: "id" } },
  page_id: { type: DataTypes.INTEGER, allowNull: false },
  view_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  add_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  edit_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  excel_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  delete_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'users_group_rights',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 3. User Master Right (User-specific page right overrides)
export const UserMasterRight = sequelize.define('UserMasterRight', {
  user_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, references: { model: "users", key: "id" } },
  page_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  view_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  add_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  edit_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  excel_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  delete_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'users_master_rights',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// 4. User Branch Right (Branch level access)
export const UserBranchRight = sequelize.define('UserBranchRight', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: "users", key: "id" } },
  branch_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'user_branch_rights',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['branch_id'] },
    { fields: ['user_id', 'branch_id'], unique: true },
  ],
});

// 5. Company Master Right (Company-level page permissions)
export const CompanyMasterRight = sequelize.define('CompanyMasterRight', {
  company_id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    allowNull: false, 
    references: { model: "client_company_master", key: "id" } 
  },
  page_id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    allowNull: false,
    references: { model: "global_menu_master", key: "id" }
  },
  view_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  add_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  edit_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  excel_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  delete_right: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'company_master_rights',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

