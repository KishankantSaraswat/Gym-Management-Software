import bcrypt from "bcrypt";
import { connectDB, sequelize } from "../database/db.js";
import { User } from "../models/index.js";

const createAdmin = async () => {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in config/config.env or the environment.");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters long.");
  }

  await connectDB();

  const existingUser = await User.findOne({ where: { email } });
  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = existingUser
    ? await existingUser.update({
        name,
        password: hashedPassword,
        role: "Admin",
        isSuperAdmin: true,
        accountVerified: true,
        isPwdAuth: true,
        googleId: null,
        registrationSessionId: null,
        verificationCode: null,
        verificationCodeExpire: null,
      })
    : await User.create({
        name,
        email,
        password: hashedPassword,
        role: "Admin",
        isSuperAdmin: true,
        accountVerified: true,
        isPwdAuth: true,
      });

  console.log(`Super-admin account ready for ${admin.email}.`);
};

try {
  await createAdmin();
} catch (error) {
  console.error(`Admin creation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
