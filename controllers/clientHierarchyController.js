import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import {
  ClientCompanyMaster,
  ClientCompanyUser,
  ClientCompanyUserGroup,
  ClientCompanyUserPermission,
  ClientCompanyUserGroupPermission,
  CompanyMasterRight,
  GlobalMenuMaster
} from '../models/index.js';
import { sequelize } from '../database/db.js';
import { Op } from 'sequelize';
import sessionService from '../services/sessionService.js';

/**
 * Helper to build authorized menus tree and permissions for a client user
 */
export const resolveClientUserMenus = async (user, company) => {
  // 1. Fetch Company Master Rights (base company permissions)
  const companyRights = await CompanyMasterRight.findAll({
    where: { company_id: user.companyId },
    raw: true
  });
  const companyRightsMap = new Map();
  companyRights.forEach(cr => companyRightsMap.set(cr.page_id, cr));

  // 2. Fetch Group Permissions
  let groupPermissions = [];
  if (user.groupId) {
    groupPermissions = await ClientCompanyUserGroupPermission.findAll({
      where: { groupId: user.groupId, companyId: user.companyId },
      raw: true
    });
  }
  const groupRightsMap = new Map();
  groupPermissions.forEach(p => groupRightsMap.set(p.page_id || p.pageId, p));

  // 3. Fetch User Specific Overrides
  const userPermissions = await ClientCompanyUserPermission.findAll({
    where: { userId: user.id, companyId: user.companyId },
    raw: true
  });
  const userRightsMap = new Map();
  userPermissions.forEach(p => userRightsMap.set(p.page_id || p.pageId, p));

  // 4. Fetch All Active Menus (is_active: true)
  const allMenus = await GlobalMenuMaster.findAll({
    where: { isActive: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  // 5. Compute Effective Rights and Filter Menus
  const authorizedMenus = [];
  const effectiveRights = [];

  allMenus.forEach(m => {
    const cr = companyRightsMap.get(m.id);
    const gr = groupRightsMap.get(m.id);
    const ur = userRightsMap.get(m.id);

    // If company has configured rights, company must allow view_right first (unless user is owner and no company rights configured)
    const companyAllowed = companyRights.length === 0 || (cr && Boolean(cr.view_right));

    let canView = false;
    let canAdd = false;
    let canEdit = false;
    let canExcel = false;
    let canDelete = false;

    if (user.isCompanyOwner) {
      // Company Owner gets all allowed company rights, or full rights if company rights not set
      canView = companyAllowed;
      canAdd = companyAllowed;
      canEdit = companyAllowed;
      canExcel = companyAllowed;
      canDelete = companyAllowed;
    } else {
      // Regular staff resolves user override -> group right
      canView = ur ? Boolean(ur.viewRight ?? ur.view_right) : (gr ? Boolean(gr.viewRight ?? gr.view_right) : false);
      canAdd = ur ? Boolean(ur.addRight ?? ur.add_right) : (gr ? Boolean(gr.addRight ?? gr.add_right) : false);
      canEdit = ur ? Boolean(ur.editRight ?? ur.edit_right) : (gr ? Boolean(gr.editRight ?? gr.edit_right) : false);
      canExcel = ur ? Boolean(ur.excelRight ?? ur.excel_right) : (gr ? Boolean(gr.excelRight ?? gr.excel_right) : false);
      canDelete = ur ? Boolean(ur.deleteRight ?? ur.delete_right) : (gr ? Boolean(gr.deleteRight ?? gr.delete_right) : false);

      // Bound by company rights if company permissions exist
      if (companyRights.length > 0) {
        canView = canView && Boolean(cr?.view_right);
        canAdd = canAdd && Boolean(cr?.add_right);
        canEdit = canEdit && Boolean(cr?.edit_right);
        canExcel = canExcel && Boolean(cr?.excel_right);
        canDelete = canDelete && Boolean(cr?.delete_right);
      }
    }

    const rightsObj = {
      pageId: m.id,
      menuCode: m.menuCode,
      viewRight: canView,
      addRight: canAdd,
      editRight: canEdit,
      excelRight: canExcel,
      deleteRight: canDelete
    };
    effectiveRights.push(rightsObj);

    if (canView) {
      authorizedMenus.push({
        id: m.id,
        parentId: m.parentId,
        menuCode: m.menuCode,
        menuName: m.menuName,
        menuLabel: m.menuLabel || m.menuName,
        route: m.route,
        icon: m.icon,
        menuType: m.menuType,
        sortOrder: m.sortOrder,
        rights: rightsObj
      });
    }
  });

  // 6. Build Nested Tree for sidebar
  const menuMap = new Map();
  const tree = [];

  authorizedMenus.forEach(m => {
    menuMap.set(m.id, { ...m, children: [] });
  });

  menuMap.forEach(item => {
    if (item.parentId && menuMap.has(item.parentId)) {
      menuMap.get(item.parentId).children.push(item);
    } else {
      tree.push(item);
    }
  });

  return { authorizedMenus: tree, effectiveRights };
};

/**
 * 1. Client Company User Login
 * POST /api/v1/client-company/login or POST /client/login
 */
export const clientCompanyUserLogin = catchAsyncErrors(async (req, res, next) => {
  const { email, login_id, username, password } = req.body;

  
  const identifier = (email || login_id || username || '').trim();
  if (!identifier || !password) {
    return next(new ErrorHandler("Please enter email/login ID and password.", 400));
  }

  // Find user by email, loginId, or username
  const user = await ClientCompanyUser.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      identifier.toLowerCase()
    )
  }) || await ClientCompanyUser.findOne({
    where: {
      [sequelize.Op.or]: [
        { loginId: identifier },
        { username: identifier }
      ]
    }
  });

  if (!user) {
    return next(new ErrorHandler("Invalid login credentials.", 401));
  }

  if (!user.status || (user.isActive !== undefined && !user.isActive)) {
    return next(new ErrorHandler("Your account has been deactivated. Contact company administrator.", 403));
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return next(new ErrorHandler("Invalid login credentials.", 401));
  }

  // Active Session Detection
  const hasActive = await sessionService.hasActiveSession(user.id, 'ClientCompanyUser');
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

  // Invalidate previous active sessions if consent was granted or replaced
  if (hasActive) {
    await sessionService.revokeAllUserSessions(user.id, 'ClientCompanyUser');
  }

  // Create new active session and token
  const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || '7', 10);
  const { token, sessionId } = await sessionService.createSession({
    user,
    userType: 'ClientCompanyUser',
    gymId: user.companyId || null,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    expiresInDays: cookieExpireDays
  });

  // Fetch Full Company Details (including logo, backgroundImage, contact, policies)
  const company = await ClientCompanyMaster.findByPk(user.companyId);

  // Fetch User Group
  let userGroup = null;
  if (user.groupId) {
    userGroup = await ClientCompanyUserGroup.findByPk(user.groupId);
  }

  // Resolve menus and permissions
  const { authorizedMenus, effectiveRights } = await resolveClientUserMenus(user, company);

  const userJson = user.toJSON();
  delete userJson.password;

  res.status(200).json({
    success: true,
    message: "Client user logged in successfully.",
    token,
    session_id: sessionId,
    user: userJson,
    company: company ? {
      id: company.id,
      name: company.name,
      email: company.email,
      mobile_no: company.mobile_no,
      website: company.website,
      address: company.address,
      companylogo: company.companylogo,
      backgroundImage: company.backgroundImage || company.background_image || null,
      status: company.status,
      allowSelfServicePortal: company.allowSelfServicePortal,
      client_portal_domains: company.client_portal_domains,
      bannerJson: company.bannerJson
    } : null,
    group: userGroup,
    rights: effectiveRights,
    menus: authorizedMenus
  });
});

