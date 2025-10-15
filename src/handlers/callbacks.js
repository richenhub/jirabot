const userStore = require("../utils/userStore");
const {
  getTransitions,
  changeStatus,
  getIssue,
} = require("../services/jiraService");
const {
  showMyTasksStatuses,
  showTasksByStatus,
  showTaskEdit,
  showHiddenStatuses,
} = require("../views/taskViews");
const { showMyFilters, showTasksByFilter } = require("../views/filterViews");
const {
  showWorklog,
  showNotificationSettings,
} = require("../views/settingsViews");
const {
  notifyAssigneeStatusChange,
} = require("../services/notificationService");

const showStatusChangeMenu = async (bot, chatId, issueKey, messageId) => {
  const userData = userStore.get(chatId);

  try {
    const transitions = await getTransitions(userData.token, issueKey);

    const availableTransitions = transitions.filter((t) => {
      const fields = t.fields || {};
      const requiredFields = Object.keys(fields).filter(
        (key) => fields[key].required
      );
      return requiredFields.length === 0;
    });

    if (availableTransitions.length === 0) {
      bot.editMessageText(
        `Для изменения статуса ${issueKey} требуется заполнить дополнительные поля.\nИспользуйте веб-интерфейс Jira.`,
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "← Назад", callback_data: `back_task_${issueKey}` }],
            ],
          },
        }
      );
      return;
    }

    const buttons = availableTransitions.map((t) => [
      {
        text: `→ ${t.name}`,
        callback_data: `set_status_${issueKey}:${t.id}`,
      },
    ]);

    buttons.push([{ text: "← Назад", callback_data: `back_task_${issueKey}` }]);

    bot.editMessageText(`Выберите новый статус для ${issueKey}:`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (error) {
    console.error("Error loading transitions:", error);
    bot.sendMessage(chatId, "Ошибка загрузки статусов");
  }
};

const changeIssueStatus = async (bot, chatId, issueKey, transitionId) => {
  const userData = userStore.get(chatId);

  try {
    const issue = await getIssue(userData.token, issueKey);
    const oldStatus = issue.fields.status.name;
    const assigneeUsername = issue.fields.assignee?.name;

    await changeStatus(userData.token, issueKey, transitionId);

    const updatedIssue = await getIssue(userData.token, issueKey);
    const newStatus = updatedIssue.fields.status.name;

    bot.sendMessage(chatId, `✅ Статус задачи ${issueKey} изменён`);

    if (assigneeUsername && assigneeUsername !== userData.username) {
      await notifyAssigneeStatusChange(
        bot,
        assigneeUsername,
        issueKey,
        userData.displayName,
        oldStatus,
        newStatus,
        updatedIssue
      );
    }

    await showTaskEdit(bot, chatId, issueKey);
  } catch (error) {
    console.error("Error details:", error.response?.data);
    const errorMsg =
      error.response?.data?.errorMessages?.[0] ||
      JSON.stringify(error.response?.data?.errors) ||
      "Ошибка изменения статуса";
    bot.sendMessage(chatId, `⚠️ ${errorMsg}`);
  }
};

