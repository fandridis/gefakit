import { Kysely } from "kysely";
import { DB } from "../../db/db-types";
import { sendEmail } from "../../lib/emails";
import organizationCreatedTemplate from "./templates/organization-created.template";

export type EmailService = ReturnType<typeof createEmailService>;

export function createEmailService({ db }: { db: Kysely<DB> }) {
  async function sendWelcomeEmail(data: {
    email: string;
    username: string;
    orgName: string;
  }) {
    // TODO: Implement email sending
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

  return { sendWelcomeEmail, sendOrganizationCreatedEmail };
}