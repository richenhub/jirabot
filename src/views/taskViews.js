const { TASKS_PER_PAGE } = require("../config/jira");
const { searchIssues, getIssue } = require("../services/jiraService");
const userStore = require("../utils/userStore");
const {
  createStatusButtons,
  createTaskButtons,
  createPaginationButtons,
  createTaskEditButtons,
} = require("../utils/keyboards");

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const showMyTasksStatuses = async (bot, chatId, messageId = null) => {
  const userData = userStore.get(chatId);
  if (!userData.token || !userData.username) {
    return bot.sendMessage(chatId, "Выполните /login");
  }

  try {
    const issues = await searchIssues(
      userData.token,
      `assignee=${userData.username}`,
      "status",
      1000
    );

    if (issues.length === 0) {
      const msg = "У вас нет назначенных задач";
      if (messageId) {
        bot.editMessageText(msg, { chat_id: chatId, message_id: messageId });
      } else {
        bot.sendMessage(chatId, msg);
      }
      return;
    }

    const statusCounts = {};
    issues.forEach((issue) => {
      const status = issue.fields.status.name;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // const buttons = createStatusButtons(statusCounts);
    const hidden = userData.hiddenStatuses || [];
    const buttons = createStatusButtons(statusCounts, hidden);

    const text = `📊 Мои задачи\nВсего: ${issues.length}\n\nВыберите статус:`;

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
  } catch (error) {
    console.error("Error loading statuses:", error);
    bot.sendMessage(chatId, "Ошибка загрузки статусов");
  }
};

const showTasksByStatus = async (
  bot,
  chatId,
  statusName,
  page = 0,
  messageId = null,
  fromHidden = false
) => {
  const userData = userStore.get(chatId);

  if (!userData?.token || !userData?.username) {
    return bot.sendMessage(chatId, "Выполните /login");
  }

  userStore.set(chatId, { lastView: { type: "status", statusName, page } });

  let backCallback = `page_${statusName.replace(/ /g, "~")}_${page}`;

  try {
    const jql = `assignee=${userData.username} AND status="${statusName}" ORDER BY created DESC`;
    const allIssues = await searchIssues(
      userData.token,
      jql,
      "key,summary,reporter,created",
      1000
    );

    if (allIssues.length === 0) {
      const msg = `Нет задач со статусом "${statusName}"`;
      if (messageId) {
        await bot.editMessageText(escapeHtml(msg), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
        });
      } else {
        await bot.sendMessage(chatId, escapeHtml(msg), { parse_mode: "HTML" });
      }
      return;
    }

    const totalPages = Math.ceil(allIssues.length / TASKS_PER_PAGE);
    const startIdx = page * TASKS_PER_PAGE;
    const endIdx = Math.min(startIdx + TASKS_PER_PAGE, allIssues.length);
    const pageTasks = allIssues.slice(startIdx, endIdx);

    let text = `📋 ${escapeHtml(statusName)}\nВсего задач: ${
      allIssues.length
    }\nСтраница ${page + 1} из ${totalPages}\n\n`;

    pageTasks.forEach((issue) => {
      const date = new Date(issue.fields.created).toLocaleDateString("ru-RU");
      const summary = escapeHtml(String(issue.fields.summary || "")).slice(
        0,
        120
      );
      const author = escapeHtml(issue.fields.reporter?.displayName || "—");
      const key = escapeHtml(issue.key);

      text += `🔹 <a href="https://${process.env.JIRA_API_URL}/browse/${key}">${key}</a>\n`;
      text += `${summary}${issue.fields.summary.length > 120 ? "..." : ""}\n`;
      text += `👤 ${author} | 📅 ${date}\n\n`;
    });

    const buttons = createTaskButtons(pageTasks);

    const navButtons = createPaginationButtons(page, totalPages, statusName);
    if (navButtons.length) buttons.push(navButtons);

    const hidden = userData.hiddenStatuses || [];

    console.log("DEBUG hide/unhide check:", { fromHidden, hidden, statusName });

    if (hidden.includes(statusName) || fromHidden) {
      buttons.push([
        {
          text: "👁 Показать снова статус",
          callback_data: `unhide_status_${statusName}`,
        },
      ]);
      buttons.push([
        { text: "← К скрытым", callback_data: "show_hidden_statuses" },
      ]);
    } else {
      buttons.push([
        {
          text: "🙈 Скрыть статус",
          callback_data: `hide_status_${statusName}`,
        },
      ]);
      buttons.push([
        { text: "← К статусам", callback_data: "back_to_statuses" },
      ]);
    }

    if (messageId) {
      await bot.editMessageText(text + "\u200B", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: buttons },
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } else {
      await bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: buttons },
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    }
  } catch (error) {
    console.error("Error loading tasks:", error.message);
    await bot.sendMessage(chatId, "Ошибка загрузки задач");
  }
};

