// Инициализация Telegram WebApp
let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Применяем тему
document.body.style.backgroundColor = tg.themeParams.bg_color || "#f5f5f5";

// API URL
const API_URL = window.location.origin + "/api";

// Глобальные переменные
let currentUser = null;
let allTasks = [];
let filteredTasks = [];
let currentPage = 0;
const tasksPerPage = 10;
let availableStatuses = [];

// API запросы
async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": tg.initData,
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "API Error");
  }

  return response.json();
}

// Загрузка пользователя
async function loadUserInfo() {
  try {
    currentUser = await apiRequest("/user");
    document.getElementById("user-info").textContent =
      currentUser.displayName || currentUser.username;
  } catch (error) {
    console.error("Error loading user:", error);
    document.getElementById("user-info").textContent = "Ошибка загрузки";
    tg.showAlert("Пожалуйста, выполните /login в боте");
  }
}

// Переключение вкладок
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;

    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".content")
      .forEach((c) => c.classList.remove("active"));

    tab.classList.add("active");
    document.getElementById(`${tabName}-content`).classList.add("active");

    if (tabName === "filters") {
      loadFilters();
    } else if (tabName === "settings") {
      loadSettings();
    } else if (tabName === "tasks") {
      loadTasks();
    }

    tg.HapticFeedback.impactOccurred("light");
  });
});

// Загрузка задач
async function loadTasks() {
  tg.HapticFeedback.impactOccurred("light");
  showLoading();

  try {
    const assigneeFilter = document.getElementById("assignee-filter").value;

    let jql = "";
    if (assigneeFilter === "me") {
      jql = `assignee=${currentUser.username}`;
    } else if (assigneeFilter === "unassigned") {
      jql = "assignee is EMPTY";
    }
    // Для "all" - без фильтра по assignee

    const url = jql
      ? `/tasks?jql=${encodeURIComponent(jql)}&limit=500`
      : "/tasks?limit=500";
    const data = await apiRequest(url);

    allTasks = data.tasks || [];

    // Собираем уникальные статусы
    availableStatuses = [...new Set(allTasks.map((t) => t.status))].sort();
    updateStatusFilter();
    updateStatsBar();

    applyFilters();
  } catch (error) {
    console.error("Error loading tasks:", error);
    showError(error.message);
  }
}

// Обновление фильтра статусов
function updateStatusFilter() {
  const statusFilter = document.getElementById("status-filter");
  statusFilter.innerHTML = '<option value="">📊 Все статусы</option>';

  availableStatuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusFilter.appendChild(option);
  });
}

// Обновление статистики
function updateStatsBar() {
  const statsBar = document.getElementById("stats-bar");
  const statusCounts = {};

  allTasks.forEach((task) => {
    statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
  });

  let html = "";
  html += `<div class="stat-card active" onclick="filterByStatus('')">
        <div class="stat-value">${allTasks.length}</div>
        <div class="stat-label">Всего</div>
    </div>`;

  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      html += `<div class="stat-card" onclick="filterByStatus('${status}')">
                <div class="stat-value">${count}</div>
                <div class="stat-label">${status}</div>
            </div>`;
    });

  statsBar.innerHTML = html;
}

// Фильтр по статусу из статистики
function filterByStatus(status) {
  document.getElementById("status-filter").value = status;
  applyFilters();

  // Обновляем активность карточек
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.classList.remove("active");
  });
  event.currentTarget.classList.add("active");

  tg.HapticFeedback.impactOccurred("light");
}

