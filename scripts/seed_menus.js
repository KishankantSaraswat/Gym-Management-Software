import { GlobalMenuMaster, UserGroup, UserGroupRight } from '../models/index.js';

const menusData = [
  { menuCode: 'DASHBOARD', menuName: 'Dashboard', route: '/dashboard', icon: 'layout-dashboard', sortOrder: 1, parentCode: null },
  { menuCode: 'USERS_ROLES', menuName: 'Users & Roles', route: '/admin/users-and-roles', icon: 'users', sortOrder: 2, parentCode: null },
  { menuCode: 'USER_GROUPS', menuName: 'User Group', route: '/admin/groups', icon: 'shield-check', sortOrder: 1, parentCode: 'USERS_ROLES' },
  { menuCode: 'GROUP_PERMISSIONS', menuName: 'Group Permission', route: '/admin/permissions', icon: 'key-round', sortOrder: 2, parentCode: 'USERS_ROLES' },
  { menuCode: 'USER_MASTER', menuName: 'Users', route: '/admin/users', icon: 'user', sortOrder: 3, parentCode: 'USERS_ROLES' },
  { menuCode: 'USER_PERMISSIONS', menuName: 'User Permissions', route: '/admin/user-permissions', icon: 'lock', sortOrder: 4, parentCode: 'USERS_ROLES' },
  { menuCode: 'GLOBAL_MENUS', menuName: 'Menu Master', route: '/admin/menus', icon: 'layers', sortOrder: 3, parentCode: null },
  { menuCode: 'COMPANY_MASTER', menuName: 'Company Master', route: '/admin/companies', icon: 'building', sortOrder: 4, parentCode: null },
  { menuCode: 'GYM_PARTNERS', menuName: 'Gym Partners', route: '/admin/gyms', icon: 'dumbbell', sortOrder: 5, parentCode: null },
  { menuCode: 'GYM_OWNERS', menuName: 'Gym Owners', route: '/admin/gym-owners', icon: 'user-check', sortOrder: 6, parentCode: null },
  { menuCode: 'MEMBERS', menuName: 'Members Network', route: '/members', icon: 'users', sortOrder: 7, parentCode: null },
  { menuCode: 'MEMBERS_LIST', menuName: 'All Members', route: '/members/list', icon: 'user-check', sortOrder: 1, parentCode: 'MEMBERS' },
  { menuCode: 'LEADS', menuName: 'Leads & Enquiries', route: '/admin/leads', icon: 'trending-up', sortOrder: 8, parentCode: null },
  { menuCode: 'ADMIN_PLANS', menuName: 'Subscription Plans', route: '/admin/plans', icon: 'coins', sortOrder: 9, parentCode: null },
  { menuCode: 'SETTLEMENTS', menuName: 'Settlement Requests', route: '/admin/settlements', icon: 'wallet', sortOrder: 10, parentCode: null },
  { menuCode: 'COMMISSION', menuName: 'Commission Settings', route: '/admin/commission', icon: 'coins', sortOrder: 11, parentCode: null },
  { menuCode: 'ATTENDANCE', menuName: 'Attendance Overview', route: '/admin/attendance', icon: 'check-check', sortOrder: 12, parentCode: null },
  { menuCode: 'TRAINERS', menuName: 'Trainers Directory', route: '/admin/trainers', icon: 'award', sortOrder: 13, parentCode: null },
  { menuCode: 'REPORTS', menuName: 'Reports & Analytics', route: '/admin/revenue', icon: 'bar-chart', sortOrder: 14, parentCode: null },
  { menuCode: 'ANNOUNCEMENTS', menuName: 'Announcements', route: '/admin/announcements', icon: 'bell', sortOrder: 15, parentCode: null }
];

async function seedMenus() {
  const codeToId = {};

  // First pass: upsert root menus
  for (const item of menusData) {
    if (!item.parentCode) {
      let [menu] = await GlobalMenuMaster.findOrCreate({
        where: { menuCode: item.menuCode },
        defaults: {
          menuName: item.menuName,
          menuLabel: item.menuName,
          route: item.route,
          icon: item.icon,
          sortOrder: item.sortOrder,
          menuType: 'sidebar',
          platform: 'web',
          isActive: true
        }
      });
      menu.menuName = item.menuName;
      menu.menuLabel = item.menuName;
      menu.route = item.route;
      menu.icon = item.icon;
      menu.sortOrder = item.sortOrder;
      menu.isActive = true;
      await menu.save();
      codeToId[item.menuCode] = menu.id;
    }
  }

  // Second pass: upsert child menus
  for (const item of menusData) {
    if (item.parentCode) {
      const parentId = codeToId[item.parentCode] || null;
      let [menu] = await GlobalMenuMaster.findOrCreate({
        where: { menuCode: item.menuCode },
        defaults: {
          parentId,
          menuName: item.menuName,
          menuLabel: item.menuName,
          route: item.route,
          icon: item.icon,
          sortOrder: item.sortOrder,
          menuType: 'sidebar',
          platform: 'web',
          isActive: true
        }
      });
      menu.parentId = parentId;
      menu.menuName = item.menuName;
      menu.menuLabel = item.menuName;
      menu.route = item.route;
      menu.icon = item.icon;
      menu.sortOrder = item.sortOrder;
      menu.isActive = true;
      await menu.save();
      codeToId[item.menuCode] = menu.id;
    }
  }

  // Grant full permissions to Master group
  const masterGroup = await UserGroup.findOne({ where: { group_name: 'Master' } });
  if (masterGroup) {
    for (const code of Object.keys(codeToId)) {
      const pageId = codeToId[code];
      const existing = await UserGroupRight.findOne({ where: { group_id: masterGroup.id, page_id: pageId } });
      if (existing) {
        existing.view_right = true;
        existing.add_right = true;
        existing.edit_right = true;
        existing.excel_right = true;
        existing.delete_right = true;
        await existing.save();
      } else {
        await UserGroupRight.create({
          group_id: masterGroup.id,
          page_id: pageId,
          view_right: true,
          add_right: true,
          edit_right: true,
          excel_right: true,
          delete_right: true
        });
      }
    }
    console.log('Master group granted full rights to all menus.');
  }

  const allInDb = await GlobalMenuMaster.findAll({
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });

  console.log('Successfully saved all menus! Total count in DB: ' + allInDb.length);
  for (const m of allInDb) {
    console.log(`[${m.id}] ${m.menuCode} -> ${m.menuName} (${m.route}) parent: ${m.parentId}`);
  }
}

seedMenus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding menus:', err);
    process.exit(1);
  });
