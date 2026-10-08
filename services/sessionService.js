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
      gymId,
      branchId,
      deviceId,
      ipAddress,
      userAgent,
      authzVersion,
      expiresAt
    });

    // Compact JWT Payload
    const secretKey = (process.env.JWT_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
    const token = jwt.sign({
      sub: String(user.id),
      id: user.id, // compatibility with existing controllers
      gym_id: gymId ? String(gymId) : null,
      branch_id: branchId ? String(branchId) : null,
      session_id: sessionId,
      authz_version: authzVersion
    }, secretKey, {
      expiresIn: `${expiresInDays}d`
    });

    // Warm-up Redis authorization cache for this session
    await masterAuthzService.resolveAuthContext(user.id, gymId, branchId, true);

    return { token, sessionId, expiresAt };
  }

  /**
   * Validates session existence and revocation status
   */
  async validateSession(sessionId) {
    if (!sessionId) return true; // Fallback for legacy tokens without session_id

    const session = await UserSession.findOne({
      where: { sessionId }
    });

    if (!session) return false;
    if (session.revokedAt) return false;
    if (new Date(session.expiresAt) < new Date()) return false;

    return true;
  }

  /**
   * Revokes a specific session (single device logout)
   */
  async revokeSession(sessionId) {
    if (!sessionId) return;
    await UserSession.update(
      { revokedAt: new Date() },
      { where: { sessionId } }
    );
  }

  /**
   * Revokes all active sessions for a user (logout all devices)
   */
  async revokeAllUserSessions(userId) {
    await UserSession.update(
      { revokedAt: new Date() },
      { where: { userId, revokedAt: null } }
    );
    await masterAuthzService.invalidateAuthzVersion(userId);
  }
}

export default new SessionService();

