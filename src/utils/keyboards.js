const userStore = require("./userStore");

const mainMenu = {
  reply_markup: {
    keyboard: [
      ["📋 Мои задачи"],
      ["🔎 Мои фильтры"],
      ["🔔 Настройки уведомлений"],
    ],
    resize_keyboard: true,
  },
};

const createStatusButtons = (statusCounts, hiddenStatuses = []) => {
  const visibleStatuses = Object.entries(statusCounts)
    .filter(([status]) => !hiddenStatuses.includes(status))
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => [
      {
        text: `${status} (${count})`,
        callback_data: `status_view_${status.replace(/ /g, "_")}`,
      },
    ]);

  const buttons = [...visibleStatuses];

  if (hiddenStatuses.length > 0) {
    buttons.push([
      { text: "🙈 Скрытые статусы", callback_data: "show_hidden_statuses" },
    ]);
  }

  buttons.push([{ text: "← Назад", callback_data: "back_to_menu" }]);
  return buttons;
};

const createTaskButtons = (pageTasks) => {
  return pageTasks.map((issue) => [
    {
      text: `✏️ ${issue.key}`,
      url: `https://t.me/${process.env.BOT_LOGIN}?start=te_${issue.key}`,
    },
  ]);
};

const createPaginationButtons = (
  page,
  totalPages,
  statusName,
  prefix = "page"
) => {
  const buttons = [];
  if (page > 0) {
    buttons.push({
      text: "⬅️ Назад",
      callback_data: `${prefix}_${statusName.replace(/ /g, "~")}_${page - 1}`,
    });
  }
  if (page < totalPages - 1) {
    buttons.push({
      text: "Вперёд ➡️",
      callback_data: `${prefix}_${statusName.replace(/ /g, "~")}_${page + 1}`,
    });
  }
  return buttons;
};

const createTaskEditButtons = (chatId, issueKey) => {
  const userData = userStore.get(chatId);
  let backCallback = "back_to_menu";

  const lastView = userData.lastView;

  if (lastView) {
    if (lastView.type === "status")
      backCallback = `page_${lastView.statusName.replace(/ /g, "~")}_${
        lastView.page
      }`;
    else if (lastView.type === "filter")
      backCallback = `filter_page_${lastView.filterName.replace(/ /g, "~")}_${
        lastView.page
      }`;
    else if (lastView.type === "hidden_status")
      backCallback = `hidden_status_view_${lastView.statusName.replace(
        / /g,
        "_"
      )}`;
  }

  return [
    [{ text: "🔄 Сменить статус", callback_data: `change_status_${issueKey}` }],
    [
      {
        text: "👤 Сменить ответственного",
        callback_data: `change_assignee_${issueKey}`,
      },
    ],
    [
      {
        text: "⏱ Добавить время работы",
        callback_data: `log_work_${issueKey}`,
      },
      { text: "📊 История времени", callback_data: `view_worklog_${issueKey}` },
    ],
    [{ text: "← Назад", callback_data: backCallback }],
  ];
};

const createNotificationButtons = (enabled) => {
  return [
    [
      {
        text: enabled ? "✅ Включены" : "⚠️ Выключены",
        callback_data: "toggle_notifications",
      },
    ],
    [{ text: "← Назад", callback_data: "back_to_menu" }],
  ];
};

const createFilterButtons = (filters) => {
  const buttons = filters.map((f, idx) => [
    { text: `▶ ${f.name}`, callback_data: `filter_view_${idx}` },
    {
      text: f.subscribed ? "🔔" : "🔕",
      callback_data: `filter_subscribe_${idx}`,
    },
    { text: "🗑", callback_data: `filter_delete_${idx}` },
  ]);
  buttons.push([{ text: "➕ Добавить фильтр", callback_data: "filter_add" }]);
  buttons.push([{ text: "← Назад", callback_data: "back_to_menu" }]);
  return buttons;
};

module.exports = {
  mainMenu,
  createStatusButtons,
  createTaskButtons,
  createPaginationButtons,
  createTaskEditButtons,
  createNotificationButtons,
  createFilterButtons,
};
