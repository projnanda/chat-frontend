# Google OAuth Setup Guide

This guide will help you set up Google OAuth for your AI Chat Assistant app.

## Step 1: Create OAuth Credentials

1. Go to the [Google API Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "Credentials" in the left sidebar
4. Click "Create Credentials" and select "OAuth client ID"
5. Select "Web application" as the application type
6. Give your OAuth client a name (e.g., "AI Chat Assistant")

## Step 2: Configure Authorized JavaScript Origins

Add the URLs where your application will be hosted:
- For local development: `http://localhost:8000`
- For production: Add your actual domain (e.g., `https://yourdomain.com`)

## Step 3: Get Your Client ID

1. After creating the OAuth client, you'll see your Client ID
2. Copy this Client ID (it will look like `123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com`)
3. Open the `landing.html` file in your project
4. Replace `PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com` with your actual Client ID

## Step 4: Configure OAuth Consent Screen

1. Go to "OAuth consent screen" in the left sidebar
2. Select "External" as the user type (unless you're using Google Workspace)
3. Fill in the required application information:
   - App name
   - User support email
   - Developer contact information
4. Add the scopes needed for your application:
   - `openid`
   - `email`
   - `profile`
5. Add test users if you're in testing mode

## Step 5: Publish Your App (When Ready)

1. When you're ready to make your app available to all users, go back to the OAuth consent screen
2. Submit your app for verification if you're using sensitive or restricted scopes
3. Once approved, you can change the status from "Testing" to "Production"

## Troubleshooting

- **"Error: invalid_client"**: Ensure your client ID is correctly copied to `landing.html`
- **"Error: redirect_uri_mismatch"**: Make sure the domain where your app is hosted is listed in the Authorized JavaScript Origins
- **"Error: idpiframe_initialization_failed"**: Check that your OAuth consent screen is properly configured

## Additional Resources

- [Google OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Sign In With Google Documentation](https://developers.google.com/identity/gsi/web/guides/overview) 