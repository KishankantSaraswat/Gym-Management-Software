import { sequelize } from '../database/db.js';
import paymentRepository from '../repositories/paymentRepository.js';
import * as planRepository from '../repositories/planRepository.js';
import { createRazorpayInstance } from "../config/razorpay.config.js";
import crypto from "crypto";
import { User } from "../models/index.js";
import { sendEmail } from "../utils/sendEmail.js";

let razorpayInstance = null;
const getRazorpay = () => {
  if (!razorpayInstance) {
    razorpayInstance = createRazorpayInstance();
  }
  return razorpayInstance;
};

class PaymentService {
  async purchasePlan(userId, planId, paymentMode) {
    const plan = await planRepository.findPlanById(planId, null, ['gym']);
    if (!plan || !plan.isActive) throw new Error("Plan not found or inactive");
    if (!plan.gym || !plan.gym.isVerified) throw new Error("Associated gym is not verified");

    const discountedPrice = Math.round(plan.price * (1 - plan.discountPercent / 100));
    const gym = await planRepository.findGymById(plan.gymId);
    if (!gym) throw new Error("Gym not found");

    const receiptId = `plan_${planId.toString().substring(18, 24)}_${Date.now().toString().substring(6)}`;

    return await sequelize.transaction(async (t) => {
      if (discountedPrice === 0) {
        let factor = 1;
        let totalDays = 0;
        const normalizedType = plan.planType ? plan.planType.trim().toLowerCase() : "";

        if (plan.validity && plan.validity > 0) {
          totalDays = plan.validity;
          factor = plan.validity;
        } else if (normalizedType === "1 day") {
          totalDays = 1;
        } else if (normalizedType === "7 days") {
          factor = 7;
          totalDays = 7;
        } else if (normalizedType === "15 days") {
          factor = 15;
          totalDays = 15;
        } else if (normalizedType === "1 month" || normalizedType === "monthly") {
          factor = 30;
          totalDays = 30;
        } else {
          totalDays = 1;
        }

        const purchaseDate = new Date();
        const userPlan = await planRepository.createUserPlan({
          userId,
          gymId: gym.id,
          planId: plan.id,
          amountDeducted: 0,
          totalDays,
          purchaseDate,
          maxExpiryDate: new Date(purchaseDate.getTime() + factor * 24 * 60 * 60 * 1000),
          perDayCost: 0,
          planDuration: plan.duration
        }, t);

        return {
          isFree: true,
          userPlan,
          userPlanId: userPlan.id,
          walletTransactionId: null,
          discountedPrice: 0,
          isCash: false,
          message: "Free plan activated successfully"
        };
      }

      let order;
      let status = 'Pending';

      if (paymentMode === 'cash') {
        status = 'Pending Approval';
      } else {
        const orderOptions = {
          amount: discountedPrice * 100,
          currency: "INR",
          receipt: receiptId,
          notes: {
            userId: userId.toString(),
            planId: planId.toString(),
            gymId: plan.gymId.toString()
          }
        };
        order = await getRazorpay().orders.create(orderOptions);
      }

      const walletTransaction = await paymentRepository.createWalletTransaction({
        userId: userId,
        amount: discountedPrice,
        type: 'Debit',
        status: status,
        razorpayOrderId: order ? order.id : `CASH_${receiptId}`,
        reason: `Purchase of ${plan.name} plan`,
        metadata: {
          planId: plan.id,
          gymId: plan.gymId
        }
      }, t);

      return {
        order,
        walletTransactionId: walletTransaction.id,
        isCash: paymentMode === 'cash',
        discountedPrice,
        message: paymentMode === 'cash' ? "Cash payment request sent for approval" : undefined
      };
    });
  }

