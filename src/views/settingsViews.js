const userStore = require("../utils/userStore");
const { createNotificationButtons } = require("../utils/keyboards");
const { getWorklog } = require("../services/jiraService");

const showNotificationSettings = async (bot, chatId, messageId) => {
  const userData = userStore.get(chatId);
  const enabled = userData.notificationsEnabled !== false;
  const commentsEnabled = userData.commentsNotificationsEnabled !== false;

  const buttons = [
    [
      {
        text: enabled ? "✅ Все уведомления" : "⚠️ Все уведомления",
        callback_data: "toggle_notifications",
      },
    ],
    [
      {
        text: commentsEnabled
          ? "✅ Уведомления о комментариях"
          : "⚠️ Уведомления о комментариях",
        callback_data: "toggle_comments_notifications",
      },
    ],
    [{ text: "← Назад", callback_data: "back_to_menu" }],
  ];

  const text =
    `🔔 Настройки уведомлений\n\n` +
    `Все уведомления: ${enabled ? "Включены" : "Выключены"}\n` +
    `Комментарии: ${commentsEnabled ? "Включены" : "Выключены"}`;

  const opts = { reply_markup: { inline_keyboard: buttons } };

  if (messageId) {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...opts,
    });
  } else {
    bot.sendMessage(chatId, text, opts);
  }
};

const showWorklog = async (bot, chatId, issueKey, messageId) => {
  const userData = userStore.get(chatId);

  try {
    const worklogs = await getWorklog(userData.token, issueKey);

    if (worklogs.length === 0) {
      bot.editMessageText(`История времени для ${issueKey}:\n\nЗаписей нет`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: "← Назад", callback_data: `back_task_${issueKey}` }],
          ],
        },
      });
      return;
    }

    let text = `⏱ История времени для ${issueKey}:\n\n`;

    worklogs
      .slice(-10)
      .reverse()
      .forEach((log) => {
        const date = new Date(log.started).toLocaleDateString("ru-RU");
        const author = log.author.displayName;
        text += `📅 ${date} | 👤 ${author}\n⏱ ${log.timeSpent}\n\n`;
      });

    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: "← Назад", callback_data: `back_task_${issueKey}` }],
        ],
      },
    });
  } catch (error) {
    console.error("Error loading worklog:", error);
    bot.sendMessage(chatId, "Ошибка загрузки истории");
  }
};

module.exports = {
  showNotificationSettings,
  showWorklog,
};
