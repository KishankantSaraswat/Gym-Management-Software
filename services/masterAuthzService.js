import { sequelize } from '../database/db.js';
import redisService from './redisService.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';

class MasterAuthzService {
  /**
   * Resolves the complete Authorization Context for a user, active gym, and branch.
   * Performs an optimized aggregation query and caches results in Redis.
   */
  async resolveAuthContext(userId, requestedGymId = null, requestedBranchId = null, forceRefresh = false) {
    // 1. Fetch core user info & authorization version
    const [userRows] = await sequelize.query(`
      SELECT 
        u."id",
        u."name",
        u."email",
        u."phone",
        u."role" as "legacy_role",
        u."isSuperAdmin" as "is_super_admin",
        u."accountVerified" as "account_verified",
        u."isDeleted" as "is_deleted",
        1 as "authz_version"
      FROM "users" u
      WHERE u."id" = :userId
    `, { replacements: { userId } });

    if (!userRows.length) {
      throw new ErrorHandler('User identity not found.', 404);
    }

    const user = userRows[0];
    if (user.is_deleted || !user.account_verified) {
      throw new ErrorHandler('User account is inactive or pending verification.', 403);
    }

    // 2. Fetch all gyms the user is authorized for
    let authorizedGyms = [];
    if (user.is_super_admin || user.legacy_role === 'Admin') {
      const [allGyms] = await sequelize.query(`
        SELECT gm."id", gm."gym_code", gm."gym_name", gm."status"
        FROM "gym_master" gm
        WHERE gm."status" = 'active'
        ORDER BY gm."id" ASC
      `);
      authorizedGyms = allGyms;
    } else {
      const [userGyms] = await sequelize.query(`
        SELECT 
          gm."id", 
          gm."gym_code", 
          gm."gym_name", 
          gm."status",
          gu."user_type" as "membership_type"
        FROM "gym_user" gu
        JOIN "gym_master" gm ON gm."id" = gu."gym_id"
        WHERE gu."user_id" = :userId AND gu."status" = 'active' AND gm."status" = 'active'
        ORDER BY gm."id" ASC
      `, { replacements: { userId } });
      authorizedGyms = userGyms;
    }

    // Determine active gym ID
    let activeGymId = null;
    if (requestedGymId && authorizedGyms.some(g => String(g.id) === String(requestedGymId))) {
      activeGymId = parseInt(requestedGymId, 10);
    } else if (authorizedGyms.length > 0) {
      activeGymId = authorizedGyms[0].id;
    }

    // 3. Check Redis cache if active gym is known and refresh not forced
    const cacheKey = `authz:u:${userId}:g:${activeGymId || 'none'}:b:${requestedBranchId || 'none'}`;
    if (!forceRefresh) {
      const cached = await redisService.get(cacheKey);
      if (cached && cached.authz_version === user.authz_version) {
        return cached;
      }
    }

    // 4. If no gym is available (e.g. member not yet joined any gym)
    if (!activeGymId) {
      const emptyContext = {
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
        gym: null,
        branch: null,
        subscription: null,
        role: user.legacy_role || 'MEMBER',
        permissions: ['MEMBER_VIEW'],
        menus: [{ code: 'DASHBOARD', name: 'Dashboard', route: '/dashboard', icon: 'fas fa-home' }],
        available_gyms: authorizedGyms,
        available_branches: [],
        authz_version: user.authz_version
      };
      await redisService.set(cacheKey, emptyContext, 1800);
      return emptyContext;
    }

    // 5. Fetch Active Gym & Subscription details
    const [gymRows] = await sequelize.query(`
      SELECT 
        gm."id",
        gm."gym_code",
        gm."gym_name",
        gm."email",
        gm."phone",
        gm."owner_id",
        sp."id" as "sub_plan_id",
        COALESCE(sp."plan_code", 'BASIC') as "sub_plan_code",
        COALESCE(sp."plan_name", 'Basic Plan') as "sub_plan_name",
        COALESCE(sp."features", '{}'::jsonb) as "sub_features"
      FROM "gym_master" gm
      LEFT JOIN "subscription_plan" sp ON sp."id" = gm."subscription_plan_id"
      WHERE gm."id" = :activeGymId
    `, { replacements: { activeGymId } });

    const activeGym = gymRows[0] || { id: activeGymId, gym_name: 'Gym', sub_plan_code: 'BASIC' };

    // 6. Fetch authorized branches for this gym
    const isOwner = user.id === activeGym.owner_id || user.is_super_admin;
    let authorizedBranches = [];

    if (isOwner) {
      const [allBranches] = await sequelize.query(`
        SELECT bm."id", bm."branch_code", bm."branch_name", bm."city", bm."address", bm."status"
        FROM "gym_branch_master" bm
        WHERE bm."gym_id" = :activeGymId AND bm."status" = 'active'
        ORDER BY bm."id" ASC
      `, { replacements: { activeGymId } });
      authorizedBranches = allBranches;
    } else {
      const [userBranches] = await sequelize.query(`
        SELECT bm."id", bm."branch_code", bm."branch_name", bm."city", bm."address", bm."status"
        FROM "gym_branch_user" gbu
        JOIN "gym_branch_master" bm ON bm."id" = gbu."branch_id"
        WHERE gbu."gym_user_id" IN (
          SELECT "id" FROM "gym_user" WHERE "user_id" = :userId AND "gym_id" = :activeGymId
        )
        AND gbu."is_active" = true AND bm."status" = 'active'
        ORDER BY bm."id" ASC
      `, { replacements: { userId, activeGymId } });
      authorizedBranches = userBranches;
    }

    // Determine active branch ID
    let activeBranch = null;
    if (requestedBranchId && authorizedBranches.some(b => String(b.id) === String(requestedBranchId))) {
      activeBranch = authorizedBranches.find(b => String(b.id) === String(requestedBranchId));
    } else if (authorizedBranches.length > 0) {
      activeBranch = authorizedBranches[0];
    }

    const activeBranchId = activeBranch ? activeBranch.id : null;

    // 7. Resolve Roles and Permissions
    let roleCode = isOwner ? 'GYM_OWNER' : 'MEMBER';
    let effectivePermissions = [];

    if (user.is_super_admin) {
      roleCode = 'SUPER_ADMIN';
      const [allPerms] = await sequelize.query(`SELECT "permission_code" FROM "user_permission_master" WHERE "is_active" = true`);
      effectivePermissions = allPerms.map(p => p.permission_code);
    } else if (isOwner) {
      roleCode = 'GYM_OWNER';
      // All permissions enabled for this gym tenant
      const [ownerPerms] = await sequelize.query(`
        SELECT upm."permission_code"
        FROM "gym_permission" gp
        JOIN "user_permission_master" upm ON upm."id" = gp."permission_id"
        WHERE gp."gym_id" = :activeGymId AND gp."is_enabled" = true AND upm."is_active" = true
      `, { replacements: { activeGymId } });
      effectivePermissions = ownerPerms.map(p => p.permission_code);
    } else {
      // Resolve staff/member group roles
      const [groupRows] = await sequelize.query(`
        SELECT DISTINCT ugm."group_code", ugm."id" as "group_id", gug."is_primary"
        FROM "gym_user_group" gug
        JOIN "user_group_master" ugm ON ugm."id" = gug."group_id"
        JOIN "gym_user" gu ON gu."id" = gug."gym_user_id"
        WHERE gu."user_id" = :userId 
          AND gu."gym_id" = :activeGymId 
          AND gug."is_active" = true
          AND (gug."branch_id" IS NULL OR gug."branch_id" = :activeBranchId)
        ORDER BY gug."is_primary" DESC, ugm."id" ASC
      `, { replacements: { userId, activeGymId, activeBranchId: activeBranch?.id || -1 } });

      if (groupRows.length > 0) {
        roleCode = groupRows[0].group_code;
        const groupIds = groupRows.map(g => g.group_id);

        // Permissions granted by all assigned roles INTERSECTED with gym-enabled feature permissions
        const [rolePerms] = await sequelize.query(`
          SELECT DISTINCT upm."permission_code"
          FROM "user_group_permission" ugp
          JOIN "user_permission_master" upm ON upm."id" = ugp."permission_id"
          JOIN "gym_permission" gp ON gp."permission_id" = upm."id" AND gp."gym_id" = :activeGymId
          WHERE ugp."group_id" IN (:groupIds) 
            AND ugp."is_active" = true 
            AND ugp."can_view" = true
            AND gp."is_enabled" = true
            AND upm."is_active" = true
        `, { replacements: { groupIds, activeGymId } });

        effectivePermissions = rolePerms.map(p => p.permission_code);
      } else {
        effectivePermissions = ['ATTENDANCE_VIEW', 'ATTENDANCE_CREATE', 'PLAN_VIEW', 'WORKOUT_VIEW'];
      }
    }

    // 8. Dynamic Menu Resolution based on effective permissions
    const [menuRows] = await sequelize.query(`
      SELECT DISTINCT
        cmm."id",
        cmm."parent_id",
        cmm."menu_code",
        cmm."menu_name",
        cmm."route",
        cmm."icon",
        cmm."sort_order"
      FROM "client_menu_master" cmm
      LEFT JOIN "client_menu_permission" cmp ON cmp."menu_id" = cmm."id"
      LEFT JOIN "user_permission_master" upm ON upm."id" = cmp."permission_id"
      WHERE cmm."is_active" = true
        AND (
          cmp."id" IS NULL 
          OR upm."permission_code" IN (:effectivePermissions)
        )
      ORDER BY cmm."sort_order" ASC
    `, { replacements: { effectivePermissions: effectivePermissions.length ? effectivePermissions : ['NONE'] } });

    const menus = menuRows.map(m => ({
      id: m.id,
      code: m.menu_code,
      name: m.menu_name,
      route: m.route,
      icon: m.icon,
      parent_id: m.parent_id
    }));

    // 9. Construct Final Authorization Context
    const authContext = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      gym: {
        id: activeGym.id,
        code: activeGym.gym_code,
        name: activeGym.gym_name
      },
      branch: activeBranch ? {
        id: activeBranch.id,
        code: activeBranch.branch_code,
        name: activeBranch.branch_name,
        city: activeBranch.city
      } : null,
      subscription: {
        code: activeGym.sub_plan_code,
        name: activeGym.sub_plan_name,
        features: activeGym.sub_features
      },
      role: roleCode,
      permissions: effectivePermissions,
      menus,
      available_gyms: authorizedGyms.map(g => ({ id: g.id, code: g.gym_code, name: g.gym_name })),
      available_branches: authorizedBranches.map(b => ({ id: b.id, code: b.branch_code, name: b.branch_name })),
      authz_version: user.authz_version
    };

