interface VerifyEmailProps {
  username: string;
  verificationLink: string;
   // TODO: Add other dynamic properties like companyName
}

export default function verifyEmailTemplate(props: VerifyEmailProps): string {
  const currentYear = new Date().getFullYear();
  // TODO: Replace 'Your Company Name' with actual name (props.companyName)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email Address</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 0 15px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #eeeeee;
        }
        .header h1 {
            color: #333333;
            margin: 0;
        }
        .content {
            padding: 20px 0;
            color: #555555;
            line-height: 1.6;
            text-align: center;
        }
        .content p {
            margin: 10px 0;
        }
        .button {
            display: inline-block;
            margin: 20px 0;
            padding: 15px 25px;
            background-color: #28a745; /* Green color for verification */
            color: #ffffff !important; /* Ensure text is white */
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .button:link, .button:visited {
             color: #ffffff !important;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #eeeeee;
            font-size: 12px;
            color: #aaaaaa;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Verify Your Email</h1>
        </div>
        <div class="content">
            <p>Hello ${props.username},</p>
            <p>Thanks for signing up! Please click the button below to verify your email address and complete your registration.</p>
            <a href="${props.verificationLink}" class="button">Verify Email Address</a>
            <p>If you did not create an account, please ignore this email.</p>
            <p>Best regards,<br>The Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${currentYear} Your Company Name. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;
} 