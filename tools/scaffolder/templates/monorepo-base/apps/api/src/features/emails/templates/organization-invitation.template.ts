export default function organizationInvitationTemplate(data: { orgName: string; invitationUrl: string }): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Organization Invitation</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .header { background-color: #f4f4f4; padding: 10px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; }
        .button { display: inline-block; background-color: #007bff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 3px; margin-top: 15px; }
        .footer { margin-top: 20px; font-size: 0.9em; color: #777; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>GefaKit Invitation</h2>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>You have been invited to join the organization <strong>${data.orgName}</strong> at GefaKit.</p>
            <p>Click the button below to accept the invitation and join the organization:</p>
            <a href="${data.invitationUrl}" class="button" style="color: #ffffff;">Accept Invitation</a>
            <p>If you did not expect this invitation, you can safely ignore this email.</p>
            <p>Thanks,<br>The GefaKit Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} GefaKit. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
} 