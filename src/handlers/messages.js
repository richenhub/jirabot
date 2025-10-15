const userStore = require("../utils/userStore");
const { handleTokenError } = require("../services/notificationService");
const {
  getMyself,
  changeAssignee,
  logWork,
  getStatuses,
} = require("../services/jiraService");
const { mainMenu } = require("../utils/keyboards");
const { showMyTasksStatuses, showTaskEdit } = require("../views/taskViews");
const { showMyFilters } = require("../views/filterViews");
const { showNotificationSettings } = require("../views/settingsViews");
const { notifyNewAssignee } = require("../services/notificationService");
const { generateFilter } = require("../services/openAIService");

const handleWorklogInput = async (bot, chatId, timeStr, issueKey) => {
  const userData = userStore.get(chatId);
  userStore.set(chatId, { awaitingWorklog: null });

  try {
    const timeSpent = timeStr.trim();
    await logWork(userData.token, issueKey, timeSpent);

    bot.sendMessage(
      chatId,
      `✅ Время работы (${timeSpent}) добавлено к задаче ${issueKey}`
    );
    await showTaskEdit(bot, chatId, issueKey);
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const userData = userStore.get(chatId);
      handleTokenError(bot, chatId, userData.username);
      return;
    }
    console.error("Error logging work:", error);
    bot.sendMessage(
      chatId,
      "Ошибка добавления времени. Используйте формат: 2h 30m или 1d 4h"
    );
  }
};

const handleAssigneeInput = async (bot, chatId, username, issueKey) => {
  const userData = userStore.get(chatId);
  userStore.set(chatId, { awaitingAssignee: null });

  try {
    await changeAssignee(userData.token, issueKey, username.trim());
    bot.sendMessage(
      chatId,
      `✅ Ответственный для задачи ${issueKey} изменён на ${username}`
    );
    await notifyNewAssignee(
      bot,
      username.trim(),
      issueKey,
      userData.displayName
    );
    await showTaskEdit(bot, chatId, issueKey);
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const userData = userStore.get(chatId);
      handleTokenError(bot, chatId, userData.username);
      return;
    }
    console.error("Error changing assignee:", error);
    bot.sendMessage(chatId, "Ошибка смены ответственного. Проверьте username");
  }
};

const setupMessageHandlers = (bot) => {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userData = userStore.get(chatId);
    const messageId = msg.messageId;

    if (text?.startsWith("/")) return;

    if (userData.awaitingToken) {
      try {
        const user = await getMyself(text);
        userStore.set(chatId, {
          token: text,
          username: user.name,
          displayName: user.displayName,
          awaitingToken: false,
        });

        bot.sendMessage(
          chatId,
          `Готово! Вы вошли как ${user.displayName}\nИспользуйте меню:`,
          mainMenu
        );
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          const userData = userStore.get(chatId);
          handleTokenError(bot, chatId, userData.username);
          return;
        }
        bot.sendMessage(
          chatId,
          "Ошибка авторизации. Проверьте токен и попробуйте /login снова"
        );
      }
      return;
    }

    if (userData.awaitingWorklog) {
      await handleWorklogInput(bot, chatId, text, userData.awaitingWorklog);
      return;
    }

    if (userData.awaitingAssignee) {
      await handleAssigneeInput(bot, chatId, text, userData.awaitingAssignee);
      return;
    }

    if (
      userData.awaitingFilter &&
      !text?.startsWith("/") &&
      !["📋 Мои задачи", "🔔 Настройки уведомлений", "🔎 Мои фильтры"].includes(
        text
      )
    ) {
      userStore.set(chatId, { awaitingFilter: false });
      bot.sendMessage(chatId, "🌀 Генерирую JQL фильтр при помощи ИИ...");
      try {
        const statuses = await getStatuses(userData.token);
        const filter = await generateFilter(text, statuses);

        if (filter?.error) {
          userStore.set(chatId, { awaitingFilter: false });
          bot.sendMessage(
            chatId,
            `✅ Фильтр "${filter.name}" создан:\n<pre>${filter.jql}</pre>`,
            { parse_mode: "HTML" }
          );
        }

        const filters = userData.filters || [];
        filters.push(filter);
        userStore.set(chatId, { filters, awaitingFilter: false });

        bot.sendMessage(
          chatId,
          `✅ Фильтр "${filter.name}" создан:\n<pre>${filter.jql}</pre>`,
          { parse_mode: "HTML" }
        );
        await showMyFilters(bot, chatId);
      } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, "⚠️ Ошибка при генерации фильтра через GPT.");

        userStore.set(chatId, { awaitingFilter: false });
      }
    }

    if (text === "📋 Мои задачи") {
      await showMyTasksStatuses(bot, chatId);
    } else if (text === "🔔 Настройки уведомлений") {
      await showNotificationSettings(bot, chatId, messageId);
    } else if (text === "🔎 Мои фильтры") {
      await showMyFilters(bot, chatId);
    }
  });
};

module.exports = { setupMessageHandlers };
