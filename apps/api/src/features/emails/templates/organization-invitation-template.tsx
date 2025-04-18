interface EmailTemplateProps {
    organizationName: string;
    inviterName: string;
    invitationUrl: string;
}


export function OrganizationInvitationTemplate({ organizationName, inviterName, invitationUrl }: Readonly<EmailTemplateProps>, t: any): React.ReactNode {
    return (
        <div>
            <h1>{t('organizationInvitationEmail.inviteHeading', { organizationName })}</h1>
            <p>{t('organizationInvitationEmail.inviteMessage', { inviterName })}</p>
            <p>{t('organizationInvitationEmail.clickToAccept')}</p>
            <a href={invitationUrl}>{t('organizationInvitationEmail.acceptInvitation')}</a>
        </div>
    );
}