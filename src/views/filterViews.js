const { TASKS_PER_PAGE } = require("../config/jira");
const { searchIssues } = require("../services/jiraService");
const userStore = require("../utils/userStore");
const {
  createFilterButtons,
  createPaginationButtons,
} = require("../utils/keyboards");
const { escapeHtml } = require("./taskViews");

const showMyFilters = async (bot, chatId, messageId = null) => {
  const userData = userStore.get(chatId);
  const filters = userData.filters || [];

  const buttons = createFilterButtons(filters);
  const text = filters.length
    ? "🔎 Ваши фильтры:\n\nФильтры — это сохранённые поисковые запросы в Jira. Вы можете быстро просматривать задачи по нужным критериям, например, по статусу или дате.\n\n"
    : "У вас нет фильтров.\n\nФильтры — это сохранённые поисковые запросы в Jira. Они помогают быстро получать список задач по определённым условиям, например:\n- Все задачи в статусе «Готово»\n- Завершённые за последнюю неделю\n\nНажмите ➕ чтобы создать новый фильтр.";

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

const showTasksByFilter = async (
  bot,
  chatId,
  filter,
  page = 0,
  messageId = null
) => {
  const userData = userStore.get(chatId);

  userStore.set(chatId, {
    lastView: {
      type: "filter",
      filterName: filter.name,
      page,
    },
  });

  if (!userData?.token) {
    return bot.sendMessage(chatId, "Выполните /login");
  }

  try {
    const issues = await searchIssues(
      userData.token,
      filter.jql,
      "key,summary,reporter,created",
      1000
    );

    if (!issues.length) {
      const msg = `Нет задач по фильтру «${filter.name}»`;
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "← К фильтрам", callback_data: "back_to_filters" }],
          ],
        },
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      if (messageId) {
        return bot.editMessageText(msg, {
          chat_id: chatId,
          message_id: messageId,
          ...opts,
        });
      }
      return bot.sendMessage(chatId, msg);
    }

    const totalPages = Math.ceil(issues.length / TASKS_PER_PAGE);
    const start = page * TASKS_PER_PAGE;
    const pageTasks = issues.slice(start, start + TASKS_PER_PAGE);

    let text = `📋 ${escapeHtml(filter.name)}\nВсего задач: ${
      issues.length
    }\nСтраница ${page + 1} из ${totalPages}\n\n`;

    const buttons = [];

    pageTasks.forEach((i) => {
      text += `🔹 <a href="https://${process.env.JIRA_API_URL}/browse/${
        i.key
      }">${escapeHtml(i.key)} — ${escapeHtml(i.fields.summary)}</a>\n`;

      buttons.push([
        {
          text: `✏️ ${i.key}`,
          url: `https://t.me/${process.env.BOT_LOGIN}?start=taskedit_${i.key}`,
        },
      ]);
    });

    const navButtons = createPaginationButtons(
      page,
      totalPages,
      filter.name,
      "filter_page"
    );
    if (navButtons.length) buttons.push(navButtons);
    buttons.push([{ text: "← К фильтрам", callback_data: "back_to_filters" }]);

    if (messageId) {
      await bot.editMessageText(text, {
        chat_id: chatId,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: buttons },
        message_id: messageId,
      });
    } else {
      bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: buttons },
      });
    }
  } catch (e) {
    console.error(e);
    bot.sendMessage(chatId, "Ошибка выполнения фильтра");
  }
};

module.exports = {
  showMyFilters,
  showTasksByFilter,
};
