import { AppMenuMaster, ClientMenuMaster, PermissionMaster, GroupPermission, UserPermission, UserGymMapping } from '../models/index.js';

class MenuService {
    async getAuthorizedMenuTree(clientId, userId, branchId, userRole, isAppMenu = false) {
        // 1. Fetch all active global menus for the requested app type
        const globalMenus = await AppMenuMaster.findAll({
            where: { isActive: true, appMenu: isAppMenu },
            order: [['sortOrder', 'ASC']]
        });

        if (!globalMenus.length) return [];

        // 2. Fetch Client Menu configuration
        const clientMenus = await ClientMenuMaster.findAll({
            where: { clientId, isEnabled: true }
        });
        const enabledMenuIds = new Set(clientMenus.map(cm => cm.menuId));

        // Filter global menus for this client
        const availableMenus = globalMenus.filter(m => enabledMenuIds.has(m.id));

        // 3. Resolve Permissions for the User
        const menuPermissionsMap = new Map(); // menuId -> { view, add, update, delete, excel }

        // Fetch User's group/role mapping for this branch (if any)
        let roleId = null;
        if (userRole === 'GymOwner') {
            // Owner might have full permissions inherently, or we define it
            // For now, let's assume GymOwner has all permissions on all enabled menus
            for (const menu of availableMenus) {
                menuPermissionsMap.set(menu.id, { view: true, add: true, update: true, delete: true, excel: true });
            }
        } else if (userRole === 'Admin') {
            // Super admin has everything
            for (const menu of availableMenus) {
                menuPermissionsMap.set(menu.id, { view: true, add: true, update: true, delete: true, excel: true });
            }
        } else {
            // Staff / User
            if (branchId) {
                const userMapping = await UserGymMapping.findOne({ where: { userId, gymId: branchId, status: 'active' } });
                if (userMapping && userMapping.roleId) {
                    roleId = userMapping.roleId;
                }
            }

            // Get permissions defined for the menus
            const permissions = await PermissionMaster.findAll({
                where: { menuId: availableMenus.map(m => m.id) }
            });

            // Get Group Permissions
            let groupPerms = [];
            if (roleId) {
                groupPerms = await GroupPermission.findAll({
                    where: { groupId: roleId }
                });
            }

            // Get User Override Permissions
            const userPermOverrides = await UserPermission.findAll({
                where: { userId }
            });

            // Map permission ID to name
            const permIdToName = {};
            const menuIdToPerms = {};
            permissions.forEach(p => {
                permIdToName[p.id] = p.name;
                if (!menuIdToPerms[p.menuId]) menuIdToPerms[p.menuId] = [];
                menuIdToPerms[p.menuId].push(p);
            });

            const resolvedPermIds = new Set();
            
            // Add group perms
            groupPerms.forEach(gp => {
                // If branchId is null (all branches) or matches current branch
                if (!gp.branchId || gp.branchId === branchId) {
                    resolvedPermIds.add(gp.permissionId);
                }
            });

            // Apply overrides
            userPermOverrides.forEach(up => {
                if (!up.branchId || up.branchId === branchId) {
                    if (up.isAllowed) {
                        resolvedPermIds.add(up.permissionId);
                    } else {
                        resolvedPermIds.delete(up.permissionId);
                    }
                }
            });

            // Map resolved permissions to actions per menu
            for (const menu of availableMenus) {
                const permsForMenu = menuIdToPerms[menu.id] || [];
                const actions = { view: false, add: false, update: false, delete: false, excel: false };
                
                permsForMenu.forEach(p => {
                    const hasAccess = resolvedPermIds.has(p.id);
                    if (p.name.endsWith('_VIEW')) actions.view = hasAccess;
                    else if (p.name.endsWith('_ADD') || p.name.endsWith('_CREATE')) actions.add = hasAccess;
                    else if (p.name.endsWith('_UPDATE') || p.name.endsWith('_EDIT')) actions.update = hasAccess;
                    else if (p.name.endsWith('_DELETE')) actions.delete = hasAccess;
                    else if (p.name.endsWith('_EXCEL') || p.name.endsWith('_EXPORT')) actions.excel = hasAccess;
                });
                
                // If no permissions defined for a menu, maybe default to false (or true if public? let's stick to false)
                menuPermissionsMap.set(menu.id, actions);
            }
        }

        // 4. Build Tree
        const menuTree = [];
        const menuMap = new Map();

        // Create node objects
        availableMenus.forEach(menu => {
            const perms = menuPermissionsMap.get(menu.id) || { view: false, add: false, update: false, delete: false, excel: false };
            menuMap.set(menu.id, {
                id: menu.id,
                menu_code: menu.menuCode,
                menu_name: menu.menuName,
                menu_label: menu.menuLabel,
                route: menu.route,
                icon: menu.menuIcon,
                sort_order: menu.sortOrder,
                permissions: perms,
                children: [],
                parentId: menu.parentId
            });
        });

        // Assemble hierarchy
        availableMenus.forEach(menu => {
            const node = menuMap.get(menu.id);
            if (node.parentId) {
                const parent = menuMap.get(node.parentId);
                if (parent) {
                    parent.children.push(node);
                }
            } else {
                menuTree.push(node);
            }
        });

        // 5. Filter empty parents and unauthorized menus
        const filterMenuNode = (node) => {
            // Recursively filter children
            node.children = node.children.filter(filterMenuNode);
            
            // A node is visible if it has view permission OR it has visible children
            return node.permissions.view || node.children.length > 0;
        };

        const finalTree = menuTree.filter(filterMenuNode);

        // Sort children
        const sortNode = (node) => {
            node.children.sort((a, b) => a.sort_order - b.sort_order);
            node.children.forEach(sortNode);
        };
        finalTree.forEach(sortNode);

        return finalTree;
    }
}

export default new MenuService();