  async verifyPlanPayment(userId, paymentData) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, walletTransactionId } = paymentData;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      throw new Error("Payment verification failed - Invalid signature");
    }

    let walletTransaction;
    try {
      return await sequelize.transaction(async (t) => {
        walletTransaction = await paymentRepository.findWalletTransaction({
          id: walletTransactionId,
          userId,
          razorpayOrderId: razorpay_order_id,
          status: 'Pending'
        }, t);

        if (!walletTransaction) {
          throw new Error("Transaction not found or already processed");
        }

        const order = await getRazorpay().orders.fetch(razorpay_order_id);
        const orderNotes = order.notes;

        let gymId;
        if (typeof orderNotes.gymId === 'string') {
          gymId = parseInt(orderNotes.gymId);
        } else {
          throw new Error('Invalid gymId format');
        }

        if (isNaN(gymId)) {
          throw new Error('Invalid gymId format');
        }

        const plan = await planRepository.findPlanById(orderNotes.planId, t);
        const gym = await planRepository.findGymById(gymId, t);

        if (!plan || !gym) {
          throw new Error("Plan or Gym not found");
        }

        const gymShare = walletTransaction.amount;
        const platformShare = 0;

        await paymentRepository.updateWalletTransactionById(walletTransaction.id, {
          status: 'Completed',
          razorpayPaymentId: razorpay_payment_id,
          metadata: {
            planId: plan.id,
            gymId: gym.id,
          }
        }, t);

        let factor = 1;
        let totalDays = 0;
        const normalizedType = plan.planType ? plan.planType.trim().toLowerCase() : "";

        if (plan.validity && plan.validity > 0) {
          totalDays = plan.validity;
          factor = plan.validity;
        } else if (normalizedType === "1 day") {
          factor = 1;
          totalDays = 1;
        } else if (normalizedType === "7 days") {
          factor = 7;
          totalDays = 7;
        } else if (normalizedType === "15 days") {
          factor = 15;
          totalDays = 15;
        } else if (normalizedType === "1 month" || normalizedType === "monthly") {
          factor = 30;
          totalDays = 30;
        } else {
          factor = 1;
          totalDays = 1;
        }

        const userPlan = await planRepository.createUserPlan({
          userId,
          gymId: plan.gymId,
          planId: plan.id,
          amountDeducted: walletTransaction.amount,
          totalDays: totalDays,
          purchaseDate: new Date(),
          maxExpiryDate: new Date(Date.now() + factor * 24 * 60 * 60 * 1000),
          perDayCost: walletTransaction.amount / plan.validity,
          planDuration: plan.duration,
          paymentId: razorpay_payment_id,
          paymentMetadata: {
            razorpayOrderId: razorpay_order_id,
            transactionId: walletTransaction.id
          }
        }, t);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [revenue] = await paymentRepository.findOrCreateGymRevenue({ planId: plan.id, gymId: plan.gymId, date: today }, { revenue: 0, commission: 0 }, t);
        await paymentRepository.incrementGymRevenue(revenue, gymShare, platformShare, t);

        await paymentRepository.createWalletTransaction({
          userId: gym.ownerId,
          amount: gymShare,
          type: 'Credit',
          status: 'Completed',
          reason: `Revenue share for ${plan.name} plan purchase`,
          metadata: {
            userPlanId: userPlan.id,
            originalTransaction: walletTransaction.id,
            planId: plan.id,
            gymId: gym.id
          }
        }, t);

        await paymentRepository.incrementUserBalance(gym.ownerId, gymShare, t);

        // email out of transaction
        (async () => {
          try {
            const user = await User.findByPk(userId, { attributes: ["name", "email"] });
            const emailContent = `
              <h2>Hi ${user.name || "User"},</h2>
              <p>Thank you for purchasing the <strong>${plan.name}</strong> plan from <strong>${gym.name}</strong>.</p>
              <p>Here are your plan details:</p>
              <ul>
                <li><strong>Plan Name:</strong> ${plan.name}</li>
                <li><strong>Amount Paid:</strong> ₹${walletTransaction.amount}</li>
                <li><strong>Duration:</strong> ${plan.planType} (${plan.duration} hours)</li>
                <li><strong>Purchase Date:</strong> ${new Date().toLocaleDateString()}</li>
              </ul>
              <p>You can now start visiting your gym using this plan!</p>
              <p>Stay fit,<br/>Team GymsHood</p>
            `;
            await sendEmail({
              to: user.email,
              subject: "🎉 Plan Purchase Confirmation - GymsHood",
              message: emailContent
            });
          } catch (emailError) {}
        })();

        return { userPlan, amount: walletTransaction.amount };
      });
    } catch (error) {
      if (razorpay_payment_id && walletTransaction) {
        try {
          await getRazorpay().payments.refund(razorpay_payment_id, {
            amount: walletTransaction.amount * 100,
            speed: 'normal',
            notes: { reason: 'Automatic refund due to processing failure' }
          });
        } catch (refundError) {}
      }

      if (walletTransactionId) {
        await paymentRepository.updateWalletTransactionById(walletTransactionId, {
          status: 'Failed',
          error: error.message
        });
      }

      throw error;
    }
  }

  async processRefund(userPlanId, reason) {
    return await sequelize.transaction(async (t) => {
      const userPlan = await planRepository.findUserPlanById(userPlanId, t);
      if (!userPlan) throw new Error("Plan not found");

      const originalTx = await paymentRepository.findWalletTransaction({
        'metadata.userPlanId': userPlanId,
        type: 'Debit'
      }, t);

      if (!originalTx) throw new Error("Original transaction not found");

      const gymTx = await paymentRepository.findWalletTransaction({
        'metadata.originalTransaction': originalTx.id,
        type: 'Credit'
      }, t);

      const daysUsed = Math.floor((new Date() - userPlan.purchaseDate) / (1000 * 60 * 60 * 24));
      const refundAmount = Math.max(0, userPlan.amountDeducted - (daysUsed * userPlan.perDayCost));

      if (gymTx) {
        await paymentRepository.decrementUserBalance(gymTx.userId, Math.min(gymTx.amount, refundAmount), t);
      }

      const refund = await getRazorpay().payments.refund(originalTx.razorpayPaymentId, {
        amount: refundAmount * 100,
        notes: { reason }
      });

      await paymentRepository.createWalletTransaction({
        userId: userPlan.userId,
        amount: refundAmount,
        type: 'Credit',
        status: 'Completed',
        reason: `Refund for ${userPlanId}: ${reason}`,
        razorpayRefundId: refund.id,
        metadata: {
          originalTransaction: originalTx.id,
          refundReason: reason
        }
      }, t);

      userPlan.status = 'Refunded';
      userPlan.refundAmount = refundAmount;
      await planRepository.updateUserPlan(userPlan, t);

      return refundAmount;
    });
  }

  async approveCashPayment(walletTransactionId, gymOwnerId) {
    return await sequelize.transaction(async (t) => {
      const walletTransaction = await paymentRepository.findWalletTransaction({
        id: walletTransactionId,
        status: 'Pending Approval',
        type: 'Debit'
      }, t);

      if (!walletTransaction) throw new Error("Cash payment request not found or already processed");

      const plan = await planRepository.findPlanById(walletTransaction.metadata.planId, t);
      const gym = await planRepository.findGymById(walletTransaction.metadata.gymId, t);

      if (!plan || !gym) throw new Error("Plan or Gym not found");
      if (gym.ownerId !== gymOwnerId) throw new Error("You are not authorized to approve this payment");

      await paymentRepository.updateWalletTransactionById(walletTransaction.id, { status: 'Completed' }, t);

      let factor = 1;
      let totalDays = 0;

      if (plan.validity && plan.validity > 0) {
        totalDays = plan.validity;
        factor = plan.validity;
      } else {
        const normalizedType = plan.planType ? plan.planType.trim().toLowerCase() : "";
        if (normalizedType === "1 day") {
          factor = 1;
          totalDays = 1;
        } else if (normalizedType === "7 days") {
          factor = 7;
          totalDays = 7;
        } else if (normalizedType === "15 days") {
          factor = 15;
          totalDays = 15;
        } else if (normalizedType === "1 month" || normalizedType === "monthly") {
          factor = 30;
          totalDays = 30;
        } else {
          factor = 1;
          totalDays = 1;
        }
      }

      const userPlan = await planRepository.createUserPlan({
        userId: walletTransaction.userId,
        gymId: plan.gymId,
        planId: plan.id,
        amountDeducted: walletTransaction.amount,
        totalDays: totalDays,
        purchaseDate: new Date(),
        maxExpiryDate: new Date(Date.now() + factor * 24 * 60 * 60 * 1000),
        perDayCost: walletTransaction.amount / plan.validity,
        planDuration: plan.duration,
        paymentId: `CASH_${walletTransaction.id}`,
        paymentMetadata: {
          cashPaymentId: walletTransaction.id,
          transactionId: walletTransaction.id
        }
      }, t);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const adminCommission = 0;
      const [revenue] = await paymentRepository.findOrCreateGymRevenue({ planId: plan.id, gymId: plan.gymId, date: today }, { revenue: 0, commission: 0 }, t);
      await paymentRepository.incrementGymRevenue(revenue, walletTransaction.amount - adminCommission, adminCommission, t);

      await paymentRepository.createWalletTransaction({
        userId: gym.ownerId,
        amount: walletTransaction.amount,
        type: 'Credit',
        status: 'Completed',
        reason: `Cash Payment collected for ${plan.name} plan`,
        metadata: {
          userPlanId: userPlan.id,
          originalTransaction: walletTransaction.id,
          planId: plan.id,
          gymId: gym.id,
          isCashPaymentLog: true
        }
      }, t);

      (async () => {
        try {
          const user = await User.findByPk(walletTransaction.userId, { attributes: ["name", "email"] });
          const emailContent = `
            <h2>Hi ${user.name || "User"},</h2>
            <p>Your cash payment for the <strong>${plan.name}</strong> plan from <strong>${gym.name}</strong> has been approved.</p>
            <p>Here are your plan details:</p>
            <ul>
              <li><strong>Plan Name:</strong> ${plan.name}</li>
              <li><strong>Amount Paid:</strong> ₹${walletTransaction.amount}</li>
              <li><strong>Duration:</strong> ${plan.planType} (${plan.duration} hours)</li>
              <li><strong>Purchase Date:</strong> ${new Date().toLocaleDateString()}</li>
            </ul>
            <p>You can now start visiting your gym using this plan!</p>
            <p>Stay fit,<br/>Team GymsHood</p>
          `;
          await sendEmail({
            to: user.email,
            subject: "✅ Cash Payment Approved - GymsHood",
            message: emailContent
          });
        } catch (emailError) {}
      })();

      return userPlan;
    });
  }

  async rejectCashPayment(walletTransactionId, reason, gymOwnerId) {
    return await sequelize.transaction(async (t) => {
      const walletTransaction = await paymentRepository.findWalletTransaction({
        id: walletTransactionId,
        status: 'Pending Approval',
        type: 'Debit'
      }, t);

      if (!walletTransaction) throw new Error("Cash payment request not found or already processed");

      const gym = await planRepository.findGymById(walletTransaction.metadata.gymId, t);
      if (!gym) throw new Error("Gym not found");
      if (gym.ownerId !== gymOwnerId) throw new Error("You are not authorized to reject this payment");

      await paymentRepository.updateWalletTransactionById(walletTransaction.id, {
        status: 'Rejected',
        error: reason || 'Cash payment rejected by gym owner'
      }, t);

      (async () => {
        try {
          const user = await User.findByPk(walletTransaction.userId, { attributes: ["name", "email"] });
          const plan = await planRepository.findPlanById(walletTransaction.metadata.planId, null, []);
          const emailContent = `
            <h2>Hi ${user.name || "User"},</h2>
            <p>Your cash payment request for the <strong>${plan.name}</strong> plan from <strong>${gym.name}</strong> has been rejected.</p>
            <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
            <p>Please contact the gym management for more information.</p>
            <p>Thank you,<br/>Team GymsHood</p>
          `;
          await sendEmail({
            to: user.email,
            subject: "❌ Cash Payment Rejected - GymsHood",
            message: emailContent
          });
        } catch (emailError) {}
      })();

      return true;
    });
  }
  async getPendingCashRequests(gymOwnerId) {
    const gym = await planRepository.findGymByOwnerId(gymOwnerId);
    if (!gym) throw new Error("Gym not found for this owner");
    
    return await paymentRepository.findPendingCashRequests(gym.id);
  }

  async getWalletTransactions(userId) {
    if (!userId || isNaN(parseInt(userId))) {
      throw new Error("Invalid user ID");
    }
    const transactions = await paymentRepository.findUserTransactions(userId);
    return transactions || [];
  }
}

export default new PaymentService();