const setupCallbackHandlers = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userData = userStore.get(chatId);

    try {
      if (data === "toggle_notifications") {
        const newState = !(userData.notificationsEnabled !== false);
        userStore.set(chatId, { notificationsEnabled: newState });

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: newState ? "✅ Включены" : "⚠️ Выключены",
                  callback_data: "toggle_notifications",
                },
              ],
              [{ text: "← Назад", callback_data: "back_to_menu" }],
            ],
          },
        };

        bot.editMessageText("Уведомления:", {
          chat_id: chatId,
          message_id: query.message.message_id,
          ...keyboard,
        });

        bot.answerCallbackQuery(query.id, {
          text: newState ? "Уведомления включены" : "Уведомления выключены",
        });
      } else if (data.startsWith("status_view_")) {
        const statusName = data.replace("status_view_", "").replace(/_/g, " ");

        userStore.set(chatId, {
          lastView: { type: "status", statusName, page: 1 },
        });

        await showTasksByStatus(
          bot,
          chatId,
          statusName,
          0,
          query.message.message_id,
          false
        );
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("page_")) {
        const [_, statusName, page] = data.split("_", 3);

        userStore.set(chatId, {
          lastView: { type: "status", statusName, page },
        });

        await showTasksByStatus(
          bot,
          chatId,
          statusName.replace(/~/g, " "),
          parseInt(page),
          query.message.message_id,
          false
        );
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("change_status_")) {
        const issueKey = data.replace("change_status_", "");
        await showStatusChangeMenu(
          bot,
          chatId,
          issueKey,
          query.message.message_id
        );
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("set_status_")) {
        const params = data.replace("set_status_", "");
        const [issueKey, transitionId] = params.split(":");
        try {
          await changeIssueStatus(bot, chatId, issueKey, transitionId);
          bot.answerCallbackQuery(query.id, { text: "Статус изменён" });
        } catch (error) {
          bot.answerCallbackQuery(query.id, { text: "Ошибка смены статуса" });
        }
      } else if (data.startsWith("change_assignee_")) {
        const issueKey = data.replace("change_assignee_", "");
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(
          chatId,
          `Введите username нового ответственного для задачи ${issueKey}:`
        );
        userStore.set(chatId, { awaitingAssignee: issueKey });
      } else if (data.startsWith("log_work_")) {
        const issueKey = data.replace("log_work_", "");
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(
          chatId,
          `Введите время работы для ${issueKey} (например: 2h 30m или 1d 4h):`
        );
        userStore.set(chatId, { awaitingWorklog: issueKey });
      } else if (data.startsWith("view_worklog_")) {
        const issueKey = data.replace("view_worklog_", "");
        await showWorklog(bot, chatId, issueKey, query.message.message_id);
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("back_task_")) {
        const issueKey = data.replace("back_task_", "");
        await showTaskEdit(bot, chatId, issueKey, query.message.message_id);
        bot.answerCallbackQuery(query.id);
      } else if (data === "back_to_statuses") {
        await showMyTasksStatuses(bot, chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id);
      } else if (data === "back_to_menu") {
        bot.deleteMessage(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id);
      } else if (data === "filter_add") {
        bot.sendMessage(
          chatId,
          "🤖 Опишите какие задачи нужно найти своими словами и мы создадим фильтр автоматически или напишите готовый JQL-запрос. Пример: задачи за последние 7 дней, которые были завершены",
          { parse_mode: "HTML" }
        );
        userStore.set(chatId, { awaitingFilter: true });
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("filter_delete_")) {
        const idx = parseInt(data.replace("filter_delete_", ""));
        const filters = userData.filters || [];
        if (filters[idx]) {
          filters.splice(idx, 1);
          userStore.set(chatId, { filters });
        }
        await showMyFilters(bot, chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id, { text: "Фильтр удалён" });
      } else if (data.startsWith("filter_view_")) {
        const idx = parseInt(data.replace("filter_view_", ""));
        const filters = userData.filters || [];
        const filter = filters[idx];
        if (filter) {
          await showTasksByFilter(
            bot,
            chatId,
            filter,
            0,
            query.message.message_id
          );
        }
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("filter_subscribe_")) {
        const idx = parseInt(data.replace("filter_subscribe_", ""));
        const filters = userData.filters || [];
        const filter = filters[idx];

        if (filter) {
          filter.subscribed = !filter.subscribed;
          userStore.set(chatId, { filters });
          await showMyFilters(bot, chatId, query.message.message_id);
          bot.answerCallbackQuery(query.id, {
            text: filter.subscribed
              ? "✅ Подписка активна"
              : "🔕 Подписка отключена",
          });
        }
      } else if (data === "back_to_filters") {
        await showMyFilters(bot, chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("filter_page_")) {
        const payload = data.replace("filter_page_", "");
        const lastUnderscoreIndex = payload.lastIndexOf("_");
        const filterSlug =
          lastUnderscoreIndex >= 0
            ? payload.slice(0, lastUnderscoreIndex)
            : payload;
        const pageStr =
          lastUnderscoreIndex >= 0
            ? payload.slice(lastUnderscoreIndex + 1)
            : "0";
        const page = parseInt(pageStr, 10) || 0;

        const filters = userData.filters || [];
        const filter = filters.find(
          (f) => f.name.replace(/ /g, "~") === filterSlug
        );

        if (filter) {
          await showTasksByFilter(
            bot,
            chatId,
            filter,
            page,
            query.message.message_id
          );
        }
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("hide_status_")) {
        const statusName = data.replace("hide_status_", "");
        userStore.addHiddenStatus(chatId, statusName);
        await showMyTasksStatuses(bot, chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id, { text: `Скрыт: ${statusName}` });
      } else if (data === "show_hidden_statuses") {
        await showHiddenStatuses(bot, chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("hidden_status_view_")) {
        const statusName = data
          .replace("hidden_status_view_", "")
          .replace(/_/g, " ");

        userStore.set(chatId, {
          lastView: { type: "status", statusName, page: 1 },
        });

        await showTasksByStatus(
          bot,
          chatId,
          statusName,
          0,
          query.message.message_id,
          true
        );
        bot.answerCallbackQuery(query.id);
      } else if (data.startsWith("unhide_status_")) {
        const statusName = data.replace("unhide_status_", "");
        userStore.removeHiddenStatus(chatId, statusName);

        userStore.set(chatId, {
          lastView: { type: "status", statusName, page: 1 },
        });

        await showTasksByStatus(
          bot,
          chatId,
          statusName,
          0,
          query.message.message_id,
          false
        );
        bot.answerCallbackQuery(query.id, { text: `Показан: ${statusName}` });
      } else if (data.startsWith("taskedit_")) {
        const issueKey = data.replace("taskedit_", "");
        await showTaskEdit(bot, chatId, issueKey, query.message.message_id);
        bot.answerCallbackQuery(query.id);
      } else if (data === "toggle_comments_notifications") {
        const newState = !(userData.commentsNotificationsEnabled !== false);
        userStore.set(chatId, { commentsNotificationsEnabled: newState });

        await showNotificationSettings(bot, chatId, query.message.message_id);

        bot.answerCallbackQuery(query.id, {
          text: newState
            ? "Уведомления о комментариях включены"
            : "Уведомления о комментариях выключены",
        });
      }
    } catch (error) {
      console.error("Callback error:", error);
      bot.answerCallbackQuery(query.id, { text: "Произошла ошибка" });
    }
  });
};

module.exports = { setupCallbackHandlers };
