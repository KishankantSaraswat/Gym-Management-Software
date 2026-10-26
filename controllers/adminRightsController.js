import {
  UserGroup,
  UserGroupRight,
  UserMasterRight,
  CompanyMasterRight,
  ClientCompanyMaster,
  AdminUser,
  GlobalMenuMaster,
  ClientMenuMaster
} from '../models/index.js';
import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import { resolveUserRights } from './adminAuthController.js';

/**
 * =========================================================================
 * 1. USER GROUP MANAGEMENT (users_group_master)
 * =========================================================================
 */

/**
 * List all User Groups
 * GET /admin/groups
 */
export const getAllUserGroups = catchAsyncErrors(async (req, res, next) => {
  const groups = await UserGroup.findAll({
    order: [['id', 'ASC']]
  });

  res.status(200).json({
    success: true,
    count: groups.length,
    groups
  });
});

/**
 * Create a new User Group
 * POST /admin/groups
 */
export const createUserGroup = catchAsyncErrors(async (req, res, next) => {
  const { group_name, allow_ip, status } = req.body;

  if (!group_name) {
    return next(new ErrorHandler("group_name is required.", 400));
  }

  const existing = await UserGroup.findOne({ where: { group_name: group_name.trim() } });
  if (existing) {
    return next(new ErrorHandler(`Group '${group_name}' already exists.`, 409));
  }

  const group = await UserGroup.create({
    group_name: group_name.trim(),
    allow_ip: allow_ip || '',
    status: status !== undefined ? Boolean(status) : true,
    cr_usr: req.user?.id || null,
    md_usr: req.user?.id || null
  });

  res.status(201).json({
    success: true,
    message: "User group created successfully.",
    group
  });
});

/**
 * Update a User Group
 * PUT /admin/groups/:id
 */
export const updateUserGroup = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { group_name, allow_ip, status } = req.body;

  const group = await UserGroup.findByPk(id);
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
 * Delete a User Group
 * DELETE /admin/groups/:id
 */
export const deleteUserGroup = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const group = await UserGroup.findByPk(id);
  if (!group) {
    return next(new ErrorHandler("User group not found.", 404));
  }

  // Prevent deleting Master group if reserved
  if (group.group_name.toLowerCase() === 'master') {
    return next(new ErrorHandler("The 'Master' group cannot be deleted.", 403));
  }

  // Remove linked rights first
  await UserGroupRight.destroy({ where: { group_id: id } });
  await group.destroy();

  res.status(200).json({
    success: true,
    message: "User group and associated rights deleted successfully."
  });
});

/**
 * =========================================================================
 * 2. GROUP-WISE PERMISSIONS (users_group_rights)
 * =========================================================================
 */

/**
 * Get permission matrix for a specific group
 * GET /admin/groups/:groupId/rights
 */
export const getGroupRights = catchAsyncErrors(async (req, res, next) => {
  const { groupId } = req.params;

  const group = await UserGroup.findByPk(groupId);
  if (!group) {
    return next(new ErrorHandler("User group not found.", 404));
  }

  const groupRights = await UserGroupRight.findAll({
    where: { group_id: groupId }
  });

  // Also fetch all available global menus to give full matrix context
  const menus = await GlobalMenuMaster.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  const rightsMap = new Map();
  groupRights.forEach(r => {
    rightsMap.set(r.page_id, r);
  });

  // Construct complete matrix mapping all active pages
  const matrix = menus.map(m => {
    const r = rightsMap.get(m.id);
    return {
      page_id: m.id,
      menu_code: m.menuCode,
      menu_name: m.menuName,
      route: m.route,
      icon: m.icon,
      view_right: r ? Boolean(r.view_right) : false,
      add_right: r ? Boolean(r.add_right) : false,
      edit_right: r ? Boolean(r.edit_right) : false,
      excel_right: r ? Boolean(r.excel_right) : false,
      delete_right: r ? Boolean(r.delete_right) : false
    };
  });

  res.status(200).json({
    success: true,
    groupId: group.id,
    groupName: group.group_name,
    rights: matrix
  });
});

