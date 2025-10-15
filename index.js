require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const userStore = require("./src/utils/userStore");
const { setupCommandHandlers } = require("./src/handlers/commands");
const { setupCallbackHandlers } = require("./src/handlers/callbacks");
const { setupMessageHandlers } = require("./src/handlers/messages");
const {
  startGlobalNotificationPolling,
  stopGlobalNotificationPolling,
} = require("./src/services/notificationService");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10,
    },
  },
});

bot.on("polling_error", (error) => {
  console.error("⚠️ Polling error:", error.message);
  if (error.message.includes("409")) {
    console.error("⚠️ Another bot instance is running!");
    process.exit(1);
  }
  if (error.message.includes("401")) {
    console.error("⚠️ Invalid token! Check TELEGRAM_TOKEN in .env");
    process.exit(1);
  }
});

setupCommandHandlers(bot);
setupCallbackHandlers(bot);
setupMessageHandlers(bot);

//  bot.once("polling", () => {
//    console.log(
//      `✅ [${new Date().toISOString()}] Bot started (PID: ${process.pid})`
//    );
//    startGlobalNotificationPolling(bot);
//  });

const gracefulShutdown = () => {
  console.log("\n🛑 Shutting down bot...");
  stopGlobalNotificationPolling();
  bot.stopPolling();
  process.exit(0);
};

startGlobalNotificationPolling(bot);

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
