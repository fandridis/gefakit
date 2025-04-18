// lib/emails/index.ts
import { Resend } from "resend";

export const EMAIL_CONFIG = {
  FROM: "hello@app.orcavo.com",
};

type SendEmailProps = {
  to: string;
  subject: string;
  reactTemplate?: React.ReactNode;
  htmlTemplate?: string;
};

export const sendEmail = async ({ to, subject, reactTemplate, htmlTemplate }: SendEmailProps) => {
  console.log("[sendEmail] Sending email to::", to);

  // Ensure at least one template is provided
  if (!reactTemplate && !htmlTemplate) {
    console.log('no react or html template');
    const errorMsg = "No email content provided (react or html).";
    console.error(`[sendEmail] Error: ${errorMsg}`);
    // Match Resend error structure loosely
    return { ok: false, error: { name: "ValidationError", message: errorMsg } };
  }
  console.log('Yes react or html template: ,', process.env.RESEND_KEY);

  const resend = new Resend(process.env.RESEND_KEY);

  console.log('resend key', process.env.RESEND_KEY);

  // Base payload
  const emailPayload: {
    from: string;
    to: string;
    subject: string;
    react?: React.ReactNode;
    html?: string;
  } = {
    from: EMAIL_CONFIG.FROM,
    to,
    subject,
  };

  // Conditionally add the template
  if (reactTemplate) {
    emailPayload.react = reactTemplate;
  } else {
    // htmlTemplate must be defined due to the check above
    emailPayload.html = htmlTemplate;
  }

  try {
    // Cast payload to 'any' to bypass potentially inaccurate strict type check
    const res = await resend.emails.send(emailPayload as any);

    if (res.error) {
      console.error("[sendEmail] Resend API Error:", res.error);
      return { ok: false, error: res.error };
    }

    console.log("[sendEmail] Email sent successfully to:", to);
    return { ok: true, data: res.data };

  } catch (error) {
      console.error("[sendEmail] Exception sending email:", error);
      // Adapt error structure to be consistent
      const message = error instanceof Error ? error.message : "Unknown error sending email";
      return { ok: false, error: { name: "SendEmailError", message } };
  }
};
