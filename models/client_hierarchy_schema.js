import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { ClientCompanyMaster } from './client_company_schema.js';

// 1. ClientCompanyMaster_User_group (client_company_user_group)
export const ClientCompanyUserGroup = sequelize.define('ClientCompanyUserGroup', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'company_id',
    references: {
      model: 'client_company_master',
      key: 'id',
    },
  },
  group_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  allow_ip: {
    type: DataTypes.STRING(255),
    defaultValue: '',
  },
  cr_usr: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  md_usr: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'client_company_user_group',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// 2. ClientCompanyMaster_User (client_company_user)
export const ClientCompanyUser = sequelize.define('ClientCompanyUser', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'company_id',
    references: {
      model: 'client_company_master',
      key: 'id',
    },
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'group_id',
    references: {
      model: 'client_company_user_group',
      key: 'id',
    },
  },
  managerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'manager_id',
    references: {
      model: 'client_company_user',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  loginId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'login_id',
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  isCompanyOwner: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_company_owner',
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
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
  tableName: 'client_company_user',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
  },
});

ClientCompanyUser.prototype.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

ClientCompanyUser.prototype.generateToken = function () {
  const secret = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  return jwt.sign(
    {
      id: this.id,
      email: this.email,
      companyId: this.companyId,
      groupId: this.groupId,
      isCompanyOwner: this.isCompanyOwner,
      userType: 'ClientCompanyUser',
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );
};

// 3. ClientCompanyMaster_user_group_permission (client_company_user_group_permission)
export const ClientCompanyUserGroupPermission = sequelize.define('ClientCompanyUserGroupPermission', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'company_id',
    references: {
      model: 'client_company_master',
      key: 'id',
    },
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'group_id',
    references: {
      model: 'client_company_user_group',
      key: 'id',
    },
  },
  pageId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'page_id',
  },
  viewRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'view_right',
  },
  addRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'add_right',
  },
  editRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'edit_right',
  },
  excelRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'excel_right',
  },
  deleteRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'delete_right',
  },
}, {
  tableName: 'client_company_user_group_permission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// 4. ClientCompanyMaster_user_permisison (client_company_user_permission)
export const ClientCompanyUserPermission = sequelize.define('ClientCompanyUserPermission', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'company_id',
    references: {
      model: 'client_company_master',
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'client_company_user',
      key: 'id',
    },
  },
  pageId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'page_id',
  },
  viewRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'view_right',
  },
  addRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'add_right',
  },
  editRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'edit_right',
  },
  excelRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'excel_right',
  },
  deleteRight: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'delete_right',
  },
}, {
  tableName: 'client_company_user_permission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