/**
 * 1b. Get Logged-in Client User Profile and Menus
 * GET /api/v1/client-company/me
 */
export const getClientMyProfile = catchAsyncErrors(async (req, res, next) => {
  const userId = req.user.id;
  const user = await ClientCompanyUser.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  const company = await ClientCompanyMaster.findByPk(user.companyId);

  let userGroup = null;
  if (user.groupId) {
    userGroup = await ClientCompanyUserGroup.findByPk(user.groupId);
  }

  const { authorizedMenus, effectiveRights } = await resolveClientUserMenus(user, company);

  const userJson = user.toJSON();
  delete userJson.password;

  res.status(200).json({
    success: true,
    user: userJson,
    company: company ? {
      id: company.id,
      name: company.name,
      email: company.email,
      mobile_no: company.mobile_no,
      website: company.website,
      address: company.address,
      companylogo: company.companylogo,
      backgroundImage: company.backgroundImage || company.background_image || null,
      status: company.status,
      allowSelfServicePortal: company.allowSelfServicePortal,
      client_portal_domains: company.client_portal_domains,
      bannerJson: company.bannerJson
    } : null,
    group: userGroup,
    rights: effectiveRights,
    menus: authorizedMenus
  });
});

/**
 * =========================================================================
 * 2. CLIENT COMPANY USER GROUP & GROUP PERMISSIONS MANAGEMENT
 * =========================================================================
 */

