import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: false });

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log("Incoming request received.");

    const message: TelegramMessage = await req.json();
    const chatId = message?.message?.chat?.id;
    const text = message?.message?.text;

    if (!chatId || !text) {
      console.error("Invalid message payload:", message);
      throw new Error("Invalid Telegram message payload.");
    }

    console.log("Processing command:", text);

    if (text === "/deploy") {
      bot.sendMessage(chatId, "Deploying your project to Vercel...")
        .then(() => console.log("Deployment initialization message sent."))
        .catch((err) => console.error("Failed to send deployment message:", err));

      console.log("Triggering Vercel deployment...");

      // Log environment variables to ensure they are set
      console.log("Vercel API Token:", process.env.VERCEL_API_TOKEN);
      console.log("Vercel Project Name:", process.env.VERCEL_TARGET_PROJECT);

      try {
        const response = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, // Vercel API token
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
            monorepoManager: null,
            name: process.env.VERCEL_TARGET_PROJECT,
            project: process.env.VERCEL_TARGET_PROJECT,
            projectSettings: {
              buildCommand: null,
              commandForIgnoringBuildStep: null,
              devCommand: null,
              framework: null,
              installCommand: null,
              nodeVersion: "22.x",
              outputDirectory: null,
              rootDirectory: null,
              serverlessFunctionRegion: null,
              skipGitConnectDuringLink: true,
              sourceFilesOutsideRootDirectory: true,
            },
            target: "staging",
          }),
        });

        const data = await response.json();
        console.log("Vercel API Response:", data);

        if (response.ok) {
          bot.sendMessage(chatId, `Deployment successful!\nDeployment URL: ${data.url}`)
            .then(() => console.log("Success message sent."))
            .catch((err) => console.error("Failed to send success message:", err));
        } else {
          bot.sendMessage(chatId, `Error during deployment: ${data.message || "Unknown error"}`)
            .then(() => console.log("Error message sent."))
            .catch((err) => console.error("Failed to send error message:", err));
        }
      } catch (err) {
        console.error("Error during Vercel deployment:", err);
        bot.sendMessage(chatId, "An unexpected error occurred during deployment.")
          .catch((err) => console.error("Failed to send unexpected error message:", err));
      }

      return NextResponse.json({ status: "Deployment initiated" });
    }

    if (text.startsWith("/configure")) {
      bot.sendMessage(chatId, "Configuring deployment links...")
        .then(() => console.log("Configuration initialization message sent."))
        .catch((err) => console.error("Failed to send configuration message:", err));

      console.log("Configuring deployment links...");

      const match = text.match(/^\/configure\s+(\S+)\s+([\s\S]+)$/);
      if (!match) {
        bot.sendMessage(
          chatId,
          "Invalid format. Use:\n/configure <URL> <JSON_CONFIG>"
        ).catch((err) => console.error("Failed to send invalid format message:", err));
        return NextResponse.json({ error: "Invalid format" }, { status: 400 });
      }

      const [, deploymentUrl, rawConfig] = match;

      let parsedConfig: number | string | object;
      try {
        const trimmedConfig = rawConfig.trim();
        if (
          (trimmedConfig.startsWith("{") && trimmedConfig.endsWith("}")) ||
          (trimmedConfig.startsWith("[") && trimmedConfig.endsWith("]"))
        ) {
          parsedConfig = JSON.parse(trimmedConfig);
        } else if (!isNaN(Number(trimmedConfig))) {
          parsedConfig = Number(trimmedConfig);
        } else {
          parsedConfig = trimmedConfig;
        }
        console.log("Parsed configuration:", parsedConfig);
      } catch {
        bot.sendMessage(
          chatId,
          "Invalid configuration format. Please provide a valid JSON or a number."
        ).catch((err) => console.error("Failed to send invalid configuration message:", err));
        return NextResponse.json({ error: "Invalid configuration format" }, { status: 400 });
      }

      const authEndpoint = `${process.env.PRODUCTION_URL}/api/auth`;

      try {
        console.log("Authenticating with endpoint:", authEndpoint);

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
          console.error("Authentication error:", errorMessage);
          bot.sendMessage(chatId, errorMessage)
            .catch((err) => console.error("Failed to send authentication error message:", err));
          return NextResponse.json({ error: errorMessage }, { status: 401 });
        }

        const { session } = await authResponse.json();
        const accessToken = session?.access_token;

        if (!accessToken) {
          console.error("Access token not received.");
          bot.sendMessage(chatId, "Authentication failed: Access token not received.")
            .catch((err) => console.error("Failed to send access token error message:", err));
          return NextResponse.json({ error: "No access token received" }, { status: 401 });
        }

        const updateEndpoint = `${process.env.PRODUCTION_URL}/api/deployments/update-config`;

        const payload = { url: deploymentUrl, config: parsedConfig };
        console.log("Payload being sent to update-config:", JSON.stringify(payload, null, 2));

        const configResponse = await fetch(updateEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responseText = await configResponse.text();
        console.log("Response from update-config (raw):", responseText);

        try {
          const responseBody = JSON.parse(responseText);
          console.log("Parsed JSON response:", responseBody);

          if (!configResponse.ok) {
            const errorMessage = `Configuration update failed: ${responseBody.error || "Unknown error"}`;
            console.error(errorMessage);
            bot.sendMessage(chatId, errorMessage)
              .catch((err) => console.error("Failed to send configuration error message:", err));
            return NextResponse.json({ error: errorMessage }, { status: 500 });
          }

          bot.sendMessage(chatId, "Configuration updated successfully.")
            .then(() => console.log("Configuration success message sent."))
            .catch((err) => console.error("Failed to send success message:", err));
          return NextResponse.json({ status: "success" });
        } catch {
          console.error("Failed to parse response as JSON. Raw response:", responseText);
          bot.sendMessage(
            chatId,
            "Configuration update failed. Unexpected response format from the server."
          ).catch((err) => console.error("Failed to send unexpected response format message:", err));
          return NextResponse.json({ error: "Unexpected response format" }, { status: 500 });
        }
      } catch (authErr) {
        console.error("Error during configuration update:", authErr);
        bot.sendMessage(chatId, "An unexpected error occurred. Please try again later.")
          .catch((err) => console.error("Failed to send unexpected error message:", err));
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }
    }

    bot.sendMessage(chatId, "Unsupported command. Please use /configure or /deploy.")
      .catch((err) => console.error("Failed to send unsupported command message:", err));
    return NextResponse.json({ error: "Unsupported command" }, { status: 400 });
  } catch (generalErr) {
    console.error("Error handling Telegram request:", generalErr);
    return NextResponse.json(
      { error: "Internal Server Error", details: (generalErr as Error).message },
      { status: 500 }
    );
  }
}

// Type Definitions
interface TelegramMessage {
  message: {
    chat: {
      id: number;
    };
    text: string;
  };
}