/**
 * Bulk save/update permissions for a group
 * POST /admin/groups/:groupId/rights
 * Body: { rights: [{ page_id, view_right, add_right, edit_right, excel_right, delete_right }] }
 */
export const saveGroupRights = catchAsyncErrors(async (req, res, next) => {
  const { groupId } = req.params;
  const { rights } = req.body;

  if (!Array.isArray(rights)) {
    return next(new ErrorHandler("'rights' must be an array of page rights.", 400));
  }

  const group = await UserGroup.findByPk(groupId);
  if (!group) {
    return next(new ErrorHandler("User group not found.", 404));
  }

  // Upsert or bulk-replace rights for this group
  for (const item of rights) {
    if (!item.page_id) continue;

    const existing = await UserGroupRight.findOne({
      where: { group_id: groupId, page_id: item.page_id }
    });

    if (existing) {
      existing.view_right = Boolean(item.view_right);
      existing.add_right = Boolean(item.add_right);
      existing.edit_right = Boolean(item.edit_right);
      existing.excel_right = Boolean(item.excel_right);
      existing.delete_right = Boolean(item.delete_right);
      await existing.save();
    } else {
      await UserGroupRight.create({
        group_id: groupId,
        page_id: item.page_id,
        view_right: Boolean(item.view_right),
        add_right: Boolean(item.add_right),
        edit_right: Boolean(item.edit_right),
        excel_right: Boolean(item.excel_right),
        delete_right: Boolean(item.delete_right)
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Permissions updated successfully for group '${group.group_name}'.`
  });
});

/**
 * =========================================================================
 * 3. USER-WISE PERMISSION OVERRIDES (users_master_rights)
 * =========================================================================
 */

/**
 * Get effective rights for an admin user (Group Rights + User Overrides)
 * GET /admin/users/:userId/rights
 */
export const getUserRightsMatrix = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;

  const admin = await AdminUser.findByPk(userId, {
    include: [{ model: UserGroup, as: 'group', required: false }]
  });

  if (!admin) {
    return next(new ErrorHandler("Admin user not found.", 404));
  }

  // 1. Group level rights
  const groupRightsMap = new Map();
  if (admin.groupId) {
    const groupRights = await UserGroupRight.findAll({
      where: { group_id: admin.groupId }
    });
    groupRights.forEach(r => groupRightsMap.set(r.page_id, r));
  }

  // 2. User specific overrides
  const userOverrides = await UserMasterRight.findAll({
    where: { user_id: admin.id }
  });
  const userOverrideMap = new Map();
  userOverrides.forEach(r => userOverrideMap.set(r.page_id, r));

  // 3. All active global menus
  const menus = await GlobalMenuMaster.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  // Build matrix showing base group right vs user override
  const matrix = menus.map(m => {
    const gr = groupRightsMap.get(m.id);
    const ur = userOverrideMap.get(m.id);

    return {
      page_id: m.id,
      menu_code: m.menuCode,
      menu_name: m.menuName,
      route: m.route,
      has_user_override: Boolean(ur),
      effective_rights: {
        view_right: ur ? Boolean(ur.view_right) : (gr ? Boolean(gr.view_right) : false),
        add_right: ur ? Boolean(ur.add_right) : (gr ? Boolean(gr.add_right) : false),
        edit_right: ur ? Boolean(ur.edit_right) : (gr ? Boolean(gr.edit_right) : false),
        excel_right: ur ? Boolean(ur.excel_right) : (gr ? Boolean(gr.excel_right) : false),
        delete_right: ur ? Boolean(ur.delete_right) : (gr ? Boolean(gr.delete_right) : false)
      },
      group_rights: gr ? {
        view_right: Boolean(gr.view_right),
        add_right: Boolean(gr.add_right),
        edit_right: Boolean(gr.edit_right),
        excel_right: Boolean(gr.excel_right),
        delete_right: Boolean(gr.delete_right)
      } : null,
      user_override_rights: ur ? {
        view_right: Boolean(ur.view_right),
        add_right: Boolean(ur.add_right),
        edit_right: Boolean(ur.edit_right),
        excel_right: Boolean(ur.excel_right),
        delete_right: Boolean(ur.delete_right)
      } : null
    };
  });

  res.status(200).json({
    success: true,
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      group_id: admin.groupId,
      group_name: admin.group?.group_name || null
    },
    rights: matrix
  });
});

/**
 * Save user-specific rights override
 * POST /admin/users/:userId/rights
 * Body: { rights: [{ page_id, view_right, add_right, edit_right, excel_right, delete_right }] }
 */
export const saveUserRightsOverride = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;
  const { rights } = req.body;

  if (!Array.isArray(rights)) {
    return next(new ErrorHandler("'rights' must be an array of page overrides.", 400));
  }

  const admin = await AdminUser.findByPk(userId);
  if (!admin) {
    return next(new ErrorHandler("Admin user not found.", 404));
  }

  for (const item of rights) {
    if (!item.page_id) continue;

    const existing = await UserMasterRight.findOne({
      where: { user_id: userId, page_id: item.page_id }
    });

    if (existing) {
      existing.view_right = Boolean(item.view_right);
      existing.add_right = Boolean(item.add_right);
      existing.edit_right = Boolean(item.edit_right);
      existing.excel_right = Boolean(item.excel_right);
      existing.delete_right = Boolean(item.delete_right);
      await existing.save();
    } else {
      await UserMasterRight.create({
        user_id: userId,
        page_id: item.page_id,
        view_right: Boolean(item.view_right),
        add_right: Boolean(item.add_right),
        edit_right: Boolean(item.edit_right),
        excel_right: Boolean(item.excel_right),
        delete_right: Boolean(item.delete_right)
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `User-specific rights override saved successfully for user '${admin.name}'.`
  });
});

/**
 * Remove user override for a specific page (reverts back to group baseline)
 * DELETE /admin/users/:userId/rights/:pageId
 */
export const removeUserRightOverride = catchAsyncErrors(async (req, res, next) => {
  const { userId, pageId } = req.params;

  const deleted = await UserMasterRight.destroy({
    where: { user_id: userId, page_id: pageId }
  });

  if (!deleted) {
    return next(new ErrorHandler("No override found for this page on this user.", 404));
  }

  res.status(200).json({
    success: true,
    message: `User override for page ${pageId} removed. Page rights reverted to group defaults.`
  });
});

/**
 * =========================================================================
 * 3b. COMPANY PERMISSIONS (company_master_rights)
 * =========================================================================
 */

/**
 * Get Company Permissions Matrix
 * GET /admin/companies/:companyId/rights
 */
export const getCompanyRightsMatrix = catchAsyncErrors(async (req, res, next) => {
  const { companyId } = req.params;

  const company = await ClientCompanyMaster.findByPk(companyId);
  if (!company) {
    return next(new ErrorHandler("Client company not found.", 404));
  }

  // 1. Existing Company Permissions
  const companyRights = await CompanyMasterRight.findAll({
    where: { company_id: companyId }
  });
  const rightsMap = new Map();
  companyRights.forEach(r => rightsMap.set(r.page_id, r));

  // 2. Fetch Active Client Menus (or all active menus)
  const menus = await GlobalMenuMaster.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  const matrix = menus.map(m => {
    const cr = rightsMap.get(m.id);
    return {
      page_id: m.id,
      menu_code: m.menuCode,
      menu_name: m.menuName,
      route: m.route,
      is_client_menu: m.isClientMenu,
      has_permission: Boolean(cr),
      rights: {
        view_right: cr ? Boolean(cr.view_right) : false,
        add_right: cr ? Boolean(cr.add_right) : false,
        edit_right: cr ? Boolean(cr.edit_right) : false,
        excel_right: cr ? Boolean(cr.excel_right) : false,
        delete_right: cr ? Boolean(cr.delete_right) : false,
      }
    };
  });

  res.status(200).json({
    success: true,
    company: {
      id: company.id,
      name: company.name,
      email: company.email,
      mobile_no: company.mobile_no
    },
    rights: matrix
  });
});

/**
 * Save / Update Company Permissions
 * POST /admin/companies/:companyId/rights
 * Body: { rights: [{ page_id, view_right, add_right, edit_right, excel_right, delete_right }] }
 */
export const saveCompanyRights = catchAsyncErrors(async (req, res, next) => {
  const { companyId } = req.params;
  const { rights } = req.body;

  if (!Array.isArray(rights)) {
    return next(new ErrorHandler("'rights' must be an array of permissions.", 400));
  }

  const company = await ClientCompanyMaster.findByPk(companyId);
  if (!company) {
    return next(new ErrorHandler("Client company not found.", 404));
  }

  for (const item of rights) {
    if (!item.page_id) continue;

    const existing = await CompanyMasterRight.findOne({
      where: { company_id: companyId, page_id: item.page_id }
    });

    if (existing) {
      existing.view_right = Boolean(item.view_right);
      existing.add_right = Boolean(item.add_right);
      existing.edit_right = Boolean(item.edit_right);
      existing.excel_right = Boolean(item.excel_right);
      existing.delete_right = Boolean(item.delete_right);
      await existing.save();
    } else {
      await CompanyMasterRight.create({
        company_id: companyId,
        page_id: item.page_id,
        view_right: Boolean(item.view_right),
        add_right: Boolean(item.add_right),
        edit_right: Boolean(item.edit_right),
        excel_right: Boolean(item.excel_right),
        delete_right: Boolean(item.delete_right)
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Company permissions updated successfully for '${company.name || 'Company #' + company.id}'.`
  });
});

/**
 * Remove specific page permission for a Company
 * DELETE /admin/companies/:companyId/rights/:pageId
 */
export const removeCompanyRight = catchAsyncErrors(async (req, res, next) => {
  const { companyId, pageId } = req.params;

  const deleted = await CompanyMasterRight.destroy({
    where: { company_id: companyId, page_id: pageId }
  });

  if (!deleted) {
    return next(new ErrorHandler("No permission found for this page on this company.", 404));
  }

  res.status(200).json({
    success: true,
    message: `Permission for page ${pageId} removed from company ${companyId}.`
  });
});

/**
 * =========================================================================
 * 4. GET LOGGED-IN ADMIN EFFECTIVE MENUS & RIGHTS
 * =========================================================================
 */

/**
 * Get dynamic sidebar menus based on logged in admin's resolved rights
 * GET /admin/menus/me
 */
export const getMyAuthorizedMenus = catchAsyncErrors(async (req, res, next) => {
  const adminId = req.user.id;
  const groupId = req.user.groupId || req.user.group_id;

  const rightsMap = await resolveUserRights(adminId, groupId);

  // Fetch all active global menus
  const allMenus = await GlobalMenuMaster.findAll({
    where: { isActive: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  // Filter only pages where view_right is granted
  const authorizedMenus = [];
  allMenus.forEach(m => {
    const r = rightsMap[m.id];
    // If master admin or view_right is true
    if (req.user.isSuperAdmin || (r && r.view_right)) {
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
        rights: r || {
          view_right: true,
          add_right: true,
          edit_right: true,
          excel_right: true,
          delete_right: true
        }
      });
    }
  });

  // Convert flat list into nested tree
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

  res.status(200).json({
    success: true,
    count: authorizedMenus.length,
    menus: tree
  });
});

