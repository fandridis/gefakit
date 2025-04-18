interface OrganizationCreatedProps {
  orgName: string;
  // TODO: Add other dynamic properties like getStartedLink, companyName
}

export default function organizationCreatedTemplate(props: OrganizationCreatedProps): string {
  const currentYear = new Date().getFullYear();
  // TODO: Replace # with actual link (props.getStartedLink)
  // TODO: Replace 'Your Company Name' with actual name (props.companyName)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${props.orgName}</title>
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
        }
        .content p {
            margin: 10px 0;
        }
        .content strong {
            color: #333333;
        }
        .button {
            display: block;
            width: fit-content;
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
            <h1>Congratulations!</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Welcome aboard! Your new organization, <strong>${props.orgName}</strong>, has been successfully created.</p>
            <p>We're thrilled to have you join our community. Get ready to explore all the features and possibilities.</p>
            <a href="#" class="button">Get Started</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
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