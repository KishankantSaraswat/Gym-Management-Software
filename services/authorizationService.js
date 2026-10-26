import masterAuthzService from './masterAuthzService.js';
import ErrorHandler from '../middlewares/errorMiddlewares.js';

class AuthorizationService {
  /**
   * Primary authorization check: evaluates role permissions, gym feature enablement, and branch scope
   */
  async can(user, requiredPermission, gymId = null, branchId = null) {
    if (!user) return false;
    if (user.isSuperAdmin || user.role === 'Admin') return true;

    try {
      const authContext = await masterAuthzService.resolveAuthContext(user.id, gymId, branchId);
      if (!authContext) return false;

      // Check if user has permission
      const hasPermission = authContext.permissions.includes(requiredPermission);
      return hasPermission;
    } catch (err) {
      console.error('Authorization check error:', err.message);
      return false;
    }
  }

  /**
   * Enforces tenant boundary (IDOR prevention)
   */
  async assertTenantOwnership(req, targetGymId) {
    if (!targetGymId) return;
    const user = req.user;
    if (user.isSuperAdmin || user.role === 'Admin') return;

    // Client Company context (Company = Gym)
    if (req.isClientCompanyUser || user.companyId) {
      const userCompanyId = String(user.companyId || req.authContext?.company_id);
      if (String(targetGymId) === userCompanyId) {
        return;
      }
      throw new ErrorHandler('Access Denied: You do not have permission to access data belonging to this company/gym.', 403);
    }

    const authContext = await masterAuthzService.resolveAuthContext(user.id, targetGymId);
    if (!authContext || !authContext.gym || String(authContext.gym.id) !== String(targetGymId)) {
      throw new ErrorHandler('Access Denied: You do not have permission to access data belonging to this gym.', 403);
    }
  }

  /**
   * Enforces branch boundary
   */
  async assertBranchAccess(req, targetGymId, targetBranchId) {
    if (!targetBranchId) return;
    const user = req.user;
    if (user.isSuperAdmin || user.role === 'Admin') return;

    const authContext = await masterAuthzService.resolveAuthContext(user.id, targetGymId, targetBranchId);
    if (!authContext || !authContext.branch || String(authContext.branch.id) !== String(targetBranchId)) {
      throw new ErrorHandler('Access Denied: You are not authorized to perform operations in this branch.', 403);
    }
  }

  /**
   * Validates if a specific subscription feature (e.g. AI_COACH, WHATSAPP, MULTI_BRANCH) is enabled
   */
  async isFeatureEnabled(gymId, featureKey) {
    if (!gymId) return false;
    const { GymMaster, SubscriptionPlan } = await import('../models/index.js');
    const gym = await GymMaster.findByPk(gymId, {
      include: [{ model: SubscriptionPlan, as: 'subscriptionPlan' }]
    });

    if (!gym || !gym.subscriptionPlan) return false;
    const features = gym.subscriptionPlan.features || {};
    return Boolean(features[featureKey]);
  }
}

const authorizationService = new AuthorizationService();

export const can = authorizationService.can.bind(authorizationService);
export const assertTenantOwnership = authorizationService.assertTenantOwnership.bind(authorizationService);
export const assertBranchAccess = authorizationService.assertBranchAccess.bind(authorizationService);
export const isFeatureEnabled = authorizationService.isFeatureEnabled.bind(authorizationService);

export default authorizationService;

