import { subscriptionRepository } from "../repositories/subscriptionRepository.js";
import { createRazorpayInstance } from "../config/razorpay.config.js";
import crypto from "crypto";
import { sequelize } from '../database/db.js';

let razorpayInstance = null;
const getRazorpay = () => {
  if (!razorpayInstance) {
    razorpayInstance = createRazorpayInstance();
  }
  return razorpayInstance;
};

export const subscriptionService = {
  getAssignedPlan: async (ownerId) => {
    const gym = await subscriptionRepository.findGymWithAssignedPlanByOwnerId(ownerId);
    if (!gym) throw { message: "Gym not found", statusCode: 404 };
    if (!gym.assignedPlan) throw { message: "No plan assigned by admin yet", statusCode: 400 };

    return {
      plan: gym.assignedPlan,
      subscriptionStatus: gym.subscriptionStatus,
      subscriptionExpiry: gym.subscriptionExpiry
    };
  },

  createSubscriptionOrder: async (ownerId) => {
    const gym = await subscriptionRepository.findGymWithAssignedPlanByOwnerId(ownerId);
    if (!gym || !gym.assignedPlan) throw { message: "Assigned plan not found", statusCode: 404 };

    const amount = gym.assignedPlan.price * 100;
    const receiptId = `sub_${gym.id.toString().substring(0, 6)}_${Date.now().toString().substring(6)}`;

    const options = {
      amount,
      currency: "INR",
      receipt: receiptId,
      notes: {
        gymId: gym.id.toString(),
        planId: gym.assignedPlan.id.toString(),
        type: "GYM_SUBSCRIPTION"
      }
    };

    const order = await getRazorpay().orders.create(options);
    return order;
  },

  verifySubscriptionPayment: async (ownerId, paymentData) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
    
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw { message: "Payment verification failed", statusCode: 400 };
    }

    try {
      return await sequelize.transaction(async (t) => {
        const gym = await subscriptionRepository.findGymByOwnerId(ownerId, { transaction: t });
        if (!gym) throw new Error("Gym not found");

        const plan = await subscriptionRepository.findAdminPlanById(gym.assignedPlanId, { transaction: t });
        if (!plan) throw new Error("Assigned plan not found");

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + plan.duration);

        const subscription = await subscriptionRepository.createSubscription({
          gymId: gym.id,
          adminPlanId: plan.id,
          startDate,
          endDate,
          status: 'active',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          amountPaid: plan.price
        }, { transaction: t });

        await subscriptionRepository.updateGym(gym, {
          subscriptionStatus: 'active',
          subscriptionExpiry: endDate
        }, { transaction: t });

        return {
          subscription,
          expiryDate: endDate
        };
      });
    } catch (error) {
      console.error("Subscription activation error:", error);
      throw { message: "Failed to activate subscription", statusCode: 500 };
    }
  },

  checkSubscriptionStatus: async (ownerId) => {
    const gym = await subscriptionRepository.findGymByOwnerId(ownerId);
    if (!gym) throw { message: "Gym not found", statusCode: 404 };

    const today = new Date();
    if (gym.subscriptionExpiry && gym.subscriptionExpiry < today) {
      await subscriptionRepository.updateGym(gym, { subscriptionStatus: 'expired' });
    }

    return {
      status: gym.subscriptionStatus,
      expiry: gym.subscriptionExpiry
    };
  }
};