/**
 * 2a. List all User Groups of a Client Company
 * GET /api/v1/client-company/groups
 */
export const getAllClientUserGroups = catchAsyncErrors(async (req, res, next) => {
  const companyId = req.query.companyId || req.user?.companyId || req.authContext?.company_id;

  if (!companyId) {
    return next(new ErrorHandler("Company ID is required.", 400));
  }

  const groups = await ClientCompanyUserGroup.findAll({
    where: { companyId },
    order: [['id', 'ASC']]
  });

  res.status(200).json({
    success: true,
    count: groups.length,
    groups
  });
});

/**
 * 2b. Get Single User Group by ID
 * GET /api/v1/client-company/groups/:id
 */
export const getClientUserGroupById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const group = await ClientCompanyUserGroup.findByPk(id);
  if (!group) {
    return next(new ErrorHandler("User group not found.", 404));
  }

  // Also fetch permissions assigned to this group
  const permissions = await ClientCompanyUserGroupPermission.findAll({
    where: { groupId: group.id, companyId: group.companyId }
  });

  res.status(200).json({
    success: true,
    group,
    permissions
  });
});

/**
 * 2c. Create Client Company User Group
 * POST /api/v1/client-company/groups
 */
export const createClientUserGroup = catchAsyncErrors(async (req, res, next) => {
  const rawCompanyId = req.body.companyId || req.user?.companyId || req.authContext?.company_id;
  const { group_name, allow_ip, status, permissions } = req.body;

  if (!rawCompanyId || !group_name) {
    return next(new ErrorHandler("Company ID and Group name are required.", 400));
  }

  const existing = await ClientCompanyUserGroup.findOne({
    where: {
      companyId: rawCompanyId,
      group_name: group_name.trim()
    }
  });

  if (existing) {
    return next(new ErrorHandler(`Group '${group_name}' already exists in this company.`, 409));
  }

  const group = await ClientCompanyUserGroup.create({
    companyId: rawCompanyId,
    group_name: group_name.trim(),
    allow_ip: allow_ip || '',
    status: status !== undefined ? Boolean(status) : true,
    cr_usr: req.user?.id || null
  });

  if (Array.isArray(permissions) && permissions.length > 0) {
    const permRows = permissions.map(p => ({
      companyId: rawCompanyId,
      groupId: group.id,
      pageId: p.pageId || p.page_id,
      viewRight: Boolean(p.viewRight ?? p.view_right),
      addRight: Boolean(p.addRight ?? p.add_right),
      editRight: Boolean(p.editRight ?? p.edit_right),
      excelRight: Boolean(p.excelRight ?? p.excel_right),
      deleteRight: Boolean(p.deleteRight ?? p.delete_right)
    }));
    await ClientCompanyUserGroupPermission.bulkCreate(permRows);
  }

  res.status(201).json({
    success: true,
    message: "User group created successfully.",
    group
  });
});

