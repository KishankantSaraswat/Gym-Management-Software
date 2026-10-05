import { User, UserData } from "../models/index.js";
import { Op } from "sequelize";

export const findUserByEmail = async (email) => {
  return await User.findOne({ where: { email } });
};

export const findUserByEmailAndRole = async (email, role) => {
  return await User.findOne({ where: { email, accountVerified: true, role } });
};

export const findUserById = async (id) => {
  return await User.findByPk(id);
};

export const findUserByRegistrationSession = async (email, registrationSessionId) => {
  return await User.findOne({
    where: {
      email,
      registrationSessionId,
    }
  });
};

export const findUserByResetSession = async (resetSessionId) => {
  return await User.findOne({
    where: {
      resetPasswordSessionId: resetSessionId,
      resetPasswordSessionExpire: { [Op.gt]: new Date() },
    }
  });
};

export const findUserByEmailVerified = async (email) => {
  return await User.findOne({ where: { email, accountVerified: true } });
};

export const createUser = async (userData) => {
  return await User.create(userData);
};

export const createUserData = async (data) => {
  return await UserData.create(data);
};

export const findUserDataByUserId = async (userId) => {
  return await UserData.findOne({ where: { userId } });
};

export const upsertUserData = async (data) => {
  return await UserData.upsert(data, { returning: true });
};

export const deleteUserDataByUserId = async (userId) => {
  return await UserData.destroy({ where: { userId } });
};
