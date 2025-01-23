import { NextRequest, NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api'; 

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: true });

export async function POST(req: NextRequest) {
  try {
    const message = await req.json();
    const chatId = message.message.chat.id;

    if (message.message.text === '/deploy') {
      // Send a message to the user to confirm the deployment is being triggered
      bot.sendMessage(chatId, 'Deploying your project to Vercel...');

      // Log environment variables to ensure they are set
      console.log('Vercel API Token:', process.env.VERCEL_API_TOKEN);
      console.log('Vercel Project Name:', process.env.VERCEL_TARGET_PROJECT);

      // Trigger Vercel deployment using the specified request body
      const response = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}`, // Vercel API token
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gitMetadata: {
            remoteUrl: process.env.GITHUB_REMOTE,
          },
          gitSource: {
            ref: 'main',
            repoId: null,
            sha: '',
            type: 'github',
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
            nodeVersion: '22.x',
            outputDirectory: null,
            rootDirectory: null,
            serverlessFunctionRegion: null,
            skipGitConnectDuringLink: true,
            sourceFilesOutsideRootDirectory: true,
          },
          target: 'staging',
        }),
      });

      // Parse the response and log for debugging
      const data = await response.json();
      console.log('Vercel API Response:', data);

      // Send a success or error message to the user
      if (response.ok) {
        bot.sendMessage(chatId, `Deployment successful!\nDeployment URL: ${data.url}`);
      } else {
        bot.sendMessage(chatId, `Error during deployment: ${data.message || 'Unknown error'}`);
      }
    }

    return NextResponse.json({ status: 'success' });

  } catch (error) {
    console.error('Error handling Telegram request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
