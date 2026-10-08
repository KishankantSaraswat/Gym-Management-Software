import { AuditLog } from '../models/index.js';

class AuditService {
  /**
   * Records a security or business audit log entry asynchronously
   */
  async log({
    actorUserId = null,
    gymId = null,
    branchId = null,
    action,
    resourceType,
    resourceId = null,
    oldValue = null,
    newValue = null,
    req = null
  }) {
    try {
      let ipAddress = null;
      let userAgent = null;

      if (req) {
        ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
        userAgent = req.headers['user-agent'] || null;
        if (!actorUserId && req.user) actorUserId = req.user.id;
        if (!gymId && req.gym) gymId = req.gym.id;
        if (!branchId && req.branch) branchId = req.branch.id;
      }

      await AuditLog.create({
        actorUserId,
        gymId,
        branchId,
        action,
        resourceType,
        resourceId: resourceId ? String(resourceId) : null,
        oldValue: oldValue ? oldValue : null,
        newValue: newValue ? newValue : null,
        ipAddress: ipAddress ? String(ipAddress).substring(0, 50) : null,
        userAgent: userAgent ? String(userAgent) : null
      });
    } catch (err) {
      console.error('⚠️ Audit Logging Error (non-blocking):', err.message);
    }
  }
}

export default new AuditService();

