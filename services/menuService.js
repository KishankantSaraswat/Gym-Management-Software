import { ClientMenuMaster, ClientMenuPermission } from '../models/index.js';
import masterAuthzService from './masterAuthzService.js';

class MenuService {
    async getAuthorizedMenuTree(gymId, userId, branchId) {
        const authContext = await masterAuthzService.resolveAuthContext(userId, gymId, branchId);
        return authContext?.menus || [];
    }
}

export default new MenuService();
