import { sendEmail } from "../../lib/emails";
import emailVerificationTemplate from "./templates/email-verification.template";
import organizationInvitationTemplate from './templates/organization-invitation.template';

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
    // TODO: Make base URL configurable (e.g., process.env.FRONTEND_URL)
    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${token}`;

    const htmlTemplate = emailVerificationTemplate({ verificationUrl });

    console.log(`Sending verification email to ${email} with URL ${verificationUrl}`);

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
    // TODO: Make base URL configurable (e.g., process.env.FRONTEND_URL)
    const invitationUrl = `${process.env.APP_URL}/accept-invitation?token=${token}`;
    // Generate HTML from the template function
    const htmlTemplate = organizationInvitationTemplate({ orgName, invitationUrl });

    const res = await sendEmail({
      to: email,
      subject: `You're invited to join ${orgName} on GefaKit!`, 
      htmlTemplate,
    });
  }

  return { sendWelcomeEmail, sendOrganizationInvitationEmail, sendVerificationEmail };
}