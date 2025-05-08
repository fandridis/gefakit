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
  if (!reactTemplate && !htmlTemplate) {
    const errorMsg = "No email content provided (react or html).";
    console.log(errorMsg);
    return { ok: false, error: { name: "ValidationError", message: errorMsg } };
  }
  const resend = new Resend(process.env.RESEND_KEY);

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

  if (reactTemplate) {
    emailPayload.react = reactTemplate;
  } else {
    emailPayload.html = htmlTemplate;
  }

  try {
    const res = await resend.emails.send(emailPayload as any);

    if (res.error) {
      return { ok: false, error: res.error };
    }

    return { ok: true, data: res.data };

  } catch (error) {
    console.error("[sendEmail] Exception sending email:", error);
    const message = error instanceof Error ? error.message : "Unknown error sending email";
    return { ok: false, error: { name: "SendEmailError", message } };
  }
};
