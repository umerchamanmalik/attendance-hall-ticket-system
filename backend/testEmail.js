require("dotenv").config();
const { sendEmail } = require("./src/services/emailService");

(async () => {
  console.log("📧 Sending test email...");
  const result = await sendEmail({
    to: process.env.EMAIL_USER, // sends to yourself
    subject: "EduTrack Email Test",
    title: "✅ Email works!",
    message:
      "If you received this, your SMTP config is correct and EduTrack can send notification emails.",
    actionText: "Open EduTrack",
    actionUrl: "/",
  });
  console.log("📬 Result:", result);
  process.exit(0);
})();
