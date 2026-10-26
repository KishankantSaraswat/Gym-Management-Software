import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// 1. admin_company
export const AdminCompany = sequelize.define('AdminCompany', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'admin_company',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// 2. admin_user_group
export const AdminUserGroup = sequelize.define('AdminUserGroup', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  adminCompanyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'admin_company_id',
    references: {
      model: 'admin_company',
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
  tableName: 'admin_user_group',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// 3. admin_user
export const AdminUserHierarchical = sequelize.define('AdminUserHierarchical', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  adminCompanyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'admin_company_id',
    references: {
      model: 'admin_company',
      key: 'id',
    },
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'group_id',
    references: {
      model: 'admin_user_group',
      key: 'id',
    },
  },
  managerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'manager_id',
    references: {
      model: 'admin_user',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
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
  isSuperAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_super_admin',
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
  tableName: 'admin_user',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password && !admin.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(admin.password, salt);
      }
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password') && !admin.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(admin.password, salt);
      }
    },
  },
});

// Methods on AdminUserHierarchical
AdminUserHierarchical.prototype.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

AdminUserHierarchical.prototype.generateToken = function () {
  const secret = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  return jwt.sign(
    {
      id: this.id,
      email: this.email,
      isAdmin: true,
      isSuperAdmin: this.isSuperAdmin,
      adminCompanyId: this.adminCompanyId,
      groupId: this.groupId,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );
};

// 4. admin_user_group_permission
export const AdminUserGroupPermission = sequelize.define('AdminUserGroupPermission', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'group_id',
    references: {
      model: 'admin_user_group',
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
  tableName: 'admin_user_group_permission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// 5. admin_user_permission
export const AdminUserPermission = sequelize.define('AdminUserPermission', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'admin_user',
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
  tableName: 'admin_user_permission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

