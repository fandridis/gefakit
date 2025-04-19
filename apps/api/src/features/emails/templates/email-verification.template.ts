export default function emailVerificationTemplate({ verificationUrl }: { verificationUrl: string }): string {
  const currentYear = new Date().getFullYear();
  // TODO: Replace 'Your Company Name' with actual name (e.g., from props or config)

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
            text-align: center; /* Center align content */
        }
        .content p {
            margin: 15px 0; /* Adjust spacing */
        }
        .button {
            display: inline-block; /* Use inline-block for centering */
            margin: 20px auto;
            padding: 15px 25px;
            background-color: #007bff;
            color: #ffffff !important; /* Ensure text is white */
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            text-align: center;
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
            <h1>Verify Your Email Address</h1>
        </div>
        <div class="content">
            <p>Thanks for signing up!</p>
            <p>Please click the button below to verify your email address:</p>
            <a href="${verificationUrl}" target="_blank" class="button">Verify Email</a>
            <p>If you did not sign up for this account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; ${currentYear} Your Company Name. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;
} 