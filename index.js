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
const { createWebAppServer } = require("./webappServer");

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

bot.on("message", (msg) => {
  console.log(`📨 Message received from ${msg.from.id}: ${msg.text}`);
});

setupCommandHandlers(bot);
setupCallbackHandlers(bot);
setupMessageHandlers(bot);

startGlobalNotificationPolling(bot);

const app = createWebAppServer(bot);
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(
    `✅ [${new Date().toISOString()}] Bot started (PID: ${process.pid})`
  );
  console.log(`🌐 WebApp API server running on port ${PORT}`);
  console.log(
    `📱 WebApp URL: ${
      process.env.WEBAPP_URL || `http://localhost:${PORT}`
    }/index.html`
  );
});

const gracefulShutdown = () => {
  console.log("\n🛑 Shutting down bot...");
  stopGlobalNotificationPolling();
  bot.stopPolling();

  server.close(() => {
    console.log("🌐 WebApp server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("⚠️ Forced shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown();
});
