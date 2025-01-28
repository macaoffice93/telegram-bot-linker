# Telegram Deployment Bot

This is a Telegram bot designed for managing deployments and configurations via simple chat commands. The bot supports **restricted access** to a specific chat (defined by `ALLOWED_CHAT_ID`) and integrates with **Vercel API** and a configuration management system.

---

## Features

### 1. **Chat Restriction**
- The bot only responds to commands in the specified chat ID.
- If an unauthorized chat sends a command, the bot replies with:
  `"This chat is not authorized to use this bot."`

### 2. **Deploy Command**
- **Command**: `/deploy [number]`
- Triggers one or more deployments via the Vercel API.
- If the `[number]` argument is not specified, the bot defaults to 1 deployment.
- **Success Message**:
  - `"Deployment X successful! URL: <deployment_url>"`
- **Failure Message**:
  - `"Deployment X failed: <error_message>"`

### 3. **Configure Command**
- **Command**: `/configure <URL> <JSON_CONFIG>`
- Updates the configuration for a given deployment URL using a JSON payload.
- **Success Message**:
  - `"Configuration updated successfully. Link: <url>/api/config"`
- **Failure Message**:
  - `"Configuration update failed: <error_message>"`

### 4. **Unsupported Command Handling**
- For invalid or unsupported commands, the bot replies:
  `"Unsupported command. Please use /configure or /deploy."`

### 5. **Error Handling**
- Logs all errors to the console for debugging.
- Replies with appropriate error messages to the chat in case of failures.

---

## Environment Variables

| Variable               | Description                                                   |
|------------------------|---------------------------------------------------------------|
| `TELEGRAM_TOKEN`       | Telegram Bot API token.                                       |
| `ALLOWED_CHAT_ID`      | Chat ID of the group or individual allowed to use the bot.    |
| `VERCEL_API_TOKEN`     | Vercel API token for deployment access.                       |
| `VERCEL_TARGET_PROJECT`| Target project name for Vercel deployments.                   |
| `GITHUB_REMOTE`        | GitHub repository URL for the project.                        |
| `GITHUB_ORG`           | GitHub organization name.                                     |
| `GITHUB_PROJECT`       | GitHub project name.                                          |
| `SUPABASE_EMAIL`       | Email address for Supabase authentication.                    |
| `SUPABASE_PASSWORD`    | Password for Supabase authentication.                         |
| `PRODUCTION_URL`       | URL of the production server for configuration management.    |

---

## Example Commands

### Deploy
1. **Trigger a Single Deployment**:
   ```
   /deploy
   ```

   **Response**:
   ```
   Starting 1 deployment(s)...
   Deployment 1 successful!
   URL: https://deployment-url.vercel.app
   ```

2. **Trigger Multiple Deployments**:
   ```
   /deploy 3
   ```

   **Response**:
   ```
   Starting 3 deployment(s)...
   Deployment 1 successful!
   URL: https://deployment-url1.vercel.app
   Deployment 2 successful!
   URL: https://deployment-url2.vercel.app
   Deployment 3 failed: Invalid configuration.
   ```

### Configure
1. **Update Configuration**:
   ```
   /configure https://example.com {"key": "value"}
   ```

   **Response**:
   ```
   Configuring deployment links...
   Configuration updated successfully. Link: https://example.com/api/config
   ```

2. **Invalid Format**:
   ```
   /configure https://example.com invalid_json
   ```

   **Response**:
   ```
   Invalid configuration format. Please provide a valid JSON or a number.
   ```

### Unauthorized Chat
1. **Command from Unauthorized Chat**:
   ```
   /deploy
   ```

   **Response**:
   ```
   This chat is not authorized to use this bot.
   ```

### Unsupported Command
1. **Unknown Command**:
   ```
   /unknown
   ```

   **Response**:
   ```
   Unsupported command. Please use /configure or /deploy.
   ```
