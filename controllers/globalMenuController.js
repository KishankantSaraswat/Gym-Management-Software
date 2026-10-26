import { catchAsyncErrors } from '../middlewares/catchAsyncErrors.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';
import { GlobalMenuMaster } from '../models/global_menu_schema.js';

/**
 * 1. Create a Global Menu Item
 * POST /api/v1/global-menus
 */
export const createGlobalMenu = catchAsyncErrors(async (req, res, next) => {
  const {
    parentId,
    menuCode,
    menuName,
    menuLabel,
    route,
    icon,
    menuType,
    sortOrder,
    platform,
    isActive,
    isClientMenu,
    description
  } = req.body;

  if (!menuCode || !menuName || !route) {
    return next(new ErrorHandler("menuCode, menuName, and route are required.", 400));
  }

  const normalizedCode = menuCode.trim().toUpperCase();

  const existing = await GlobalMenuMaster.findOne({ where: { menuCode: normalizedCode } });
  if (existing) {
    return next(new ErrorHandler(`Menu with code ${normalizedCode} already exists.`, 409));
  }

  const menu = await GlobalMenuMaster.create({
    parentId: parentId || null,
    menuCode: normalizedCode,
    menuName,
    menuLabel: menuLabel || menuName,
    route,
    icon: icon || null,
    menuType: menuType || 'sidebar',
    sortOrder: sortOrder || 0,
    platform: platform || 'web',
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    isClientMenu: isClientMenu !== undefined ? Boolean(isClientMenu) : false,
    description: description || null,
    crUsr: req.user?.id || null
  });

  res.status(201).json({
    success: true,
    message: "Global menu created successfully.",
    menu
  });
});

/**
 * Helper to build flat or tree menus based on where condition
 */
const fetchMenusWithTreeSupport = async (queryWhere, req, res) => {
  const { asTree, platform, menuType, isActive } = req.query;

  const where = { ...queryWhere };
  if (platform) where.platform = platform;
  if (menuType) where.menuType = menuType;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === '1';

  const menus = await GlobalMenuMaster.findAll({
    where,
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  if (asTree === 'true' || asTree === '1') {
    const menuMap = new Map();
    const tree = [];

    menus.forEach(m => {
      menuMap.set(m.id, { ...m.toJSON(), children: [] });
    });

    menuMap.forEach(item => {
      if (item.parentId && menuMap.has(item.parentId)) {
        menuMap.get(item.parentId).children.push(item);
      } else {
        tree.push(item);
      }
    });

    return res.status(200).json({
      success: true,
      count: tree.length,
      menus: tree
    });
  }

  return res.status(200).json({
    success: true,
    count: menus.length,
    menus
  });
};

/**
 * 2. Get All Global Menus (as Flat List or Tree Structure)
 * GET /api/v1/admin/menus or GET /api/v1/global-menus
 */
export const getAllGlobalMenus = catchAsyncErrors(async (req, res, next) => {
  const { isClientMenu } = req.query;
  const where = {};
  if (isClientMenu !== undefined) {
    where.isClientMenu = isClientMenu === 'true' || isClientMenu === '1';
  }
  return await fetchMenusWithTreeSupport(where, req, res);
});

/**
 * 2a. Get All Admin Menus (where isClientMenu = false and isActive = true by default)
 * GET /api/v1/admin/menus/admin-menus
 */
export const getAllAdminMenus = catchAsyncErrors(async (req, res, next) => {
  const where = {
    isClientMenu: false,
    isActive: req.query.isActive !== undefined ? (req.query.isActive === 'true' || req.query.isActive === '1') : true
  };
  return await fetchMenusWithTreeSupport(where, req, res);
});

/**
 * 2b. Get All Client Menus (where isClientMenu = true and isActive = true by default)
 * GET /api/v1/admin/menus/client-menus
 */
export const getAllClientMenus = catchAsyncErrors(async (req, res, next) => {
  const where = {
    isClientMenu: true,
    isActive: req.query.isActive !== undefined ? (req.query.isActive === 'true' || req.query.isActive === '1') : true
  };
  return await fetchMenusWithTreeSupport(where, req, res);
});

/**
 * 3. Get Single Global Menu by ID
 * GET /api/v1/global-menus/:id
 */
export const getGlobalMenuById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const menu = await GlobalMenuMaster.findByPk(id, {
    include: [{ model: GlobalMenuMaster, as: 'children' }]
  });

  if (!menu) {
    return next(new ErrorHandler("Global menu not found.", 404));
  }

  res.status(200).json({
    success: true,
    menu
  });
});

/**
 * 4. Update Global Menu
 * PUT /api/v1/global-menus/:id
 */
export const updateGlobalMenu = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const {
    parentId,
    menuCode,
    menuName,
    menuLabel,
    route,
    icon,
    menuType,
    sortOrder,
    platform,
    isActive,
    isClientMenu,
    description
  } = req.body;

  const menu = await GlobalMenuMaster.findByPk(id);
  if (!menu) {
    return next(new ErrorHandler("Global menu not found.", 404));
  }

  if (parentId !== undefined) menu.parentId = parentId || null;
  if (menuCode) menu.menuCode = menuCode.trim().toUpperCase();
  if (menuName) menu.menuName = menuName;
  if (menuLabel !== undefined) menu.menuLabel = menuLabel;
  if (route) menu.route = route;
  if (icon !== undefined) menu.icon = icon;
  if (menuType !== undefined) menu.menuType = menuType;
  if (sortOrder !== undefined) menu.sortOrder = sortOrder;
  if (platform !== undefined) menu.platform = platform;
  if (isActive !== undefined) menu.isActive = Boolean(isActive);
  if (isClientMenu !== undefined) menu.isClientMenu = Boolean(isClientMenu);
  if (description !== undefined) menu.description = description;

  menu.mdUsr = req.user?.id || null;
  await menu.save();

  res.status(200).json({
    success: true,
    message: "Global menu updated successfully.",
    menu
  });
});

/**
 * 5. Delete Global Menu
 * DELETE /api/v1/global-menus/:id
 */
export const deleteGlobalMenu = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const menu = await GlobalMenuMaster.findByPk(id);
  if (!menu) {
    return next(new ErrorHandler("Global menu not found.", 404));
  }

  await menu.destroy();

  res.status(200).json({
    success: true,
    message: "Global menu deleted successfully."
  });
});

