const userStore = require("../utils/userStore");
const { searchIssues, getIssue, getComments } = require("./jiraService");

let globalPollingInterval = null;
let botInstance = null;

const handleTokenError = (bot, chatId, username) => {
  userStore.set(chatId, {
    token: null,
    username: null,
    displayName: null,
    awaitingToken: false,
  });

  bot.sendMessage(
    chatId,
    "⚠️ Ваш токен недействителен или истёк.\nВыполните /login для повторной авторизации."
  );

  console.log(`🔒 Token reset for user ${username} (chatId: ${chatId})`);
};

const notifyAssigneeStatusChange = async (
  bot,
  assigneeUsername,
  issueKey,
  changedBy,
  oldStatus,
  newStatus,
  issue
) => {
  const allUsers = userStore.getAll();

  for (const user of allUsers) {
    if (user.username === assigneeUsername && user.token) {
      try {
        const message =
          `🔔 Изменен статус задачи, где вы ответственный:\n\n` +
          `📌 ${issue.key}\n` +
          `${issue.fields.summary}\n\n` +
          `👤 Изменил: ${changedBy}\n` +
          `📊 Статус: ${oldStatus} → ${newStatus}`;

        await bot.sendMessage(user.chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Открыть задачу",
                  url: `https://t.me/${process.env.BOT_LOGIN}?start=te_${issueKey}`,
                },
              ],
            ],
          },
        });

        console.log(
          `✅ Notified assignee ${assigneeUsername} (chatId: ${user.chatId}) about status change of task ${issueKey}`
        );
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          handleTokenError(bot, user.chatId, assigneeUsername);
        } else {
          console.error(
            `⚠️ Error notifying assignee ${assigneeUsername}:`,
            error.message
          );
        }
      }
      break;
    }
  }
};

const notifyNewAssignee = async (
  bot,
  newAssigneeUsername,
  issueKey,
  assignedBy
) => {
  const allUsers = userStore.getAll();

  for (const user of allUsers) {
    if (user.username === newAssigneeUsername && user.token) {
      try {
        const issue = await getIssue(user.token, issueKey);

        const message =
          `🔔 Вы назначены ответственным за задачу:\n\n` +
          `📌 ${issue.key}\n` +
          `${issue.fields.summary}\n\n` +
          `👤 Назначил: ${assignedBy}\n` +
          `📊 Статус: ${issue.fields.status.name}`;

        await bot.sendMessage(user.chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Открыть задачу",
                  url: `https://t.me/${process.env.BOT_LOGIN}?start=te_${issueKey}`,
                },
              ],
            ],
          },
        });

        console.log(
          `✅ Notified ${newAssigneeUsername} (chatId: ${user.chatId}) about task ${issueKey}`
        );
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          handleTokenError(bot, user.chatId, newAssigneeUsername);
        } else {
          console.error(
            `⚠️ Error notifying user ${newAssigneeUsername}:`,
            error.message
          );
        }
      }
      break;
    }
  }
};

