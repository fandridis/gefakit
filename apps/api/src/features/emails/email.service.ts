import { sendEmail } from "../../lib/emails";
import emailVerificationTemplate from "./templates/email-verification.template";
import organizationInvitationTemplate from './templates/organization-invitation.template';
import passwordResetTemplate from "./templates/password-reset.template";
import otpTemplate from "./templates/otp.template";
import { envConfig } from "../../lib/env-config";

export type EmailService = ReturnType<typeof createEmailService>;

export function createEmailService() {
  async function sendWelcomeEmail({
    email,
    username,
    orgName,
  }: {
    email: string;
    username: string;
    orgName: string;
  }) {
    // TODO: Implement email sending
    console.log('Method not implemented yet');
  }

  async function sendVerificationEmail({
    email,
    token,
  }: {
    email: string;
    token: string;
  }) {
    const verificationUrl = `${envConfig.APP_URL}/verify-email?token=${token}`;

    const htmlTemplate = emailVerificationTemplate({ verificationUrl });

    await sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      htmlTemplate,
    });
  }

  async function sendOrganizationInvitationEmail({
    email,
    orgName,
    token,
  }: {
    email: string;
    orgName: string;
    token: string;
  }) {
    const invitationUrl = `${envConfig.APP_URL}/accept-invitation?token=${token}`;
    const htmlTemplate = organizationInvitationTemplate({ orgName, invitationUrl });

    const res = await sendEmail({
      to: email,
      subject: `You're invited to join ${orgName} on GefaKit!`, 
      htmlTemplate,
    });
  }

  async function sendPasswordResetEmail({
    email,
    token,
  }: {
    email: string;
    token: string;
  }) {
    const resetUrl = `${envConfig.APP_URL}/reset-password?token=${token}`;
    const htmlTemplate = passwordResetTemplate({ resetUrl });

    await sendEmail({
      to: email,
      subject: 'Reset Your GefaKit Password', 
      htmlTemplate,
    });
  }

  async function sendOtpEmail({ email, otp }: { email: string; otp: string }) {
    const htmlTemplate = otpTemplate({ otp }); 
    
    await sendEmail({
      to: email,
      subject: 'Your GefaKit Sign-In Code',
      htmlTemplate,
    });
  }

  return { 
    sendWelcomeEmail, 
    sendOrganizationInvitationEmail, 
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendOtpEmail
  };
}