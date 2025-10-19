const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const userStore = require("./src/utils/userStore");
const {
  searchIssues,
  getIssue,
  changeStatus,
  getTransitions,
} = require("./src/services/jiraService");

function createWebAppServer(bot) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static("public"));

  // Функция проверки подлинности данных от Telegram
  function verifyTelegramWebAppData(telegramInitData) {
    const initData = new URLSearchParams(telegramInitData);
    const hash = initData.get("hash");
    initData.delete("hash");

    const dataCheckString = Array.from(initData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.TELEGRAM_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return calculatedHash === hash;
  }

  // Middleware для проверки Telegram данных и получения пользователя
  const authenticateWebApp = (req, res, next) => {
    const initData = req.headers["x-telegram-init-data"];

    if (!initData) {
      return res.status(401).json({ error: "No Telegram data provided" });
    }

    // Проверяем подлинность данных
    const isValid = verifyTelegramWebAppData(initData);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid Telegram data" });
    }

    // Парсим данные пользователя
    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    if (!userJson) {
      return res.status(400).json({ error: "No user data" });
    }

    const telegramUser = JSON.parse(userJson);
    const chatId = telegramUser.id;

    // Получаем данные пользователя из userStore
    const userData = userStore.get(chatId);

    if (!userData || !userData.token) {
      return res.status(404).json({
        error: "Not authorized",
        message: "Please use /login command in bot first",
      });
    }

    req.chatId = chatId;
    req.userData = userData;
    req.telegramUser = telegramUser;

    next();
  };

  // GET /api/user - Получить информацию о текущем пользователе
  app.get("/api/user", authenticateWebApp, (req, res) => {
    res.json({
      chatId: req.chatId,
      username: req.userData.username,
      displayName: req.userData.displayName,
      notificationsEnabled: req.userData.notificationsEnabled !== false,
      commentsNotificationsEnabled:
        req.userData.commentsNotificationsEnabled !== false,
      filters: req.userData.filters || [],
      hiddenStatuses: req.userData.hiddenStatuses || [],
    });
  });

  // GET /api/tasks - Получить список задач пользователя
  app.get("/api/tasks", authenticateWebApp, async (req, res) => {
    try {
      const { status, page = 0, limit = 500, jql } = req.query;

      let jqlQuery = jql || `assignee=${req.userData.username}`;

      if (status && !jql) {
        jqlQuery += ` AND status="${status}"`;
      }
      jqlQuery += " ORDER BY created DESC";

      const issues = await searchIssues(
        req.userData.token,
        jqlQuery,
        "key,summary,status,assignee,reporter,created,updated,priority",
        1000
      );

      // Пагинация
      const start = parseInt(page) * parseInt(limit);
      const paginatedIssues = issues.slice(start, start + parseInt(limit));

      res.json({
        total: issues.length,
        page: parseInt(page),
        limit: parseInt(limit),
        tasks: paginatedIssues.map((issue) => ({
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          assignee: issue.fields.assignee?.displayName || "Не назначен",
          reporter: issue.fields.reporter?.displayName || "—",
          created: issue.fields.created,
          updated: issue.fields.updated,
          priority: issue.fields.priority?.name || "—",
        })),
      });
    } catch (error) {
      console.error("Error loading tasks:", error);
      res.status(500).json({ error: "Failed to load tasks" });
    }
  });

  // GET /api/tasks/:key - Получить детальную информацию о задаче
  app.get("/api/tasks/:key", authenticateWebApp, async (req, res) => {
    try {
      const { key } = req.params;
      const issue = await getIssue(req.userData.token, key);

      res.json({
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || "Описание отсутствует",
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.displayName || "Не назначен",
        assigneeUsername: issue.fields.assignee?.name,
        reporter: issue.fields.reporter?.displayName || "—",
        created: issue.fields.created,
        updated: issue.fields.updated,
        priority: issue.fields.priority?.name || "—",
      });
    } catch (error) {
      console.error("Error loading task:", error);
      res.status(500).json({ error: "Failed to load task" });
    }
  });

  // GET /api/tasks/:key/transitions - Получить доступные переходы статусов
  app.get(
    "/api/tasks/:key/transitions",
    authenticateWebApp,
    async (req, res) => {
      try {
        const { key } = req.params;
        const transitions = await getTransitions(req.userData.token, key);

        // Фильтруем только переходы без обязательных полей
        const availableTransitions = transitions
          .filter((t) => {
            const fields = t.fields || {};
            const requiredFields = Object.keys(fields).filter(
              (key) => fields[key].required
            );
            return requiredFields.length === 0;
          })
          .map((t) => ({
            id: t.id,
            name: t.name,
          }));

        res.json({ transitions: availableTransitions });
      } catch (error) {
        console.error("Error loading transitions:", error);
        res.status(500).json({ error: "Failed to load transitions" });
      }
    }
  );

  // POST /api/tasks/:key/status - Изменить статус задачи
  app.post("/api/tasks/:key/status", authenticateWebApp, async (req, res) => {
    try {
      const { key } = req.params;
      const { transitionId } = req.body;

      if (!transitionId) {
        return res.status(400).json({ error: "transitionId is required" });
      }

      await changeStatus(req.userData.token, key, transitionId);

      res.json({ success: true, message: "Status changed successfully" });
    } catch (error) {
      console.error("Error changing status:", error);
      res.status(500).json({ error: "Failed to change status" });
    }
  });

  // GET /api/statuses - Получить статистику по статусам
  app.get("/api/statuses", authenticateWebApp, async (req, res) => {
    try {
      const jql = `assignee=${req.userData.username}`;
      const issues = await searchIssues(
        req.userData.token,
        jql,
        "status",
        1000
      );

      const statusCounts = {};
      issues.forEach((issue) => {
        const status = issue.fields.status.name;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Убираем скрытые статусы
      const hiddenStatuses = req.userData.hiddenStatuses || [];
      const visibleStatuses = Object.entries(statusCounts)
        .filter(([status]) => !hiddenStatuses.includes(status))
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      res.json({
        total: issues.length,
        statuses: visibleStatuses,
      });
    } catch (error) {
      console.error("Error loading statuses:", error);
      res.status(500).json({ error: "Failed to load statuses" });
    }
  });

  // GET /api/filters - Получить фильтры пользователя
  app.get("/api/filters", authenticateWebApp, (req, res) => {
    const filters = req.userData.filters || [];
    res.json({ filters });
  });

  app.put("/api/filters/:index/subscribe", authenticateWebApp, (req, res) => {
    try {
      const { index } = req.params;
      const filters = req.userData.filters || [];
      const filter = filters[parseInt(index)];

      if (!filter) {
        return res.status(404).json({ error: "Filter not found" });
      }

      // Переключаем подписку
      filter.subscribed = !filter.subscribed;
      userStore.set(req.chatId, { filters });

      res.json({
        success: true,
        subscribed: filter.subscribed,
        message: filter.subscribed ? "Подписка активна" : "Подписка отключена",
      });
    } catch (error) {
      console.error("Error toggling subscription:", error);
      res.status(500).json({ error: "Failed to toggle subscription" });
    }
  });

  // POST /api/filters/:index/tasks - Получить задачи по фильтру
  app.post(
    "/api/filters/:index/tasks",
    authenticateWebApp,
    async (req, res) => {
      try {
        const { index } = req.params;
        const { page = 0, limit = 20 } = req.body;

        const filters = req.userData.filters || [];
        const filter = filters[parseInt(index)];

        if (!filter) {
          return res.status(404).json({ error: "Filter not found" });
        }

        const issues = await searchIssues(
          req.userData.token,
          filter.jql,
          "key,summary,status,assignee,reporter,created",
          1000
        );

        const start = parseInt(page) * parseInt(limit);
        const paginatedIssues = issues.slice(start, start + parseInt(limit));

        res.json({
          total: issues.length,
          page: parseInt(page),
          limit: parseInt(limit),
          tasks: paginatedIssues.map((issue) => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            assignee: issue.fields.assignee?.displayName || "Не назначен",
            reporter: issue.fields.reporter?.displayName || "—",
            created: issue.fields.created,
          })),
        });
      } catch (error) {
        console.error("Error loading filter tasks:", error);
        res.status(500).json({ error: "Failed to load tasks" });
      }
    }
  );

  // PUT /api/settings - Обновить настройки пользователя
  app.put("/api/settings", authenticateWebApp, (req, res) => {
    try {
      const { notificationsEnabled, commentsNotificationsEnabled } = req.body;

      const updates = {};
      if (typeof notificationsEnabled === "boolean") {
        updates.notificationsEnabled = notificationsEnabled;
      }
      if (typeof commentsNotificationsEnabled === "boolean") {
        updates.commentsNotificationsEnabled = commentsNotificationsEnabled;
      }

      userStore.set(req.chatId, updates);

      res.json({ success: true, message: "Settings updated" });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  return app;
}

module.exports = { createWebAppServer };
