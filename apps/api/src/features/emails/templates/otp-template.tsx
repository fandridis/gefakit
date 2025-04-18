interface EmailTemplateProps {
    otp: string;
}
export function OtpEmailTemplate({ otp }: Readonly<EmailTemplateProps>, t: (key: any) => string): React.ReactNode {
    return (
        <div>
            <h1>{t('signInOtpCode.welcomeBack')}</h1>
            <p>{t('signInOtpCode.verificationCode')}: {otp}</p>
        </div>
    );
}