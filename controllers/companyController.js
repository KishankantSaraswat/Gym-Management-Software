import { ClientCompanyMaster, Client, GymMaster, User, ClientCompanyUser, Gym } from '../models/index.js';
import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import sessionService from '../services/sessionService.js';
import { sequelize } from '../database/db.js';
import bcrypt from 'bcrypt';

/**
 * Add / Create a new Company
 * POST /api/v1/company or POST /company
 */
export const createCompany = catchAsyncErrors(async (req, res, next) => {
  const {
    client_id,
    name,
    email,
    mobile_no,
    website,
    address,
    smtp_email,
    smtp_password,
    smtp_email_server,
    smtp_port,
    smtp_cc_email,
    enable_ssl,
    verify_ssl,
    cc_to_smtp_email,
    emailserver,
    pagesize,
    mailassignlimit,
    assigntimegap,
    acesstoken,
    sendmailmanualasiign,
    serverkey,
    senderkey,
    companylogo,
    backgroundImage,
    background_image,
    status = 1,
    message,
    is_valid,
    opt,
    has_filter_conversation,
    auto_generate_password = 0,
    admin_change_password = 0,
    admin_reset_password = 0,
    admin_reset_password_days,
    admin_previous_password_reused,
    admin_enable_otp,
    agent_change_password,
    agent_reset_password,
    agent_reset_password_days,
    agent_previous_password_reused,
    agent_enable_otp,
    otp_attempt_count,
    password_sms_api,
    sms_template,
    auto_logout_session_time,
    api_access_token,
    draft_time,
    date_difference = '31',
    allowSelfServicePortal = 0,
    client_portal_domains,
    hide_captcha,
    bannerJson,
    // Master user details provided with company creation
    userName,
    username,
    userLoginId,
    login_id,
    userEmail,
    userPassword,
    password,
    userPhone,
    phone
  } = req.body;

  if (!name) {
    return next(new ErrorHandler("Company name is required.", 400));
  }

  const created_by = req.user?.email || req.user?.name || req.body.created_by || 'admin';
  const created_date = new Date();

  // Create Company in transaction
  const result = await sequelize.transaction(async (t) => {
    const company = await ClientCompanyMaster.create({
      client_id: client_id || null,
      name: name.trim(),
      email: email ? email.trim() : null,
      mobile_no: mobile_no || null,
      website: website || null,
      address: address || null,
      smtp_email: smtp_email || null,
      smtp_password: smtp_password || null,
      smtp_email_server: smtp_email_server || null,
      smtp_port: smtp_port || null,
      smtp_cc_email: smtp_cc_email || null,
      enable_ssl: enable_ssl !== undefined ? enable_ssl : null,
      verify_ssl: verify_ssl !== undefined ? verify_ssl : null,
      cc_to_smtp_email: cc_to_smtp_email !== undefined ? cc_to_smtp_email : null,
      emailserver: emailserver || null,
      pagesize: pagesize || null,
      mailassignlimit: mailassignlimit || null,
      assigntimegap: assigntimegap || null,
      acesstoken: acesstoken || null,
      sendmailmanualasiign: sendmailmanualasiign !== undefined ? sendmailmanualasiign : null,
      serverkey: serverkey || null,
      senderkey: senderkey || null,
      companylogo: companylogo || null,
      backgroundImage: backgroundImage || background_image || null,
      created_by,
      created_date,
      status: status !== undefined ? status : 1,
      message: message || null,
      is_valid: is_valid !== undefined ? is_valid : null,
      opt: opt || null,
      has_filter_conversation: has_filter_conversation !== undefined ? has_filter_conversation : null,
      auto_generate_password,
      admin_change_password,
      admin_reset_password,
      admin_reset_password_days: admin_reset_password_days || null,
      admin_previous_password_reused: admin_previous_password_reused !== undefined ? admin_previous_password_reused : null,
      admin_enable_otp: admin_enable_otp !== undefined ? admin_enable_otp : null,
      agent_change_password: agent_change_password !== undefined ? agent_change_password : null,
      agent_reset_password: agent_reset_password !== undefined ? agent_reset_password : null,
      agent_reset_password_days: agent_reset_password_days || null,
      agent_previous_password_reused: agent_previous_password_reused !== undefined ? agent_previous_password_reused : null,
      agent_enable_otp: agent_enable_otp !== undefined ? agent_enable_otp : null,
      otp_attempt_count: otp_attempt_count || null,
      password_sms_api: password_sms_api || null,
      sms_template: sms_template || null,
      auto_logout_session_time: auto_logout_session_time || null,
      api_access_token: api_access_token || null,
      draft_time: draft_time || null,
      date_difference: date_difference || '31',
      allowSelfServicePortal,
      client_portal_domains: client_portal_domains || null,
      hide_captcha: hide_captcha !== undefined ? hide_captcha : null,
      bannerJson: bannerJson || null
    }, { transaction: t });

    // Auto-create company's first master user
    const resolvedEmail = (userEmail || email || '').trim().toLowerCase() || `admin@company${company.id}.com`;
    const resolvedPassword = password || userPassword || 'Company@123';
    const resolvedName = (userName || name || 'Company Admin').trim();
    const resolvedLoginId = (login_id || userLoginId || resolvedEmail).trim();
    const resolvedUsername = (username || resolvedEmail.split('@')[0]).trim();
    const resolvedPhone = phone || userPhone || mobile_no || null;

    let masterUser = null;
    const existingUser = await ClientCompanyUser.findOne({
      where: { email: resolvedEmail },
      transaction: t
    });

    if (!existingUser) {
      masterUser = await ClientCompanyUser.create({
        companyId: company.id,
        groupId: null,
        managerId: null,
        name: resolvedName,
        username: resolvedUsername,
        loginId: resolvedLoginId,
        email: resolvedEmail,
        password: resolvedPassword,
        phone: resolvedPhone,
        isCompanyOwner: true,
        status: true,
        isActive: true,
        crUsr: req.user?.id || null
      }, { transaction: t });
    }

    // Auto-create/sync Gym facility record for this Company (Company = Gym)
    const existingGym = await Gym.findByPk(company.id, { transaction: t });
    if (!existingGym) {
      await Gym.create({
        id: company.id,
        name: company.name,
        contactEmail: company.email || resolvedEmail,
        phone: company.mobile_no || resolvedPhone || '9999999999',
        address: company.address || 'Main Branch',
        latitude: 28.6139,
        longitude: 77.2090,
        capacity: 100,
        openTime: '06:00',
        closeTime: '22:00',
        ownerId: masterUser ? masterUser.id : 1,
        clientId: null,
        isVerified: true,
        subscriptionStatus: 'active',
        status: 'open'
      }, { transaction: t });
    }

    return { company, masterUser };
  });

  const responseData = {
    success: true,
    message: "Company and master user created successfully.",
    company: result.company,
  };

  if (result.masterUser) {
    const userJson = result.masterUser.toJSON();
    delete userJson.password;
    responseData.masterUser = userJson;
  }

  res.status(201).json(responseData);
});

