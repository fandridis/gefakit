import { getTranslations } from "next-intl/server";
import { OrganizationInvitationTemplate } from "../templates/organization-invitation-template";
import { OtpEmailTemplate } from "../templates/otp-template";
import { sendReactEmail } from "@/lib/email";

export function createEmailService() {

  return {
    sendSignInOtpCode: async ({ email, otp }: { email: string; otp: string }, locale?: string) => {
        console.log('sendSignInOtpCode', email, otp, locale);
      try {
        const t = await getTranslations({locale: locale ?? 'en', namespace: 'EmailService'});

        const subject = t('signInOtpCode.subject');
        const template = OtpEmailTemplate({ otp }, t);

        const res = await sendReactEmail({ to: email, subject, template });

        if (!res.ok) {
          console.error('[EMAIL SERVICE] [sendOtpCode] error', res.error);
        }

        return res;
      } catch (error) {
        console.error('[EMAIL SERVICE] [sendOtpCode] error', error);
        return { ok: false, error };
      }
    },

    sendOrganizationInvitationEmail: async ({ email, organizationName, inviterName, invitationUrl }: { email: string; organizationName: string; inviterName: string; invitationUrl: string }, locale?: string) => {
      try {
        const t = await getTranslations({locale: locale ?? 'en', namespace: 'EmailService'});

        console.log(`Locale is ${locale} and t is ${!!t}`);
        
        const subject = t('organizationInvitationEmail.subject');
        const template = OrganizationInvitationTemplate({ organizationName, inviterName, invitationUrl }, t);
        
        const res = await sendReactEmail({ to: email, subject, template });
        if (!res.ok) {
          console.error('[EMAIL SERVICE] [sendOrganizationInvitationEmail] error', res.error);
        }
        return res;
      } catch (error) {
        console.error('[EMAIL SERVICE] [sendOrganizationInvitationEmail] error', error);
        return { ok: false, error };
      }
    }
  };
}