/**
 * 2d. Update Client Company User Group
 * PUT /api/v1/client-company/groups/:id
 */
export const updateClientUserGroup = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { group_name, allow_ip, status } = req.body;

  const group = await ClientCompanyUserGroup.findByPk(id);
  if (!group) {
    return next(new ErrorHandler("User group not found.", 404));
  }

  if (group_name) group.group_name = group_name.trim();
  if (allow_ip !== undefined) group.allow_ip = allow_ip;
  if (status !== undefined) group.status = Boolean(status);
  group.md_usr = req.user?.id || null;

  await group.save();

  res.status(200).json({
    success: true,
    message: "User group updated successfully.",
    group
  });
});

/**
 * 2e. Delete Client Company User Group
 * DELETE /api/v1/client-company/groups/:id
 */
export const deleteClientUserGroup = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const group = await ClientCompanyUserGroup.findByPk(id);
  if (!group) {
    return next(new ErrorHandler("User group not found.", 404));
  }

  // Check if any users are assigned to this group
  const assignedUsersCount = await ClientCompanyUser.count({
    where: { groupId: id }
  });

  if (assignedUsersCount > 0) {
    return next(new ErrorHandler(`Cannot delete group. ${assignedUsersCount} user(s) are assigned to it. Reassign them first.`, 400));
  }

  // Remove linked permissions
  await ClientCompanyUserGroupPermission.destroy({ where: { groupId: id } });
  await group.destroy();

  res.status(200).json({
    success: true,
    message: "User group and its permissions deleted successfully."
  });
});

/**
 * 2f. Get Group Rights Matrix (Full 9 client menus context)
 * GET /api/v1/client-company/groups/:groupId/rights
 */
