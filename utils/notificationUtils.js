import admin from 'firebase-admin';
import { Op } from 'sequelize';
import { User } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const initializeFirebase = () => {
    try {
        if (admin.apps.length > 0) return;

        const serviceAccountPath = path.join(__dirname, '../config/serviceAccountKey.json');

        if (fs.existsSync(serviceAccountPath)) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountPath)
            });
            console.log("✅ Firebase Admin initialized successfully.");
        } else {
            console.warn("⚠️ Firebase Admin could not be initialized: serviceAccountKey.json not found in config/ directory.");
            console.warn("Push notifications will be disabled until the service account key is provided.");
        }
    } catch (error) {
        console.error("❌ Error initializing Firebase Admin:", error.message);
    }
};

initializeFirebase();

/**
 * Send push notification to multiple users
 * @param {Array} userIds - Array of User IDs
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Optional data payload
 */
export const sendPushNotification = async (userIds, title, body, data = {}) => {
    if (admin.apps.length === 0) {
        console.warn("⏭️ Skipping push notification: Firebase not initialized.");
        return;
    }

    try {
        console.log(`🔍 Searching FCM tokens for ${userIds.length} user(s)...`);
        // Find users with valid fcmToken
        const users = await User.findAll({
            where: {
                id: { [Op.in]: userIds },
                fcmToken: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
            },
            attributes: ['id', 'fcmToken', 'name']
        });

        console.log(`👤 Found ${users.length} user(s) with registered tokens in DB.`);
        const tokens = users.map(user => user.fcmToken).filter(token => token);

        if (tokens.length === 0) {
            console.log("ℹ️ No valid FCM tokens found for these target users. Notification will not be sent.");
            return;
        }

        const message = {
            notification: {
                title,
                body,
            },
            data: {
                ...data,
                click_action: "FLUTTER_NOTIFICATION_CLICK", // For mobile apps
            },
            tokens: tokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`🚀 ${response.successCount} notifications sent successfully out of ${tokens.length}`);

        if (response.failureCount > 0) {
            console.warn(`❌ ${response.failureCount} notifications failed to send.`);
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`  - Error for token at index ${idx}:`, resp.error.code, resp.error.message);
                }
            });
        }
    } catch (error) {
        console.error("❌ Critical error in sendPushNotification:", error);
    }
};