    // 10. Cache in Redis
    await redisService.set(cacheKey, authContext, 3600); // 1 hour TTL

    return authContext;
  }

  /**
   * Increments authz_version for a user or tenant, invalidating cached authorization context
   */
  async invalidateAuthzVersion(userId, gymId = null) {
    if (userId) {
      await sequelize.query(`
        UPDATE "users" 
        SET "authz_version" = COALESCE("authz_version", 1) + 1, "updatedAt" = NOW()
        WHERE "id" = :userId
      `, { replacements: { userId } });
      await redisService.invalidatePattern(`authz:u:${userId}:*`);
    } else if (gymId) {
      // Invalidate all users in this gym
      const [members] = await sequelize.query(`
        SELECT "user_id" FROM "gym_user" WHERE "gym_id" = :gymId
      `, { replacements: { gymId } });

      for (const m of members) {
        await this.invalidateAuthzVersion(m.user_id);
      }
    }
  }

  /**
   * Invalidates cached authorization context and increments version
   */
  async invalidateUserAuthz(userId, gymId = null) {
    if (userId) {
      await redisService.invalidatePattern(`authz:u:${userId}:*`);
    } else {
      await redisService.invalidatePattern(`authz:*`);
    }
    return await this.invalidateAuthzVersion(userId, gymId);
  }
}

export default new MasterAuthzService();
