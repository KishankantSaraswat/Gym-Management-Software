import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const AdminUser = sequelize.define('AdminUser', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  managerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'manager_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'group_id',
    references: {
      model: 'users_group_master',
      key: 'id'
    }
  },
  crUsr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'cr_usr',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  mdUsr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'md_usr',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  profile_picture: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_deleted'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  },
  resetPasswordToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'reset_password_token'
  },
  resetPasswordExpire: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reset_password_expire'
  },
  fcmToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'fcm_token'
  }
}, {
  tableName: 'admin_users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

AdminUser.prototype.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

AdminUser.prototype.generateToken = function (customPayload = {}) {
  const secret = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  return jwt.sign(
    {
      id: this.id,
      sub: String(this.id),
      group_id: this.groupId || this.group_id || null,
      isAdminUser: true,
      userType: 'AdminUser',
      ...customPayload
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    }
  );
};

Object.defineProperty(AdminUser.prototype, '_id', {
  get() {
    return this.id;
  }
});
