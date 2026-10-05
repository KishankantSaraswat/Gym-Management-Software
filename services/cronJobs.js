import cron from "node-cron"
import { UserPlan, UserGymLog } from "../models/index.js";

// Cron job runs every 12 hours (00:00 and 12:00)
cron.schedule('0 0,12 * * *', async () => {
  console.log('[CRON] Running streak updater...');

  try {
    const activePlans = await UserPlan.findAll({ where: { isExpired: false } });

    // Unique planIds if needed
    const userIds = activePlans.map(plan => plan.userId.toString());
    const uniqueUserIds = [...new Set(userIds)];

    for (const userId of uniqueUserIds) {
      const userGymLogs = await UserGymLog.findAll({ where: { userId } });

      for (const userGymLog of userGymLogs) {
        // TODO: streak(userGymLog); // Updated logic inside
        await userGymLog.save();
      }
    }

    console.log('[CRON] Streaks updated successfully');
  } catch (error) {
    console.error('[CRON] Error while updating streaks:', error);
  }
});
