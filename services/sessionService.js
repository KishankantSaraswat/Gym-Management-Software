import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserSession, User } from '../models/index.js';
import redisService from './redisService.js';
import masterAuthzService from './masterAuthzService.js';

class SessionService {
  /**
   * Creates an active user session and generates a compact JWT
   */
  async createSession({
    user,
    userType = 'User',
    gymId = null,
    branchId = null,
    deviceId = null,
    ipAddress = null,
    userAgent = null,
    expiresInDays = 7
  }) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const authzVersion = user.authz_version || 1;

    // Persist session to PostgreSQL
    const session = await UserSession.create({
      sessionId,
      userId: user.id,
      userType,
      gymId,
      branchId,
      deviceId,
      ipAddress,
      userAgent,
      authzVersion,
      expiresAt
    });

    // Also store active session in Redis for ultra-fast lookup & revocation checks
    try {
      await redisService.set(
        `sess:${sessionId}`,
        {
          userId: user.id,
          userType,
          gymId,
          branchId,
          expiresAt: expiresAt.toISOString()
        },
        expiresInDays * 24 * 60 * 60
      );
    } catch (e) {
      console.warn("⚠️ Redis session cache warning:", e.message);
    }

    // Compact JWT Payload
    const secretKey = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
    const token = jwt.sign({
      sub: String(user.id),
      id: user.id, // compatibility with existing controllers
      gym_id: gymId ? String(gymId) : null,
      branch_id: branchId ? String(branchId) : null,
      session_id: sessionId,
      authz_version: authzVersion,
      userType
    }, secretKey, {
      expiresIn: `${expiresInDays}d`
    });

    // Warm-up Redis authorization cache for this session if regular User
    if (userType === 'User') {
      try {
        await masterAuthzService.resolveAuthContext(user.id, gymId, branchId, true);
      } catch (e) {}
    }

    return { token, sessionId, expiresAt };
  }

  /**
   * Creates an active admin user session (Rights-based, No roles)
   */
  async createAdminSession({
    admin,
    rights = {},
    branches = [],
    ipAddress = null,
    userAgent = null,
    expiresInDays = 7
  }) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const groupId = admin.groupId || admin.group_id || null;

    // Persist session to PostgreSQL
    try {
      await UserSession.create({
        sessionId,
        userId: admin.id,
        userType: 'AdminUser',
        ipAddress,
        userAgent,
        expiresAt
      });
    } catch (e) {
      console.warn("⚠️ UserSession db persist warning for admin:", e.message);
    }

    // Save session in Redis
    try {
      await redisService.set(
        `sess:${sessionId}`,
        {
          adminId: admin.id,
          userId: admin.id,
          userType: 'AdminUser',
          email: admin.email,
          groupId,
          rights,
          branches,
          isAdminUser: true,
          expiresAt: expiresAt.toISOString()
        },
        expiresInDays * 24 * 60 * 60
      );
    } catch (e) {
      console.warn("⚠️ Redis admin session cache warning:", e.message);
    }

    const secretKey = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
    const token = jwt.sign({
      sub: String(admin.id),
      id: admin.id,
      email: admin.email,
      group_id: groupId,
      isAdminUser: true,
      userType: 'AdminUser',
      session_id: sessionId
    }, secretKey, {
      expiresIn: `${expiresInDays}d`
    });

    return { token, sessionId, expiresAt };
  }

  /**
   * Checks whether the user has an existing active, unexpired, unrevoked session.
   * If currentSessionId is provided, ignores that specific session.
   */
  async hasActiveSession(userId, userType = 'User', currentSessionId = null) {
    if (!userId) return false;
    try {
      const { Op } = await import('sequelize');
      const whereClause = {
        userId,
        userType,
        revokedAt: null,
        expiresAt: { [Op.gt]: new Date() }
      };

      if (currentSessionId) {
        whereClause.sessionId = { [Op.ne]: currentSessionId };
      }

      const activeSession = await UserSession.findOne({
        where: whereClause,
        order: [['created_at', 'DESC']]
      });

      return !!activeSession;
    } catch (err) {
      console.error('Error checking active session:', err.message);
      return false;
    }
  }

  /**
   * Validates session existence and revocation status
   */
  async validateSession(sessionId) {
    if (!sessionId) return false;

    // Check Redis session cache first
    try {
      const redisSession = await redisService.get(`sess:${sessionId}`);
      if (redisSession) {
        if (redisSession.revoked) return false;
        if (redisSession.expiresAt && new Date(redisSession.expiresAt) < new Date()) return false;
        return true;
      }
    } catch (e) {}

    // Fallback: check PostgreSQL user_session table
    try {
      const session = await UserSession.findOne({
        where: { sessionId }
      });

      if (!session) {
        return false;
      }
      if (session.revokedAt) return false;
      if (new Date(session.expiresAt) < new Date()) return false;

      // Re-seed Redis so subsequent requests don't hit the DB
      try {
        const remainingSeconds = Math.max(1, Math.floor((new Date(session.expiresAt) - Date.now()) / 1000));
        await redisService.set(
          `sess:${sessionId}`,
          {
            userId: session.userId,
            userType: session.userType,
            gymId: session.gymId,
            branchId: session.branchId,
            expiresAt: session.expiresAt.toISOString()
          },
          remainingSeconds
        );
      } catch (e) {}

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Revokes a specific session (single device logout)
   */
  async revokeSession(sessionId) {
    if (!sessionId) return;
    try {
      // Set explicit revoked flag in Redis for 1 hour to prevent any stale hits
      await redisService.set(`sess:${sessionId}`, { revoked: true }, 3600);
    } catch (e) {}
    try {
      await UserSession.update(
        { revokedAt: new Date() },
        { where: { sessionId } }
      );
    } catch (e) {}
  }

  /**
   * Revokes all active sessions for a user (logout all devices or session override)
   */
  async revokeAllUserSessions(userId, userType = 'User') {
    if (!userId) return;
    try {
      const { Op } = await import('sequelize');
      // Find all active session IDs to clear and revoke in Redis
      const sessions = await UserSession.findAll({
        where: {
          userId,
          userType,
          revokedAt: null,
          expiresAt: { [Op.gt]: new Date() }
        },
        attributes: ['sessionId']
      });

      for (const s of sessions) {
        try {
          await redisService.set(`sess:${s.sessionId}`, { revoked: true }, 3600);
        } catch (e) {}
      }

      await UserSession.update(
        { revokedAt: new Date() },
        {
          where: {
            userId,
            userType,
            revokedAt: null
          }
        }
      );
      if (userType === 'User') {
        await masterAuthzService.invalidateAuthzVersion(userId);
      }
    } catch (err) {
      console.error('Error revoking user sessions:', err.message);
    }
  }
}

export default new SessionService();

