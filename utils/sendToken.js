export const sendToken = (user, statusCode, message, res) => {
    const token = user.generateToken();

    const cookieExpireDays = process.env.COOKIE_EXPIRE || 5;

    const options = {
        expires: new Date(
            Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    };

    const userData = user.toJSON();
    delete userData.password;
    delete userData.tempPassword;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpire;
    delete userData.verificationCode;
    delete userData.verificationCodeExpire;

    res.status(statusCode)
        .cookie("gymshood_token", token, options)
        .json({
            success: true,
            user: userData,
            message,
            token,
        });
};