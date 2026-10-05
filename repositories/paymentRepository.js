import { WalletTransaction, GymPlanRevenue, User, Plan } from "../models/index.js";

class PaymentRepository {
  async createWalletTransaction(data, t) {
    return await WalletTransaction.create(data, { transaction: t });
  }

  async findWalletTransaction(where, t) {
    return await WalletTransaction.findOne({ where, transaction: t });
  }

  async updateWalletTransactionById(id, data, t = null) {
    return await WalletTransaction.update(data, { where: { id }, transaction: t });
  }

  async findOrCreateGymRevenue(where, defaults, t) {
    return await GymPlanRevenue.findOrCreate({ where, defaults, transaction: t });
  }

  async incrementGymRevenue(revenueRecord, revenueAmount, commissionAmount, t) {
    return await revenueRecord.increment({ revenue: revenueAmount, commission: commissionAmount }, { transaction: t });
  }

  async incrementUserBalance(userId, amount, t) {
    return await User.increment('walletBalance', { 
      by: amount, 
      where: { id: userId }, 
      transaction: t 
    });
  }

  async decrementUserBalance(userId, amount, t) {
    const user = await User.findByPk(userId, { transaction: t });
    if (user) {
      user.walletBalance -= amount;
      await user.save({ transaction: t });
    }
    return user;
  }

  async findPendingCashRequests(gymId) {
    const transactions = await WalletTransaction.findAll({
      where: {
        status: 'Pending Approval',
        type: 'Debit',
        'metadata.gymId': gymId
      },
      include: [
        { model: User, as: 'user', attributes: ['name', 'email', 'profile_picture'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Manually attach plan data since it's stored inside JSONB metadata
    const enriched = [];
    for (let txn of transactions) {
      const data = txn.toJSON();
      if (data.metadata && data.metadata.planId) {
        data.plan = await Plan.findByPk(data.metadata.planId, {
          attributes: ['name', 'price', 'validity', 'planType', 'duration']
        });
      }
      enriched.push(data);
    }
    return enriched;
  }

  async findUserTransactions(userId) {
    return await WalletTransaction.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
  }
}

export default new PaymentRepository();