async function applyFilters() {
  const applyBtn = event?.target;
  if (applyBtn) {
    applyBtn.disabled = true;
    // applyBtn.textContent = "⏳ Применяю...";
  }

  tg.HapticFeedback.impactOccurred("medium");
  showLoading();

  await new Promise((resolve) => setTimeout(resolve, 300));

  const searchText = document
    .getElementById("search-input")
    .value.toLowerCase();
  const statusFilter = document.getElementById("status-filter").value;
  const priorityFilter = document.getElementById("priority-filter").value;
  const dateFilter = document.getElementById("date-filter").value;

  filteredTasks = allTasks.filter((task) => {
    if (
      searchText &&
      !task.summary.toLowerCase().includes(searchText) &&
      !task.key.toLowerCase().includes(searchText)
    ) {
      return false;
    }

    if (statusFilter && task.status !== statusFilter) {
      return false;
    }

    if (priorityFilter && task.priority !== priorityFilter) {
      return false;
    }

    if (dateFilter && dateFilter !== "custom") {
      const taskDate = new Date(task.created);
      const now = new Date();

      if (dateFilter === "today") {
        if (taskDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (taskDate < weekAgo) return false;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (taskDate < monthAgo) return false;
      }
    }

    return true;
  });

  currentPage = 0;
  renderTasks();

  if (applyBtn) {
    applyBtn.disabled = false;
    // applyBtn.textContent = "Применить";
  }

  //   tg.showPopup({
  //     title: "Фильтры применены",
  //     message: `Найдено задач: ${filteredTasks.length}`,
  //     buttons: [{ id: "ok", type: "ok" }],
  //   });
}

// Сброс фильтров
function resetFilters() {
  document.getElementById("search-input").value = "";
  document.getElementById("assignee-filter").value = "me";
  document.getElementById("status-filter").value = "";
  document.getElementById("priority-filter").value = "";
  document.getElementById("date-filter").value = "";

  loadTasks();
  tg.HapticFeedback.impactOccurred("medium");
}

// Отображение задач
function renderTasks() {
  const tasksList = document.getElementById("tasks-list");

  if (filteredTasks.length === 0) {
    tasksList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3>Задачи не найдены</h3>
                <p>Попробуйте изменить фильтры</p>
            </div>
        `;
    document.getElementById("pagination").style.display = "none";
    return;
  }

  const start = currentPage * tasksPerPage;
  const end = start + tasksPerPage;
  const pageTasks = filteredTasks.slice(start, end);

  let html = '<div class="task-list">';
  pageTasks.forEach((task) => {
    const priorityClass = task.priority
      ? `priority-${task.priority.toLowerCase()}`
      : "";
    html += `
            <div class="task-card" onclick="openTask('${task.key}')">
                <div class="task-header">
                    <div class="task-key">${task.key}</div>
                    ${
                      task.priority
                        ? `<div class="task-priority ${priorityClass}">${task.priority}</div>`
                        : ""
                    }
                </div>
                <div class="task-summary">${task.summary}</div>
                <div class="task-meta">
                    <span>📊 <span class="status-badge">${
                      task.status
                    }</span></span>
                    <span>👤 ${task.assignee}</span>
                    ${
                      task.created
                        ? `<span>📅 ${new Date(task.created).toLocaleDateString(
                            "ru-RU"
                          )}</span>`
                        : ""
                    }
                </div>
            </div>
        `;
  });
  html += "</div>";

  tasksList.innerHTML = html;
  renderPagination();
}

// Пагинация
function renderPagination() {
  const pagination = document.getElementById("pagination");
  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);

  if (totalPages <= 1) {
    pagination.style.display = "none";
    return;
  }

  pagination.style.display = "flex";

  let html = "";

  // Кнопка "Назад"
  html += `<button class="pagination-btn" onclick="changePage(${
    currentPage - 1
  })" ${currentPage === 0 ? "disabled" : ""}>←</button>`;

  // Показываем первую страницу
  if (currentPage > 2) {
    html += `<button class="pagination-btn" onclick="changePage(0)">1</button>`;
    if (currentPage > 3) html += `<span style="padding: 8px;">...</span>`;
  }

  // Показываем страницы вокруг текущей
  for (
    let i = Math.max(0, currentPage - 2);
    i <= Math.min(totalPages - 1, currentPage + 2);
    i++
  ) {
    html += `<button class="pagination-btn ${
      i === currentPage ? "active" : ""
    }" onclick="changePage(${i})">${i + 1}</button>`;
  }

  // Показываем последнюю страницу
  if (currentPage < totalPages - 3) {
    if (currentPage < totalPages - 4)
      html += `<span style="padding: 8px;">...</span>`;
    html += `<button class="pagination-btn" onclick="changePage(${
      totalPages - 1
    })">${totalPages}</button>`;
  }

  // Кнопка "Вперёд"
  html += `<button class="pagination-btn" onclick="changePage(${
    currentPage + 1
  })" ${currentPage >= totalPages - 1 ? "disabled" : ""}>→</button>`;

  pagination.innerHTML = html;
}

