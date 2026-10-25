const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: Number(process.env.EMAIL_PORT || 587) === 465,
  auth:
    process.env.EMAIL_USER && process.env.EMAIL_PASS
      ? {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        }
      : undefined,
});

const buildEmailTemplate = ({ title, message, actionText, actionUrl }) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const finalActionUrl = actionUrl?.startsWith("http")
    ? actionUrl
    : `${baseUrl}${actionUrl || "/"}`;

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
              <tr>
                <td style="background:linear-gradient(135deg,#0f172a,#1d4ed8);padding:24px 32px;color:#ffffff;">
                  <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:0.9;">EduTrack</div>
                  <h1 style="margin:12px 0 0;font-size:28px;line-height:1.3;">${title}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:28px 32px 20px;color:#1f2937;">
                  <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">${message}</p>
                  <div style="margin:22px 0;">
                    <a href="${finalActionUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">${actionText || "View Details"}</a>
                  </div>
                  <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.7;">
                    This is an automated message from EduTrack - Attendance Hall Ticket System.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 28px;">
                  <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:12px;color:#6b7280;">
                    EduTrack - Attendance Hall Ticket System
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const sendEmail = async ({
  to,
  subject,
  html,
  title,
  message,
  actionText,
  actionUrl,
}) => {
  try {
    if (!to) {
      return { success: false, message: "No recipient email provided" };
    }

    if (
      !process.env.EMAIL_HOST ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      console.warn("⚠️ Email is not configured. Skipping email send.");
      return { success: false, message: "Email not configured" };
    }

    const mailOptions = {
      from: `"AHS - Attendance Hall Ticket System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html:
        html ||
        buildEmailTemplate({
          title: title || "EduTrack Update",
          message: message || "You have a new update.",
          actionText: actionText || "View Details",
          actionUrl: actionUrl || "/",
        }),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
