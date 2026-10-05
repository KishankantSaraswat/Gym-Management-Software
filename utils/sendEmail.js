import nodeMailer from "nodemailer";

export const sendEmail = async ({ to, subject, message }) => {
    try {
        const transporter = nodeMailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            service: process.env.SMTP_SERVICE,
            secure: parseInt(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_MAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        await transporter.verify();

        const mailOptions = {
            from: process.env.SMTP_MAIL,
            to,
            subject,
            html: message,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("❌ Failed to send email:", error);
        console.error("❌ Error details:", {
            message: error.message,
            code: error.code,
            command: error.command
        });
        throw new Error("Failed to send email: " + error.message);
    }
};