function changePage(page) {
  currentPage = page;
  renderTasks();
  window.scrollTo(0, 0);
  tg.HapticFeedback.impactOccurred("light");
}

// Открытие детали задачи
async function openTask(key) {
  tg.HapticFeedback.impactOccurred("medium");

  const tasksList = document.getElementById("tasks-list");
  tasksList.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Загрузка задачи...</p>
        </div>
    `;

  try {
    const task = await apiRequest(`/tasks/${key}`);

    tasksList.innerHTML = `
            <div class="task-detail">
                <div class="task-detail-header">
                    <div class="task-detail-key">${task.key}</div>
                    <div class="task-detail-summary">${task.summary}</div>
                </div>
                
                <div class="task-detail-section">
                    <h3>Статус</h3>
                    <p><span class="status-badge">${task.status}</span></p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Ответственный</h3>
                    <p>👤 ${task.assignee}</p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Автор</h3>
                    <p>👤 ${task.reporter}</p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Приоритет</h3>
                    <p>${task.priority}</p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Создано</h3>
                    <p>${new Date(task.created).toLocaleString("ru-RU")}</p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Обновлено</h3>
                    <p>${new Date(task.updated).toLocaleString("ru-RU")}</p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Описание</h3>
                    <p>${task.description}</p>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn" onclick="changeStatus('${
                      task.key
                    }')">🔄 Статус</button>
                    <button class="action-btn" onclick="openInJira('${
                      task.key
                    }')">🔗 Открыть в Jira</button>
                </div>
                
                <button class="btn-primary" onclick="backToList()">← Назад к списку</button>
            </div>
        `;
  } catch (error) {
    console.error("Error loading task:", error);
    tg.showAlert("Ошибка загрузки задачи: " + error.message);
    backToList();
  }
}

function backToList() {
  renderTasks();
  tg.HapticFeedback.impactOccurred("light");
}

function openInJira(key) {
  const jiraUrl = `${
    window.location.protocol
  }//${window.location.hostname.replace("api.", "")}/browse/${key}`;
  tg.openLink(jiraUrl);
}

// Смена статуса
async function changeStatus(key) {
  tg.HapticFeedback.impactOccurred("medium");

  try {
    const data = await apiRequest(`/tasks/${key}/transitions`);

    if (data.transitions.length === 0) {
      tg.showAlert("Нет доступных переходов статуса");
      return;
    }

    // Показываем popup с выбором статуса (максимум 3)
    const buttons = data.transitions.slice(0, 3).map((t) => ({
      id: `transition_${t.id}`,
      type: "default",
      text: t.name,
    }));

    buttons.push({ id: "cancel", type: "cancel" });

    const result = await tg.showPopup({
      title: "Выберите новый статус",
      message: `Задача: ${key}`,
      buttons: buttons,
    });

    if (result && result.startsWith("transition_")) {
      const transitionId = result.replace("transition_", "");
      await apiRequest(`/tasks/${key}/status`, {
        method: "POST",
        body: JSON.stringify({ transitionId }),
      });

      tg.showAlert("✅ Статус изменён");

      // Обновляем задачу в списке
      const taskIndex = allTasks.findIndex((t) => t.key === key);
      if (taskIndex !== -1) {
        const updatedTask = await apiRequest(`/tasks/${key}`);
        allTasks[taskIndex].status = updatedTask.status;
      }

      openTask(key);
    }
  } catch (error) {
    console.error("Error changing status:", error);
    tg.showAlert("Ошибка смены статуса");
  }
}

