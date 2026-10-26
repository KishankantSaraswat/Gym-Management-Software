import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';

/**
 * Global Menu Master (global_menu_master)
 * Master catalog of all system pages and menu modules
 */
export const GlobalMenuMaster = sequelize.define('GlobalMenuMaster', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'parent_id',
    references: {
      model: 'global_menu_master',
      key: 'id',
    },
  },
  menuCode: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'menu_code',
  },
  menuName: {
    type: DataTypes.STRING(150),
    allowNull: false,
    field: 'menu_name',
  },
  menuLabel: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'menu_label',
  },
  route: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  menuType: {
    type: DataTypes.STRING(50),
    defaultValue: 'sidebar', // 'sidebar', 'header', 'hidden', 'tab'
    field: 'menu_type',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order',
  },
  platform: {
    type: DataTypes.STRING(50),
    defaultValue: 'web', // 'web', 'mobile', 'both'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  isClientMenu: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_client_menu',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  crUsr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'cr_usr',
  },
  mdUsr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'md_usr',
  },
}, {
  tableName: 'global_menu_master',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Self-referencing parent/child associations
GlobalMenuMaster.hasMany(GlobalMenuMaster, { foreignKey: 'parent_id', as: 'children' });
GlobalMenuMaster.belongsTo(GlobalMenuMaster, { foreignKey: 'parent_id', as: 'parent' });