/**
 * Get all Companies
 * GET /api/v1/company or GET /company
 */
export const getAllCompanies = catchAsyncErrors(async (req, res, next) => {
  const { client_id, status } = req.query;
  const where = {};

  if (client_id) where.client_id = client_id;
  if (status !== undefined) where.status = status;

  const companies = await ClientCompanyMaster.findAll({
    where,
    order: [['id', 'DESC']]
  });

  res.status(200).json({
    success: true,
    count: companies.length,
    companies
  });
});

/**
 * Get Company By ID
 * GET /api/v1/company/:id
 */
export const getCompanyById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const company = await ClientCompanyMaster.findByPk(id);

  if (!company) {
    return next(new ErrorHandler(`Company with ID ${id} not found.`, 404));
  }

  res.status(200).json({
    success: true,
    company
  });
});

/**
 * Update Company Details
 * PUT /api/v1/company/:id
 */
export const updateCompany = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const company = await ClientCompanyMaster.findByPk(id);

  if (!company) {
    return next(new ErrorHandler(`Company with ID ${id} not found.`, 404));
  }

  const modified_by = req.user?.email || req.user?.name || req.body.modified_by || 'admin';
  const modified_date = new Date();

  await company.update({
    ...req.body,
    modified_by,
    modified_date
  });

  res.status(200).json({
    success: true,
    message: "Company updated successfully.",
    company
  });
});