// Загрузка фильтров
async function loadFilters() {
  const filtersContent = document.getElementById("filters-content");

  try {
    const data = await apiRequest("/filters");

    if (data.filters.length === 0) {
      filtersContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3>Нет фильтров</h3>
                    <p>Создайте первый фильтр для быстрого поиска задач</p>
                    <button class="btn-primary" onclick="addFilter()">➕ Добавить фильтр</button>
                </div>
            `;
      return;
    }

    let html = '<div class="filter-list">';
    data.filters.forEach((filter, index) => {
      html += `
                <div class="filter-card" onclick="openFilter(${index})">
                    <div class="filter-info">
                        <h3>${filter.name}</h3>
                        <p>${filter.jql}</p>
                    </div>
                    <div class="filter-actions">
                        <button class="icon-btn" onclick="event.stopPropagation(); toggleFilterSubscription(${index})">
                            ${filter.subscribed ? "🔔" : "🔕"}
                        </button>
                    </div>
                </div>
            `;
    });
    html += "</div>";
    html +=
      '<button class="btn-primary" onclick="addFilter()">➕ Добавить фильтр</button>';

    filtersContent.innerHTML = html;
  } catch (error) {
    console.error("Error loading filters:", error);
    filtersContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Ошибка загрузки</h3>
                <p>${error.message}</p>
            </div>
        `;
  }
}

async function openFilter(index) {
  tg.HapticFeedback.impactOccurred("medium");

  const filtersContent = document.getElementById("filters-content");
  filtersContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Загрузка задач по фильтру...</p>
        </div>
    `;

  try {
    const filtersData = await apiRequest("/filters");
    const filter = filtersData.filters[index];

    if (!filter) {
      throw new Error("Фильтр не найден");
    }

    const data = await apiRequest(`/filters/${index}/tasks`, {
      method: "POST",
      body: JSON.stringify({ page: 0, limit: 500 }),
    });

    if (data.tasks.length === 0) {
      filtersContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>Нет задач</h3>
                    <p>По фильтру "${filter.name}" задачи не найдены</p>
                    <button class="btn-primary" onclick="loadFilters()">← Назад к фильтрам</button>
                </div>
            `;
      return;
    }

    let html = `
            <div style="background: var(--tg-theme-secondary-bg-color, #fff); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <h3 style="margin-bottom: 8px;">🔎 ${filter.name}</h3>
                <p>${filter.jql}</p>
                <p style="font-size: 12px; color: var(--tg-theme-hint-color, #999);">Найдено: ${data.tasks.length}</p>
            </div>
            <div class="task-list">`;

    data.tasks.forEach((task) => {
      const priorityClass = task.priority
        ? `priority-${task.priority.toLowerCase()}`
        : "";
      html += `
                <div class="task-card" onclick="openTaskFromFilter('${
                  task.key
                }')">
                    <div class="task-header">
                        <div class="task-key">${task.key}</div>
                        ${
                          task.priority
                            ? `<div class="task-priority ${priorityClass}">${task.priority}</div>`
                            : ""
                        }
                    </div>
                    <div class="task-summary">${task.summary}</div>
                    <div class="task-meta">
                        <span>📊 <span class="status-badge">${
                          task.status
                        }</span></span>
                        <span>👤 ${task.assignee}</span>
                        ${
                          task.created
                            ? `<span>📅 ${new Date(
                                task.created
                              ).toLocaleDateString("ru-RU")}</span>`
                            : ""
                        }
                    </div>
                </div>
            `;
    });

    html += `
            </div>
            <button class="btn-primary" onclick="loadFilters()">← Назад к фильтрам</button>
        `;

    filtersContent.innerHTML = html;
  } catch (error) {
    console.error("Error loading filter tasks:", error);
    tg.showAlert("Ошибка загрузки задач по фильтру");
    loadFilters();
  }
}

