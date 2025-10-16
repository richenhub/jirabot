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
      return bot.sendMessage(chatId, msg, opts);
    }

    const totalPages = Math.ceil(issues.length / TASKS_PER_PAGE);
    const start = page * TASKS_PER_PAGE;
    const pageTasks = issues.slice(start, start + TASKS_PER_PAGE);

    let text = `📋 ${escapeHtml(filter.name)}\nВсего задач: ${
      issues.length
    }\nСтраница ${page + 1} из ${totalPages}\n\nJQL: ${filter.jql}\n\n`;

    console.log(pageTasks);

    const buttons = pageTasks.map((i) => {
      text += `🔹 <a href="${process.env.JIRA_API_URL}/browse/${i.key}">${i.key}</a> - ${i.fields.summary}\n`;

      console.log({ text });

      return [
        {
          text: `${i.key}`,
          callback_data: `te_${i.key}`,
        },
      ];
    });

    const navButtons = [];
    if (page > 0)
      navButtons.push({
        text: "⬅️ Назад",
        callback_data: `filter_page_${filter.name.replace(/ /g, "~")}_${
          page - 1
        }`,
      });
    if (page + 1 < totalPages)
      navButtons.push({
        text: "➡️ Вперёд",
        callback_data: `filter_page_${filter.name.replace(/ /g, "~")}_${
          page + 1
        }`,
      });
    if (navButtons.length) buttons.push(navButtons);

    buttons.push([{ text: "← К фильтрам", callback_data: "back_to_filters" }]);

    console.log({ navButtons });

    const opts = {
      chat_id: chatId,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons },
      message_id: messageId,
    };

    if (messageId) {
      await bot.editMessageText(text, opts);
    } else {
      await bot.sendMessage(chatId, text, opts);
    }
  } catch (e) {
    bot.sendMessage(
      chatId,
      "Ошибка выполнения фильтра: " + filter.jql + "/" + e.message
    );
  }
};

module.exports = {
  showMyFilters,
  showTasksByFilter,
};