/**
 * Delete Company
 * DELETE /api/v1/company/:id
 */
export const deleteCompany = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const company = await ClientCompanyMaster.findByPk(id);

  if (!company) {
    return next(new ErrorHandler(`Company with ID ${id} not found.`, 404));
  }

  await company.destroy();

  res.status(200).json({
    success: true,
    message: "Company deleted successfully."
  });
});

/**
 * Company Partner / GymOwner Login API
 * POST /api/v1/company/login or POST /company/login
 * Body: { email, password, gymId, branchId }
 */
export const companyLogin = catchAsyncErrors(async (req, res, next) => {
  const { email, password, gymId, branchId } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Please enter company email and password.", 400));
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Locate company record
  const company = await ClientCompanyMaster.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      normalizedEmail
    )
  });

  if (!company) {
    return next(new ErrorHandler("No company found registered with this email.", 404));
  }

  // 2. Resolve linked gym partner / GymOwner user
  let partnerUser = null;

  if (company.client_id) {
    const client = await Client.findByPk(company.client_id);
    if (client && client.ownerId) {
      partnerUser = await User.findByPk(client.ownerId);
    }
    if (!partnerUser) {
      const gymMaster = await GymMaster.findByPk(company.client_id);
      if (gymMaster && gymMaster.ownerId) {
        partnerUser = await User.findByPk(gymMaster.ownerId);
      }
    }
    if (!partnerUser) {
      const directUser = await User.findByPk(company.client_id);
      if (directUser) {
        partnerUser = directUser;
      }
    }
  }

  if (!partnerUser) {
    partnerUser = await User.findOne({
      where: {
        email: normalizedEmail,
        role: 'GymOwner'
      }
    });
  }

  if (!partnerUser) {
    partnerUser = await User.findOne({
      where: { email: normalizedEmail }
    });
  }

  if (!partnerUser) {
    return next(new ErrorHandler("No gym partner or owner account is associated with this company.", 404));
  }

  // 3. Verify password
  const isMatch = await partnerUser.comparePassword(password);
  if (!isMatch) {
    return next(new ErrorHandler("Invalid email or password.", 401));
  }

  // Active Session Detection
  const hasActive = await sessionService.hasActiveSession(partnerUser.id, 'User');
  const userConsent = req.body.consent === true || req.body.consent === 'true';

  if (hasActive && !userConsent) {
    return res.status(409).json({
      success: false,
      code: "SESSION_ACTIVE",
      requireConsent: true,
      require_consent: true,
      isAlreadyLoggedIn: true,
      message: "You are already logged in on another browser or device. Do you want to log in here?"
    });
  }

  if (hasActive) {
    await sessionService.revokeAllUserSessions(partnerUser.id, 'User');
  }

  // 4. Ensure partner role is GymOwner
  if (partnerUser.role !== 'GymOwner') {
    partnerUser.role = 'GymOwner';
    await partnerUser.save();
  }

  // 5. Create GymOwner session with warm Redis context
  const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || '7', 10);
  const { token, sessionId } = await sessionService.createSession({
    user: partnerUser,
    userType: 'User',
    gymId: gymId || null,
    branchId: branchId || null,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    expiresInDays: cookieExpireDays
  });

  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  const userData = partnerUser.toJSON ? partnerUser.toJSON() : { ...partnerUser };
  delete userData.password;
  delete userData.tempPassword;
  delete userData.resetPasswordToken;
  delete userData.verificationCode;

  res.status(200)
    .cookie("gymshood_token", token, cookieOptions)
    .json({
      success: true,
      message: "Gym partner logged in successfully via company email.",
      role: "GymOwner",
      token,
      session_id: sessionId,
      user: userData,
      company
    });
});

