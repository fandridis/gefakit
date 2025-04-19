import { Kysely } from "kysely";
import { DB } from "../../db/db-types";
import { sendEmail } from "../../lib/emails";
import organizationCreatedTemplate from "./templates/organization-created.template";
import emailVerificationTemplate from "./templates/email-verification.template";

export type EmailService = ReturnType<typeof createEmailService>;

export function createEmailService({ db }: { db: Kysely<DB> }) {
  async function sendWelcomeEmail(data: {
    email: string;
    username: string;
    orgName: string;
  }) {
    // TODO: Implement email sending
    console.log('Method not implemented yet');
  }

  async function sendVerificationEmail(data: {
    email: string;
    token: string;
  }) {
    // TODO: Make base URL configurable (e.g., process.env.FRONTEND_URL)
    const verificationUrl = `http://localhost:5173/verify-email?token=${data.token}`;

    const htmlTemplate = emailVerificationTemplate({ verificationUrl });

    console.log(`Sending verification email to ${data.email} with URL ${verificationUrl}`);

    await sendEmail({
      to: data.email,
      subject: 'Verify Your Email Address',
      htmlTemplate,
    });
  }

  async function sendOrganizationCreatedEmail(data: {
    email: string;
    orgName: string;
  }) {
    // Generate HTML from the template function
    const htmlTemplate = organizationCreatedTemplate({ orgName: data.orgName });

    const res = sendEmail({
      to: 'fandridis@gmail.com', // data.email, // TODO: Use actual recipient email
      subject: `Welcome to ${data.orgName}!`, 
      htmlTemplate,
    });
  }

  return { sendWelcomeEmail, sendOrganizationCreatedEmail, sendVerificationEmail };
}