const showHiddenStatuses = async (bot, chatId, messageId = null) => {
  const userData = userStore.get(chatId);
  const hidden = userData.hiddenStatuses || [];
  userStore.set(chatId, {
    lastView: { type: "hidden_status", statusName: null },
  });

  if (hidden.length === 0) {
    const msg = "Нет скрытых статусов 👌";
    if (messageId) {
      return bot.editMessageText(msg, {
        chat_id: chatId,
        message_id: messageId,
      });
    }
    return bot.sendMessage(chatId, msg);
  }

  const buttons = hidden.map((status) => [
    {
      text: `${status}`,
      callback_data: `hidden_status_view_${status.replace(/ /g, "_")}`,
    },
  ]);

  buttons.push([{ text: "← Назад", callback_data: "back_to_statuses" }]);

  const text = "🙈 Скрытые статусы\nВыберите, чтобы открыть список задач:";
  const opts = { reply_markup: { inline_keyboard: buttons } };

  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...opts,
    });
  } else {
    await bot.sendMessage(chatId, text, opts);
  }
};

const showTaskEdit = async (bot, chatId, issueKey, messageId = null) => {
  const userData = userStore.get(chatId);

  if (!userData.token) {
    return bot.sendMessage(chatId, "Выполните /login");
  }

  try {
    const issue = await getIssue(userData.token, issueKey);

    const maxLength = 3000;
    const description = escapeHtml(
      issue.fields.description || "Описание отсутствует"
    );
    const key = escapeHtml(issue.key);
    const summary = escapeHtml(issue.fields.summary || "");
    const statusName = escapeHtml(issue.fields.status.name || "");
    const reporter = escapeHtml(issue.fields.reporter.displayName || "—");
    const assignee = escapeHtml(
      issue.fields.assignee?.displayName || "Не назначен"
    );

    let text = `📌 <a href="${process.env.JIRA_API_URL}/browse/${key}">${key}</a>\n\n`;
    text += `${summary}\n\n`;
    text += `📊 Статус: ${statusName}\n`;
    text += `👤 Автор: ${reporter}\n`;
    text += `🎯 Ответственный: ${assignee}\n\n`;
    text += `📝 Описание:\n${description.substring(
      0,
      maxLength - text.length - 100
    )}`;

    if (description.length > maxLength - text.length - 100) {
      text += "\n\n[Описание обрезано из-за длины]";
    }

    const buttons = createTaskEditButtons(chatId, issueKey);

    const lastView = userData.lastView || { type: "menu" };

    let backCallback = "back_to_menu";

    if (lastView.type === "status") {
      backCallback = `page_${lastView.statusName.replace(/ /g, "~")}_${
        lastView.page || 0
      }`;
    } else if (lastView.type === "hidden_status") {
      if (lastView.statusName) {
        backCallback = `hidden_status_view_${lastView.statusName.replace(
          / /g,
          "_"
        )}`;
      } else {
        backCallback = "show_hidden_statuses";
      }
    } else if (lastView.type === "filter") {
      backCallback = `filter_page_${lastView.filterName.replace(/ /g, "~")}_${
        lastView.page || 0
      }`;
    } else if (lastView.type === "filters_menu") {
      backCallback = "back_to_filters";
    }

    buttons[buttons.length - 1][0].callback_data = backCallback;

    const opts = {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (messageId) {
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...opts,
      });
    } else {
      bot.sendMessage(chatId, text, opts);
    }
  } catch (error) {
    console.error("Error loading task:", error);
    bot.sendMessage(chatId, "Ошибка загрузки задачи");
  }
};

module.exports = {
  showMyTasksStatuses,
  showTasksByStatus,
  showTaskEdit,
  showHiddenStatuses,
  escapeHtml,
};
