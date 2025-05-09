# AI Chat Assistant

A modern, minimalistic chatbot interface with Google OAuth authentication.

## Features

- Sleek, Apple-inspired dark mode UI
- Google OAuth authentication
- Multiple AI agents for different tasks
- Responsive design for desktop and mobile
- Modern animations and transitions

## Setup Instructions

### 1. Configure Google OAuth

Follow these steps to set up Google OAuth for authentication:

1. See the detailed instructions in [oauth-setup-guide.md](oauth-setup-guide.md)
2. Create a project in the [Google API Console](https://console.cloud.google.com/)
3. Set up OAuth credentials for a web application
4. Add `http://localhost:8000` to authorized JavaScript origins

### 2. Configure Application

1. Copy `config.sample.js` to `config.js`
2. Update `config.js` with your Google OAuth client ID:

```js
const config = {
    googleClientId: "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com"
};
```

### 3. Running the Application

1. Start a local web server in the project directory:
   ```
   python -m http.server
   ```
   
2. Open your browser and navigate to:
   - Landing page: http://localhost:8000/landing.html
   - Chat interface (requires authentication): http://localhost:8000/index.html

## Security Notes

- The `config.js` file contains sensitive credentials and is excluded from git version control
- In a production environment, you should implement server-side validation of authentication tokens
- For a real application, consider adding backend APIs and proper security measures

## License

Feel free to use and modify this code for personal or commercial projects. 