const checkUserNotifications = async (bot, user) => {
  if (!user.token || !user.username) return;

  if (!user.notificationsEnabled && user.notificationsEnabled !== undefined) {
    return;
  }

  const filterIssues = [];

  if (user.filters?.length) {
    for (const filter of user.filters) {
      if (!filter.subscribed) continue;

      let jqlQuery = filter.jql;
      if (!/order\s+by/i.test(jqlQuery)) {
        jqlQuery += " ORDER BY updated DESC";
      }

      const issuesFromFilter = await searchIssues(
        user.token,
        jqlQuery,
        "key,summary,status,assignee,updated",
        50
      );
      filterIssues.push(...issuesFromFilter);
    }
  }

  const issues = [];
  const allIssuesToCheck = [...issues, ...filterIssues];
  const uniqueIssues = Array.from(
    new Map(allIssuesToCheck.map((i) => [i.key, i])).values()
  );

  try {
    const jql = `assignee=${user.username} AND updated >= -5m ORDER BY updated DESC`;
    const myIssues = await searchIssues(
      user.token,
      jql,
      "key,summary,status,assignee,updated",
      50
    );

    const lastCheckTime =
      user.lastNotificationCheck || Date.now() - 5 * 60 * 1000;
    const newAssignments = [];
    const statusChanges = [];

    for (const issue of uniqueIssues) {
      const updatedTime = new Date(issue.fields.updated).getTime();
      if (updatedTime > lastCheckTime) {
        const issueKey = issue.key;
        const prevState = user.issueStates?.[issueKey];

        if (prevState) {
          // Задача уже отслеживалась - проверяем изменения
          if (prevState.status !== issue.fields.status.name) {
            statusChanges.push({
              issue,
              oldStatus: prevState.status,
              newStatus: issue.fields.status.name,
            });
          }

          if (
            prevState.assignee !== issue.fields.assignee?.name &&
            issue.fields.assignee?.name === user.username
          ) {
            newAssignments.push(issue);
          }
        }
        // Если prevState нет - это первый раз видим задачу, просто сохраняем без уведомления
      }
    }

    if (newAssignments.length) {
      for (const issue of newAssignments) {
        const message =
          `🔔 Вы назначены ответственным за задачу:\n\n` +
          `📌 ${issue.key}\n` +
          `${issue.fields.summary}\n\n` +
          `📊 Статус: ${issue.fields.status.name}`;

        await bot.sendMessage(user.chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Открыть задачу",
                  url: `https://t.me/${process.env.BOT_LOGIN}?start=te_${issue.key}`,
                },
              ],
            ],
          },
        });

        console.log(
          `✅ Notified user ${user.username} about new assignment: ${issue.key}`
        );
      }
    }

    if (statusChanges.length > 0) {
      for (const change of statusChanges) {
        const message =
          `🔔 Изменен статус вашей задачи:\n\n` +
          `📌 ${change.issue.key}\n` +
          `${change.issue.fields.summary}\n\n` +
          `📊 Статус: ${change.oldStatus} → ${change.newStatus}`;

        await bot.sendMessage(user.chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Открыть задачу",
                  url: `https://t.me/${process.env.BOT_LOGIN}?start=te_${change.issue.key}`,
                },
              ],
            ],
          },
        });

        console.log(
          `✅ Notified user ${user.username} about status change: ${change.issue.key}`
        );
      }
    }

    const issueStates = {};
    for (const issue of uniqueIssues) {
      issueStates[issue.key] = {
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.name,
      };
    }

    userStore.set(user.chatId, {
      lastNotificationCheck: Date.now(),
      issueStates,
    });

    if (user.commentsNotificationsEnabled !== false) {
      const lastCommentCheck = user.lastCommentCheck || {};

      for (const issue of uniqueIssues) {
        const issueKey = issue.key;

        try {
          const comments = await getComments(user.token, issueKey);

          const lastCheck = lastCommentCheck[issueKey] || lastCheckTime;
          const newComments = comments.filter(
            (c) =>
              new Date(c.created).getTime() > lastCheck &&
              c.author.name !== user.username
          );

          if (newComments.length > 0) {
            let latestCommentTime = lastCheck;

            for (const comment of newComments) {
              const commentTime = new Date(comment.created).getTime();
              if (commentTime > latestCommentTime) {
                latestCommentTime = commentTime;
              }

              const commentBody = comment.body
                ? comment.body.substring(0, 200)
                : "";
              const message =
                `💬 Новый комментарий в вашей задаче:\n\n` +
                `📌 ${issue.key}\n` +
                `${issue.fields.summary}\n\n` +
                `👤 Автор: ${comment.author.displayName}\n` +
                `💭 ${commentBody}${
                  comment.body && comment.body.length > 200 ? "..." : ""
                }`;

              await bot.sendMessage(user.chatId, message, {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Открыть задачу",
                        url: `https://t.me/${process.env.BOT_LOGIN}?start=te_${issue.key}`,
                      },
                    ],
                  ],
                },
              });

              console.log(
                `✅ Notified user ${user.username} about comment in ${issue.key}`
              );
            }

            lastCommentCheck[issueKey] = latestCommentTime;
          }
        } catch (commentError) {
          console.error(
            `Error checking comments for ${issueKey}:`,
            commentError.message
          );
        }
      }

      userStore.set(user.chatId, { lastCommentCheck });
    }
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      handleTokenError(bot, user.chatId, user.username);
    } else {
      console.error(`Polling error for user ${user.username}:`, error.message);
    }
  }
};

const checkAllUsersNotifications = async () => {
  if (!botInstance) return;

  const allUsers = userStore.getAll();
  const activeUsers = allUsers.filter((user) => user.token && user.username);

  if (activeUsers.length === 0) return;

  for (const user of activeUsers) {
    console.log(
      `⏳ Проверяем пользователя: ${user.username} (chatId: ${user.chatId})`
    );
    await checkUserNotifications(botInstance, user);
  }
};

const startGlobalNotificationPolling = (bot) => {
  if (globalPollingInterval) {
    console.log("⚠️ Global polling already running");
    return;
  }

  botInstance = bot;

  globalPollingInterval = setInterval(
    checkAllUsersNotifications,
    5 * 60 * 1000
  );

  const allUsers = userStore.getAll();
  const activeUsers = allUsers.filter(
    (user) => user.token && user.username
  ).length;

  console.log(
    `🔔 Global notification polling started for all users (${activeUsers} active)`
  );

  checkAllUsersNotifications();
};

const stopGlobalNotificationPolling = () => {
  if (globalPollingInterval) {
    clearInterval(globalPollingInterval);
    globalPollingInterval = null;
    botInstance = null;
    console.log("🔕 Global notification polling stopped");
  }
};

module.exports = {
  notifyAssigneeStatusChange,
  notifyNewAssignee,
  startGlobalNotificationPolling,
  stopGlobalNotificationPolling,
  handleTokenError,
};
