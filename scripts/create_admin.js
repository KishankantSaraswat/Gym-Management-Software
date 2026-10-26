import bcrypt from "bcrypt";
import { connectDB, sequelize } from "../database/db.js";
import {
  AdminUser,
  UserGroup,
  UserGroupRight,
  UserMasterRight,
  UserBranchRight,
  ClientMenuMaster,
  GymBranchMaster,
  User
} from "../models/index.js";

const createMasterAdmin = async () => {
  const name = (process.env.ADMIN_NAME || "Master Admin").trim();
  const email = (process.env.ADMIN_EMAIL || "admin@gymshood.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@123";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured.");
  }

  await connectDB();

  // 1. Ensure all relevant tables exist
  await UserGroup.sync({ alter: true });
  await UserGroupRight.sync({ alter: true });
  await UserMasterRight.sync({ alter: true });
  await UserBranchRight.sync({ alter: true });
  await AdminUser.sync({ alter: true });

  const hashedPassword = await bcrypt.hash(password, 10);

  // 2. Find or create the 'Master' group in users_group_master
  let masterGroup = await UserGroup.findOne({ where: { group_name: "Master" } });
  if (!masterGroup) {
    masterGroup = await UserGroup.create({
      group_name: "Master",
      status: true,
      allow_ip: "",
      cr_usr: null,
      md_usr: null
    });
    console.log(` Created 'Master' user group in users_group_master (ID: ${masterGroup.id}).`);
  } else {
    await masterGroup.update({ status: true });
    console.log(` Found existing 'Master' user group (ID: ${masterGroup.id}).`);
  }

  // 3. Create or update the master user in admin_users
  const existingAdmin = await AdminUser.findOne({ where: { email } });
  const masterAdmin = existingAdmin
    ? await existingAdmin.update({
        name,
        password: hashedPassword,
        groupId: masterGroup.id,
        managerId: null,
        isActive: true,
        isDeleted: false
      })
    : await AdminUser.create({
        name,
        email,
        password: hashedPassword,
        groupId: masterGroup.id,
        managerId: null,
        crUsr: null,
        mdUsr: null,
        isActive: true,
        isDeleted: false
      });

  console.log(` Master Admin record ready in admin_users for ${masterAdmin.email} (ID: ${masterAdmin.id}).`);

  // 4. Provision complete rights for all pages in client_menu_master
  try {
    let menus = await ClientMenuMaster.findAll();
    // If no client menus exist yet, create default essential pages
    if (!menus.length) {
      const defaultMenus = [
        { menuCode: 'DASHBOARD', menuName: 'Dashboard', route: '/dashboard' },
        { menuCode: 'GYM_MANAGEMENT', menuName: 'Gym Management', route: '/gyms' },
        { menuCode: 'USER_MANAGEMENT', menuName: 'User Management', route: '/users' },
        { menuCode: 'PLAN_MANAGEMENT', menuName: 'Plan Management', route: '/plans' },
        { menuCode: 'PAYMENT_MANAGEMENT', menuName: 'Payment Management', route: '/payments' },
        { menuCode: 'ANNOUNCEMENTS', menuName: 'Announcements', route: '/announcements' },
        { menuCode: 'SETTINGS', menuName: 'Settings', route: '/settings' }
      ];

      for (const m of defaultMenus) {
        const created = await ClientMenuMaster.create(m);
        menus.push(created);
      }
      console.log(` Seeded ${menus.length} default menu pages in client_menu_master.`);
    }

    // Grant all rights (view, add, edit, excel, delete) to Master group
    for (const menu of menus) {
      const [grpRight] = await UserGroupRight.findOrCreate({
        where: { group_id: masterGroup.id, page_id: menu.id },
        defaults: {
          group_id: masterGroup.id,
          page_id: menu.id,
          view_right: true,
          add_right: true,
          edit_right: true,
          excel_right: true,
          delete_right: true
        }
      });
      await grpRight.update({
        view_right: true,
        add_right: true,
        edit_right: true,
        excel_right: true,
        delete_right: true
      });

      // Grant all master rights directly to the user as well
      const [usrRight] = await UserMasterRight.findOrCreate({
        where: { user_id: masterAdmin.id, page_id: menu.id },
        defaults: {
          user_id: masterAdmin.id,
          page_id: menu.id,
          view_right: true,
          add_right: true,
          edit_right: true,
          excel_right: true,
          delete_right: true
        }
      });
      await usrRight.update({
        view_right: true,
        add_right: true,
        edit_right: true,
        excel_right: true,
        delete_right: true
      });
    }
    console.log(` Configured full rights (view, add, edit, excel, delete) for all ${menus.length} pages.`);
  } catch (rightsErr) {
    console.warn(` Rights assignment notice: ${rightsErr.message}`);
  }

  // 5. Grant branch access for all branches if any exist
  try {
    const branches = await GymBranchMaster.findAll();
    for (const branch of branches) {
      await UserBranchRight.findOrCreate({
        where: { user_id: masterAdmin.id, branch_id: branch.id },
        defaults: { user_id: masterAdmin.id, branch_id: branch.id }
      });
    }
    if (branches.length) {
      console.log(` Granted access to all ${branches.length} branches.`);
    }
  } catch (branchErr) {
    console.warn(` Branch rights notice: ${branchErr.message}`);
  }

  // 6. Keep legacy User record synchronized
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      await existingUser.update({
        name,
        password: hashedPassword,
        role: "Admin",
        isSuperAdmin: true,
        accountVerified: true,
        isPwdAuth: true
      });
    } else {
      await User.create({
        name,
        email,
        password: hashedPassword,
        role: "Admin",
        isSuperAdmin: true,
        accountVerified: true,
        isPwdAuth: true
      });
    }
  } catch (legacyErr) {}

  console.log(`
=============================================================
 Master Admin Created Successfully in admin_users:
   Email:    ${email}
   Password: ${password}
   Group:    ${masterGroup.group_name} (ID: ${masterGroup.id})
   Rights:   Full (view, add, edit, excel, delete on all pages)
=============================================================
  `);
};

try {
  await createMasterAdmin();
} catch (error) {
  console.error(` Master admin creation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
