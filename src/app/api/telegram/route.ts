import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";

// Initialize the bot
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: false });

// Allowed chat ID from environment variables
const ALLOWED_CHAT_ID = parseInt(process.env.ALLOWED_CHAT_ID || "", 10);

// Store processed message IDs to prevent duplicate processing
const processedMessages = new Set<number>();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log("Incoming request received.");

    const message: TelegramMessage = await req.json();
    const chatId = message?.message?.chat?.id;
    const text = message?.message?.text;
    const messageId = message?.message?.message_id;

    // ✅ Validate message payload
    if (!chatId || !text || !messageId) {
      console.error("Invalid message payload:", message);
      return NextResponse.json({ error: "Invalid Telegram message payload." }, { status: 400 });
    }

    console.log(`Processing command: ${text}`);
    console.log(`Chat ID: ${chatId}`);

    // ✅ Prevent duplicate processing of the same message
    if (processedMessages.has(messageId)) {
      console.log(`Skipping duplicate message ${messageId}`);
      return NextResponse.json({ status: "Duplicate message ignored" });
    }
    processedMessages.add(messageId);

    // ✅ Ensure only authorized users can execute commands
    if (chatId !== ALLOWED_CHAT_ID) {
      console.log(`Unauthorized chat ID: ${chatId}. Ignoring the command.`);
      await sendMessageWithRetry(chatId, "This chat is not authorized to use this bot.");
      return NextResponse.json({ error: "Unauthorized chat ID" }, { status: 403 });
    }

    // ✅ Await processCommand() to ensure execution completes before function exits
    await processCommand(chatId, text);

    return NextResponse.json({ status: "Command processed successfully" });

  } catch (error) {
    console.error("Error handling request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ✅ Function to send messages with retry logic
async function sendMessageWithRetry(chatId: number, message: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await bot.sendMessage(chatId, message);
      console.log(`Message sent successfully on attempt ${attempt}: ${message}`);
      return;
    } catch (error) {
      console.error(`Failed to send message on attempt ${attempt}:`, error);

      if (attempt === retries) {
        console.error("Max retries reached. Giving up.");
        return;
      }

      console.log(`Retrying in ${attempt * 2} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000)); // Exponential backoff
    }
  }
}

// ✅ Function to handle the command in the background
async function processCommand(chatId: number, text: string) {
  try {
    console.log(`[DEBUG] Processing command: ${text}`);

    if (text.startsWith("/deploy")) {
      console.log("[DEBUG] Matched /deploy command. Sending initial response...");
      await sendMessageWithRetry(chatId, "Starting deployment...");

      const match = text.match(/^\/deploy\s*(\d+)?$/);
      const deployCount = match && match[1] ? parseInt(match[1], 10) : 1;

      if (isNaN(deployCount) || deployCount <= 0) {
        await sendMessageWithRetry(chatId, "Please provide a valid number of deployments (e.g., /deploy 3).");
        return;
      }

      console.log(`Triggering ${deployCount} Vercel deployments...`);

      for (let i = 0; i < deployCount; i++) {
        await triggerDeployment(chatId, i + 1);
      }

      await sendMessageWithRetry(chatId, "All deployments completed.");
    }

    if (text.startsWith("/configure")) {
      console.log("[DEBUG] Matched /configure command. Sending initial response...");
      await sendMessageWithRetry(chatId, "Configuring deployment links...");

      const match = text.match(/^\/configure\s+(\S+)\s+([\s\S]+)$/);
      if (!match) {
        await sendMessageWithRetry(chatId, "Invalid format. Use:\n/configure <URL> <JSON_CONFIG>");
        return;
      }

      const [, deploymentUrl, rawConfig] = match;
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(rawConfig);
      } catch {
        await sendMessageWithRetry(chatId, "Invalid configuration format. Provide valid JSON.");
        return;
      }

      console.log(`[DEBUG] Authenticating before configuring deployment...`);
      const accessToken = await getAuthToken(chatId);
      if (!accessToken) return;

      console.log(`[DEBUG] Sending configuration request to API: ${deploymentUrl}`);
      const updateEndpoint = `${process.env.PRODUCTION_URL}/api/deployments/update-config`;

      const response = await fetch(updateEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url: deploymentUrl, config: parsedConfig }),
      });

      if (response.ok) {
        await sendMessageWithRetry(chatId, `Configuration updated successfully.\nLink: ${deploymentUrl}/api/config`);
      } else {
        const errorMessage = await response.text();
        await sendMessageWithRetry(chatId, `Configuration update failed: ${errorMessage}`);
      }
    }
  } catch (error) {
    console.error("[DEBUG] Error processing command:", error);
    await sendMessageWithRetry(chatId, "An unexpected error occurred. Please try again later.");
  }
}

// ✅ Function to get authorization token
async function getAuthToken(chatId: number): Promise<string | null> {
  const authEndpoint = `${process.env.PRODUCTION_URL}/api/auth`;

  try {
    const authResponse = await fetch(authEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.SUPABASE_EMAIL,
        password: process.env.SUPABASE_PASSWORD,
      }),
    });

    if (!authResponse.ok) {
      const authError = await authResponse.json();
      const errorMessage = `Authentication failed: ${authError.message || "Unknown error"}`;
      await sendMessageWithRetry(chatId, errorMessage);
      return null;
    }

    const { session } = await authResponse.json();
    return session?.access_token || null;
  } catch (error) {
    console.error("Error during authentication:", error);
    await sendMessageWithRetry(chatId, "Authentication failed. Please try again later.");
    return null;
  }
}

// ✅ Function to trigger a Vercel deployment
async function triggerDeployment(chatId: number, deployIndex: number) {
  try {
    console.log(`[DEBUG] Triggering deployment ${deployIndex}...`);

    const response = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gitMetadata: {
          remoteUrl: process.env.GITHUB_REMOTE,
        },
        gitSource: {
          ref: "main",
          repoId: null,
          sha: "",
          type: "github",
          org: process.env.GITHUB_ORG,
          repo: process.env.GITHUB_PROJECT,
        },
        name: process.env.VERCEL_TARGET_PROJECT,
        project: process.env.VERCEL_TARGET_PROJECT,
        target: "staging",
      })
    });

    const data = await response.json();
    console.log(`[DEBUG] Vercel API Response for deployment ${deployIndex}:`, data);

    if (response.ok) {
      await sendMessageWithRetry(chatId, `Deployment ${deployIndex} successful!\nURL: https://${data.url}`);
    } else {
      await sendMessageWithRetry(chatId, `Deployment ${deployIndex} failed: ${data.error?.message || JSON.stringify(data)}`);
    }
  } catch (error) {
    console.error(`[DEBUG] Error during deployment ${deployIndex}:`, error);
    await sendMessageWithRetry(chatId, `An unexpected error occurred during deployment ${deployIndex}.`);
  }
}


// ✅ Type Definitions
interface TelegramMessage {
  message: {
    chat: {
      id: number;
    };
    text: string;
    message_id: number;
  };
}