export const getClientGroupRightsMatrix = catchAsyncErrors(async (req, res, next) => {
  const { groupId } = req.params;

  const group = await ClientCompanyUserGroup.findByPk(groupId);
  if (!group) {
    return next(new ErrorHandler("User group not found.", 404));
  }

  const groupPermissions = await ClientCompanyUserGroupPermission.findAll({
    where: { groupId: group.id, companyId: group.companyId },
    raw: true
  });
  const rightsMap = new Map();
  groupPermissions.forEach(r => rightsMap.set(r.page_id || r.pageId, r));

  // Company baseline rights
  const companyRights = await CompanyMasterRight.findAll({
    where: { company_id: group.companyId },
    raw: true
  });
  const companyRightsMap = new Map();
  companyRights.forEach(cr => companyRightsMap.set(cr.page_id, cr));

  // All active client menus
  const menus = await GlobalMenuMaster.findAll({
    where: { isClientMenu: true, isActive: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  const matrix = menus.map(m => {
    const r = rightsMap.get(m.id);
    const cr = companyRightsMap.get(m.id);
    return {
      pageId: m.id,
      menuCode: m.menuCode,
      menuName: m.menuName,
      menuLabel: m.menuLabel || m.menuName,
      route: m.route,
      icon: m.icon,
      viewRight: r ? Boolean(r.viewRight ?? r.view_right) : false,
      addRight: r ? Boolean(r.addRight ?? r.add_right) : false,
      editRight: r ? Boolean(r.editRight ?? r.edit_right) : false,
      excelRight: r ? Boolean(r.excelRight ?? r.excel_right) : false,
      deleteRight: r ? Boolean(r.deleteRight ?? r.delete_right) : false,
      companyAllowed: companyRights.length === 0 || (cr ? Boolean(cr.view_right) : false)
    };
  });

  res.status(200).json({
    success: true,
    groupId: group.id,
    groupName: group.group_name,
    companyId: group.companyId,
    rights: matrix
  });
});

/**
 * 2g. Save / Bulk Update Group Rights
 * POST /api/v1/client-company/groups/:groupId/rights
 * Body: { rights: [{ pageId, viewRight, addRight, editRight, excelRight, deleteRight }] }
 */
export const saveClientGroupRights = catchAsyncErrors(async (req, res, next) => {
  const { groupId } = req.params;
  const { rights } = req.body;

  if (!Array.isArray(rights)) {
    return next(new ErrorHandler("'rights' must be an array of permissions.", 400));
  }

  const group = await ClientCompanyUserGroup.findByPk(groupId);
  if (!group) {
    return next(new ErrorHandler("User group not found.", 404));
  }

  for (const item of rights) {
    const pageId = item.pageId || item.page_id;
    if (!pageId) continue;

    const existing = await ClientCompanyUserGroupPermission.findOne({
      where: { groupId: group.id, companyId: group.companyId, pageId }
    });

    const viewRight = Boolean(item.viewRight ?? item.view_right);
    const addRight = Boolean(item.addRight ?? item.add_right);
    const editRight = Boolean(item.editRight ?? item.edit_right);
    const excelRight = Boolean(item.excelRight ?? item.excel_right);
    const deleteRight = Boolean(item.deleteRight ?? item.delete_right);

    if (existing) {
      existing.viewRight = viewRight;
      existing.addRight = addRight;
      existing.editRight = editRight;
      existing.excelRight = excelRight;
      existing.deleteRight = deleteRight;
      await existing.save();
    } else {
      await ClientCompanyUserGroupPermission.create({
        companyId: group.companyId,
        groupId: group.id,
        pageId,
        viewRight,
        addRight,
        editRight,
        excelRight,
        deleteRight
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Permissions updated successfully for group '${group.group_name}'.`
  });
});

/**
 * 3. Create Client Company User (with optional user-specific permissions)
 * POST /api/v1/client-company/users
 */
export const createClientUser = catchAsyncErrors(async (req, res, next) => {
  const {
    companyId: rawCompanyId,
    groupId,
    managerId,
    name,
    username,
    loginId,
    email,
    password,
    phone,
    isCompanyOwner,
    status,
    isActive,
    permissions
  } = req.body;

  // Resolve companyId: either from payload, or from logged-in user context
  const companyId = rawCompanyId || req.user?.companyId || req.authContext?.company_id;

  if (!companyId || !name || !email || !password) {
    return next(new ErrorHandler("Company ID, name, email and password are required.", 400));
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await ClientCompanyUser.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    return next(new ErrorHandler("A user with this email already exists in client company.", 409));
  }

  // Create User in client_company_user
  const newUser = await ClientCompanyUser.create({
    companyId,
    groupId: groupId || null,
    managerId: managerId || null,
    name,
    username: username || normalizedEmail.split('@')[0],
    loginId: loginId || normalizedEmail,
    email: normalizedEmail,
    password,
    phone: phone || null,
    isCompanyOwner: Boolean(isCompanyOwner),
    status: status !== undefined ? Boolean(status) : (isActive !== undefined ? Boolean(isActive) : true),
    isActive: isActive !== undefined ? Boolean(isActive) : (status !== undefined ? Boolean(status) : true),
    crUsr: req.user?.id || null
  });

  // Assign user-specific permissions if provided
  if (Array.isArray(permissions) && permissions.length > 0) {
    const userPermRows = permissions.map(p => ({
      companyId,
      userId: newUser.id,
      pageId: p.pageId,
      viewRight: Boolean(p.viewRight),
      addRight: Boolean(p.addRight),
      editRight: Boolean(p.editRight),
      excelRight: Boolean(p.excelRight),
      deleteRight: Boolean(p.deleteRight)
    }));
    await ClientCompanyUserPermission.bulkCreate(userPermRows);
  }

  const userJson = newUser.toJSON();
  delete userJson.password;

  res.status(201).json({
    success: true,
    message: "Client user created successfully.",
    user: userJson
  });
});

/**
 * 4. Get All Users of a Client Company (Hierarchy Aware)
 * GET /api/v1/client-company/users
 * 
 * Hierarchy Rules:
 * - isCompanyOwner === true: Can see ALL company users OTHER THAN themselves (self excluded).
 * - Regular Staff/Manager: Can see ONLY the users in their downstream hierarchy (created by them cr_usr or reporting to them manager_id).
 * - SuperAdmin: Can see all company users.
 */
export const getClientCompanyUsers = catchAsyncErrors(async (req, res, next) => {
  const companyId = req.query.companyId || req.user?.companyId || req.authContext?.company_id;

  if (!companyId) {
    return next(new ErrorHandler("Company ID is required.", 400));
  }

  const currentUser = req.user;
  const isSuperAdmin = Boolean(req.user?.isSuperAdmin || req.user?.isAdmin);
  const isOwner = Boolean(currentUser?.isCompanyOwner || req.authContext?.is_company_owner);

  let where = { companyId };

  if (req.query.status !== undefined) {
    where.status = req.query.status === 'true' || req.query.status === '1';
  }

  if (isSuperAdmin) {
    // SuperAdmin viewing company users from Admin panel: see all
  } else if (isOwner) {
    // 1. Company Owner: sees all users in this company EXCEPT himself
    where.id = { [Op.ne]: currentUser.id };
  } else if (currentUser?.id) {
    // 2. Regular User/Staff: sees only users down in their hierarchy (created by them or managed by them)
    const [subordinates] = await sequelize.query(`
      WITH RECURSIVE subordinate_users AS (
        -- Directly created or managed by this user
        SELECT id FROM client_company_user 
        WHERE (cr_usr = :userId OR manager_id = :userId) AND company_id = :companyId
        
        UNION
        
        -- Downstream chain
        SELECT c.id FROM client_company_user c
        INNER JOIN subordinate_users s ON (s.id = c.manager_id OR s.id = c.cr_usr)
        WHERE c.company_id = :companyId
      )
      SELECT id FROM subordinate_users;
    `, {
      replacements: { userId: currentUser.id, companyId },
      type: sequelize.QueryTypes.SELECT
    });

    const subordinateIds = subordinates.map(s => s.id);

    if (subordinateIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        users: []
      });
    }

    where.id = { [Op.in]: subordinateIds };
  }

  const users = await ClientCompanyUser.findAll({
    where,
    attributes: { exclude: ['password'] },
    order: [['id', 'DESC']]
  });

  res.status(200).json({
    success: true,
    count: users.length,
    users
  });
});

/**
 * 5. Get Single Client User Details (with Group and Permissions)
 * GET /api/v1/client-company/users/:id
 */
export const getClientCompanyUserById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const user = await ClientCompanyUser.findByPk(id, {
    attributes: { exclude: ['password'] }
  });

  if (!user) {
    return next(new ErrorHandler("Client user not found.", 404));
  }

  let group = null;
  let groupPermissions = [];
  if (user.groupId) {
    group = await ClientCompanyUserGroup.findByPk(user.groupId);
    groupPermissions = await ClientCompanyUserGroupPermission.findAll({
      where: { groupId: user.groupId, companyId: user.companyId },
      raw: true
    });
  }

  const userPermissions = await ClientCompanyUserPermission.findAll({
    where: { userId: user.id, companyId: user.companyId },
    raw: true
  });

  res.status(200).json({
    success: true,
    user,
    group,
    groupPermissions,
    userPermissions
  });
});

/**
 * 6. Update Client Company User
 * PUT /api/v1/client-company/users/:id
 */
export const updateClientUser = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { name, phone, groupId, managerId, status, password, permissions } = req.body;

  const user = await ClientCompanyUser.findByPk(id);
  if (!user) {
    return next(new ErrorHandler("Client user not found.", 404));
  }

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (groupId !== undefined) user.groupId = groupId;
  if (managerId !== undefined) user.managerId = managerId;
  if (status !== undefined) user.status = Boolean(status);
  if (password) user.password = password; // triggers beforeUpdate bcrypt hook

  user.mdUsr = req.user?.id || null;
  await user.save();

  // If permissions array provided, sync permissions
  if (Array.isArray(permissions)) {
    await ClientCompanyUserPermission.destroy({ where: { userId: user.id } });
    if (permissions.length > 0) {
      const userPermRows = permissions.map(p => ({
        companyId: user.companyId,
        userId: user.id,
        pageId: p.pageId,
        viewRight: Boolean(p.viewRight),
        addRight: Boolean(p.addRight),
        editRight: Boolean(p.editRight),
        excelRight: Boolean(p.excelRight),
        deleteRight: Boolean(p.deleteRight)
      }));
      await ClientCompanyUserPermission.bulkCreate(userPermRows);
    }
  }

  const userJson = user.toJSON();
  delete userJson.password;

  res.status(200).json({
    success: true,
    message: "Client user updated successfully.",
    user: userJson
  });
});

/**
 * 6b. Delete Client Company User
 * DELETE /api/v1/client-company/users/:id
 */
export const deleteClientUser = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const user = await ClientCompanyUser.findByPk(id);
  if (!user) {
    return next(new ErrorHandler("Client user not found.", 404));
  }

  if (user.isCompanyOwner) {
    return next(new ErrorHandler("Company owner account cannot be deleted.", 403));
  }

  // Delete user-level permission overrides first
  await ClientCompanyUserPermission.destroy({ where: { userId: id } });

  // Delete user
  await user.destroy();

  res.status(200).json({
    success: true,
    message: "Client user and permission overrides deleted successfully."
  });
});

/**
 * =========================================================================
 * 7. DEDICATED CLIENT USER PERMISSIONS MATRIX & MANAGEMENT
 * =========================================================================
 */

/**
 * 7a. Get Client User Permissions Matrix
 * GET /api/v1/client-company/users/:userId/rights
 */
export const getClientUserRightsMatrix = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;

  const user = await ClientCompanyUser.findByPk(userId);
  if (!user) {
    return next(new ErrorHandler("Client user not found.", 404));
  }

  const company = await ClientCompanyMaster.findByPk(user.companyId);

  // 1. Group level rights
  let groupPermissions = [];
  let userGroup = null;
  if (user.groupId) {
    userGroup = await ClientCompanyUserGroup.findByPk(user.groupId);
    groupPermissions = await ClientCompanyUserGroupPermission.findAll({
      where: { groupId: user.groupId, companyId: user.companyId },
      raw: true
    });
  }
  const groupRightsMap = new Map();
  groupPermissions.forEach(r => groupRightsMap.set(r.page_id || r.pageId, r));

  // 2. User specific overrides
  const userOverrides = await ClientCompanyUserPermission.findAll({
    where: { userId: user.id, companyId: user.companyId },
    raw: true
  });
  const userOverrideMap = new Map();
  userOverrides.forEach(r => userOverrideMap.set(r.page_id || r.pageId, r));

  // 3. Company baseline rights (if configured)
  const companyRights = await CompanyMasterRight.findAll({
    where: { company_id: user.companyId },
    raw: true
  });
  const companyRightsMap = new Map();
  companyRights.forEach(cr => companyRightsMap.set(cr.page_id, cr));

  // 4. All active client menus
  const menus = await GlobalMenuMaster.findAll({
    where: { isClientMenu: true, isActive: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  const matrix = menus.map(m => {
    const cr = companyRightsMap.get(m.id);
    const gr = groupRightsMap.get(m.id);
    const ur = userOverrideMap.get(m.id);

    return {
      pageId: m.id,
      menuCode: m.menuCode,
      menuName: m.menuName,
      menuLabel: m.menuLabel || m.menuName,
      route: m.route,
      hasUserOverride: Boolean(ur),
      effectiveRights: {
        viewRight: ur ? Boolean(ur.viewRight ?? ur.view_right) : (gr ? Boolean(gr.viewRight ?? gr.view_right) : false),
        addRight: ur ? Boolean(ur.addRight ?? ur.add_right) : (gr ? Boolean(gr.addRight ?? gr.add_right) : false),
        editRight: ur ? Boolean(ur.editRight ?? ur.edit_right) : (gr ? Boolean(gr.editRight ?? gr.edit_right) : false),
        excelRight: ur ? Boolean(ur.excelRight ?? ur.excel_right) : (gr ? Boolean(gr.excelRight ?? gr.excel_right) : false),
        deleteRight: ur ? Boolean(ur.deleteRight ?? ur.delete_right) : (gr ? Boolean(gr.deleteRight ?? gr.delete_right) : false),
      },
      groupRights: gr ? {
        viewRight: Boolean(gr.viewRight ?? gr.view_right),
        addRight: Boolean(gr.addRight ?? gr.add_right),
        editRight: Boolean(gr.editRight ?? gr.edit_right),
        excelRight: Boolean(gr.excelRight ?? gr.excel_right),
        deleteRight: Boolean(gr.deleteRight ?? gr.delete_right),
      } : null,
      userOverrideRights: ur ? {
        viewRight: Boolean(ur.viewRight ?? ur.view_right),
        addRight: Boolean(ur.addRight ?? ur.add_right),
        editRight: Boolean(ur.editRight ?? ur.edit_right),
        excelRight: Boolean(ur.excelRight ?? ur.excel_right),
        deleteRight: Boolean(ur.deleteRight ?? ur.delete_right),
      } : null,
      companyAllowed: companyRights.length === 0 || (cr ? Boolean(cr.view_right) : false)
    };
  });

  res.status(200).json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      groupId: user.groupId,
      groupName: userGroup?.group_name || null,
      isCompanyOwner: user.isCompanyOwner
    },
    company: company ? {
      id: company.id,
      name: company.name
    } : null,
    rights: matrix
  });
});

/**
 * 7b. Save / Update Client User Specific Rights (Dedicated Endpoint)
 * POST /api/v1/client-company/users/:userId/rights
 * Body: { rights: [{ pageId, viewRight, addRight, editRight, excelRight, deleteRight }] }
 */
export const saveClientUserRights = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;
  const { rights } = req.body;

  if (!Array.isArray(rights)) {
    return next(new ErrorHandler("'rights' must be an array of permissions.", 400));
  }

  const user = await ClientCompanyUser.findByPk(userId);
  if (!user) {
    return next(new ErrorHandler("Client user not found.", 404));
  }

  for (const item of rights) {
    const pageId = item.pageId || item.page_id;
    if (!pageId) continue;

    const existing = await ClientCompanyUserPermission.findOne({
      where: { userId: user.id, companyId: user.companyId, pageId }
    });

    const viewRight = Boolean(item.viewRight ?? item.view_right);
    const addRight = Boolean(item.addRight ?? item.add_right);
    const editRight = Boolean(item.editRight ?? item.edit_right);
    const excelRight = Boolean(item.excelRight ?? item.excel_right);
    const deleteRight = Boolean(item.deleteRight ?? item.delete_right);

    if (existing) {
      existing.viewRight = viewRight;
      existing.addRight = addRight;
      existing.editRight = editRight;
      existing.excelRight = excelRight;
      existing.deleteRight = deleteRight;
      await existing.save();
    } else {
      await ClientCompanyUserPermission.create({
        companyId: user.companyId,
        userId: user.id,
        pageId,
        viewRight,
        addRight,
        editRight,
        excelRight,
        deleteRight
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `User permissions updated successfully for '${user.name}'.`
  });
});

/**
 * 7c. Remove Client User Override for a specific page (reverts back to group default)
 * DELETE /api/v1/client-company/users/:userId/rights/:pageId
 */
export const removeClientUserRight = catchAsyncErrors(async (req, res, next) => {
  const { userId, pageId } = req.params;

  const deleted = await ClientCompanyUserPermission.destroy({
    where: { userId, pageId }
  });

  if (!deleted) {
    return next(new ErrorHandler("No override permission found for this page on this user.", 404));
  }

  res.status(200).json({
    success: true,
    message: `User override for page ${pageId} removed. Reverted to role/group defaults.`
  });
});