async function openTaskFromFilter(key) {
  tg.HapticFeedback.impactOccurred("medium");

  const filtersContent = document.getElementById("filters-content");
  filtersContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Загрузка задачи...</p>
        </div>
    `;

  try {
    const task = await apiRequest(`/tasks/${key}`);

    filtersContent.innerHTML = `
            <div class="task-detail">
                <div class="task-detail-header">
                    <div class="task-detail-key">${task.key}</div>
                    <div class="task-detail-summary">${task.summary}</div>
                </div>
                
                <div class="task-detail-section">
                    <h3>Статус</h3>
                    <p><span class="status-badge">${task.status}</span></p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Ответственный</h3>
                    <p>👤 ${task.assignee}</p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Автор</h3>
                    <p>👤 ${task.reporter}</p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Приоритет</h3>
                    <p>${task.priority}</p>
                </div>
                
                <div class="task-detail-section">
                    <h3>Описание</h3>
                    <p>${task.description}</p>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn" onclick="changeStatusFromFilter('${task.key}')">🔄 Статус</button>
                    <button class="action-btn" onclick="openInJira('${task.key}')">🔗 Jira</button>
                </div>
                
                <button class="btn-primary" onclick="loadFilters()">← Назад к фильтрам</button>
            </div>
        `;
  } catch (error) {
    console.error("Error loading task:", error);
    tg.showAlert("Ошибка загрузки задачи");
    loadFilters();
  }
}

async function changeStatusFromFilter(key) {
  await changeStatus(key);
  // После смены статуса возвращаемся к фильтрам
  setTimeout(() => loadFilters(), 1000);
}

function addFilter() {
  tg.HapticFeedback.impactOccurred("medium");

  // Открываем бота для создания фильтра
  tg.showPopup(
    {
      title: "Создание фильтра",
      message:
        "Создание фильтров доступно через бот в разделе 🔎 Мои фильтры. Открыть бота?",
      buttons: [
        { id: "cancel", type: "cancel" },
        { id: "open", type: "default", text: "Открыть бот" },
      ],
    },
    (buttonId) => {
      if (buttonId === "open") {
        tg.close();
      }
    }
  );
}

async function toggleFilterSubscription(index) {
  tg.HapticFeedback.impactOccurred("light");

  try {
    const result = await apiRequest(`/api/filters/${index}/subscribe`, {
      method: "PUT",
    });

    // Перезагружаем фильтры чтобы обновить иконку
    await loadFilters();

    // Показываем уведомление
    tg.showPopup({
      title: result.subscribed
        ? "🔔 Подписка включена"
        : "🔕 Подписка отключена",
      message: result.message,
      buttons: [{ id: "ok", type: "ok" }],
    });
  } catch (error) {
    console.error("Error toggling subscription:", error);
    tg.showAlert("Ошибка изменения подписки");
  }
}

// Загрузка настроек
async function loadSettings() {
  try {
    const user = await apiRequest("/user");

    const settingsList = document.querySelector(".settings-list");
    const toggles = settingsList.querySelectorAll(".toggle");

    toggles[0].classList.toggle("active", user.notificationsEnabled);
    toggles[1].classList.toggle("active", user.commentsNotificationsEnabled);
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

async function toggleSetting(element, type) {
  element.classList.toggle("active");
  tg.HapticFeedback.impactOccurred("light");

  const isActive = element.classList.contains("active");

  try {
    if (type === "notifications") {
      await apiRequest("/settings", {
        method: "PUT",
        body: JSON.stringify({ notificationsEnabled: isActive }),
      });
    } else if (type === "comments") {
      await apiRequest("/settings", {
        method: "PUT",
        body: JSON.stringify({ commentsNotificationsEnabled: isActive }),
      });
    }
  } catch (error) {
    console.error("Error updating settings:", error);
    element.classList.toggle("active");
    tg.showAlert("Ошибка сохранения настроек");
  }
}

// Вспомогательные функции
function showLoading() {
  document.getElementById("tasks-list").innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Загрузка задач...</p>
        </div>
    `;
}

function showError(message) {
  document.getElementById("tasks-list").innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Ошибка загрузки</h3>
            <p>${message}</p>
            <button class="btn-primary" onclick="loadTasks()">Повторить</button>
        </div>
    `;
}

// Обработчики для поиска в реальном времени
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFilters();
      }, 500);
    });
  }
});

// Главная кнопка Telegram
tg.MainButton.setText("Закрыть");
tg.MainButton.show();
tg.MainButton.onClick(() => {
  tg.close();
});

// Инициализация при загрузке
loadUserInfo().then(() => {
  loadTasks();
});
