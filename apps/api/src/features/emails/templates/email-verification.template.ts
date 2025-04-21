export default function emailVerificationTemplate({ verificationUrl }: { verificationUrl: string }): string {
  const currentYear = new Date().getFullYear();
  // TODO: Replace 'GefaKit' with actual name (e.g., from props or config)

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
            line-height: 1.6;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .header {
            background-color: #f4f4f4;
            padding: 10px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .header h2 {
            color: #333333;
            margin: 0;
        }
        .content {
            padding: 20px;
            color: #555555;
            line-height: 1.6;
            text-align: center;
        }
        .content p {
            margin: 15px 0;
        }
        .button {
            display: inline-block;
            margin-top: 15px;
            padding: 10px 20px;
            background-color: #007bff;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 3px;
        }
         .button:link, .button:visited {
             color: #ffffff !important;
         }
        .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eeeeee;
            font-size: 0.9em;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Verify Your Email Address</h2>
        </div>
        <div class="content">
            <p>Thanks for signing up with GefaKit!</p>
            <p>Please click the button below to verify your email address:</p>
            <a href="${verificationUrl}" target="_blank" class="button" style="color: #ffffff;">Verify Email</a>
            <p>If you did not sign up for this account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; ${currentYear} GefaKit. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;
} 