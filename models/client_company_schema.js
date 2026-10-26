import { DataTypes } from 'sequelize';
import { sequelize } from '../database/db.js';

export const ClientCompanyMaster = sequelize.define('ClientCompanyMaster', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  mobile_no: {
    type: DataTypes.STRING(16),
    allowNull: true,
  },
  website: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  smtp_email: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  smtp_password: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  smtp_email_server: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  smtp_port: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  smtp_cc_email: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  enable_ssl: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  verify_ssl: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  cc_to_smtp_email: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  emailserver: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  pagesize: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  mailassignlimit: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  assigntimegap: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  acesstoken: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  sendmailmanualasiign: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  serverkey: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  senderkey: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  companylogo: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  backgroundImage: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'background_image',
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  created_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  modified_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  modified_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.SMALLINT,
    allowNull: true,
    defaultValue: 1,
  },
  check_on: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_valid: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  opt: {
    type: DataTypes.STRING(4),
    allowNull: true,
  },
  has_filter_conversation: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  auto_generate_password: {
    type: DataTypes.SMALLINT,
    defaultValue: 0,
  },
  admin_change_password: {
    type: DataTypes.SMALLINT,
    defaultValue: 0,
  },
  admin_reset_password: {
    type: DataTypes.SMALLINT,
    defaultValue: 0,
  },
  admin_reset_password_days: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  admin_previous_password_reused: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  admin_enable_otp: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  agent_change_password: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  agent_reset_password: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  agent_reset_password_days: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  agent_previous_password_reused: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  agent_enable_otp: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  otp_attempt_count: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  password_sms_api: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  sms_template: {
    type: DataTypes.STRING(250),
    allowNull: true,
  },
  auto_logout_session_time: {
    type: DataTypes.TIME,
    allowNull: true,
  },
  api_access_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  draft_time: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  date_difference: {
    type: DataTypes.STRING(50),
    defaultValue: '31',
  },
  allowSelfServicePortal: {
    type: DataTypes.SMALLINT,
    defaultValue: 0,
  },
  client_portal_domains: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  hide_captcha: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  bannerJson: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'client_company_master',
  timestamps: false,
});

