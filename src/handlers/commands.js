const userStore = require("../utils/userStore");
const { getMyself } = require("../services/jiraService");
const { mainMenu } = require("../utils/keyboards");
const { showTaskEdit } = require("../views/taskViews");

const setupCommandHandlers = (bot) => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userData = userStore.get(chatId);

    if (userData?.token) {
      return bot.sendMessage(chatId, "Главное меню:", [...mainMenu]);
    }
    return bot.sendMessage(chatId, "Для начала работы введите /login");
  });

  bot.onText(/\/login/, (msg) => {
    const chatId = msg.chat.id;
    const userData = userStore.get(chatId);

    if (userData?.token) {
      return bot.sendMessage(chatId, "Вы уже авторизованы. Главное меню:", [
        ...mainMenu,
      ]);
    }

    const imageUrl =
      "https://s3.iimg.su/s/13/uHobC68xGaYwUzYA1IHkM3zPXSmH9MqEVRFHirls.png";

    const caption = `
<b>🔑 Настройка доступа к Jira</b>

Для работы бота вам нужен <b>Jira API Token</b>. Следуйте этим шагам:

1️⃣ Перейдите по ссылке:
<a href="https://jira.teamforce.dev/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens">Персональные токены доступа</a>

2️⃣ Нажмите <b>"Create API token"</b>.

3️⃣ Присвойте токену имя и нажмите <b>"Create"</b>.

4️⃣ Скопируйте токен и вставьте его сюда.

💡 <i>Важно:</i> Сохраняйте токен в безопасности и не делитесь им с другими.
`;

    bot.sendPhoto(chatId, imageUrl, { caption, parse_mode: "HTML" });

    userStore.set(chatId, { awaitingToken: true });
  });

  bot.onText(/\/taskedit (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const issueKey = match[1].trim();
    await showTaskEdit(bot, chatId, issueKey);
  });

  bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "☰ Главное меню:", {
      ...mainMenu,
    });
  });

  bot.on("callback_query", async (callbackQuery) => {
    const msg = callbackQuery.message;
    if (callbackQuery.data === "main_menu") {
      await bot.sendMessage(msg.chat.id, "☰ Главное меню:", [...mainMenu]);
    }
  });
};

module.exports = { setupCommandHandlers };
