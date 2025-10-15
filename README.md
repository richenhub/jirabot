# Jira Telegram Bot

Telegram бот для управления задачами Jira.

## Возможности

- Просмотр задач по статусам
- Изменение статуса задачи
- Назначение ответственного
- Логирование времени работы
- Создание и использование JQL фильтров
- Уведомления о новых задачах

## Структура проекта

```
├── index.js                 # Точка входа
├── src/
│   ├── config/
│   │   └── jira.js         # Конфигурация Jira
│   ├── handlers/
│   │   ├── callbacks.js    # Обработчики callback кнопок
│   │   ├── commands.js     # Обработчики команд
│   │   └── messages.js     # Обработчики сообщений
│   ├── services/
│   │   ├── jiraService.js  # API Jira
│   │   └── notificationService.js
│   ├── utils/
│   │   ├── keyboards.js    # Клавиатуры
│   │   └── userStore.js    # Хранилище пользователей
│   └── views/
│       ├── filterViews.js  # Отображение фильтров
│       ├── settingsViews.js
│       └── taskViews.js    # Отображение задач
├── package.json
└── .env.example
```

## Установка

### Локально

1. Клонируйте репозиторий
2. Установите зависимости:

```bash
npm install
```

3. Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

4. Добавьте токен бота в `.env`:

```
TELEGRAM_TOKEN=your_bot_token
```

5. Запустите бота:

```bash
npm start          # Production
npm run dev        # Development с авто-перезагрузкой
```

### Развертывание на хостинге

#### Heroku

1. Создайте приложение:

```bash
heroku create your-app-name
```

2. Установите переменные окружения:

```bash
heroku config:set TELEGRAM_TOKEN=your_token
```

3. Задеплойте:

```bash
git push heroku main
```

#### Railway

1. Создайте новый проект на Railway
2. Подключите GitHub репозиторий
3. Добавьте переменную окружения `TELEGRAM_TOKEN`
4. Railway автоматически задеплоит приложение

#### VPS (Ubuntu/Debian)

1. Установите Node.js:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Клонируйте проект и установите зависимости:

```bash
git clone your-repo
cd jira-telegram-bot
npm install
```

3. Создайте `.env` файл с токеном

4. Установите PM2:

```bash
sudo npm install -g pm2
```

5. Запустите бота:

```bash
pm2 start index.js --name jira-bot
pm2 save
pm2 startup
```

## Использование

1. Найдите бота в Telegram
2. Отправьте `/start`
3. Отправьте `/login` и введите Jira токен
4. Используйте меню для работы с задачами

## Команды

- `/start` - Начало работы
- `/login` - Авторизация в Jira
- `/taskedit <KEY>` - Открыть задачу

## Требования

- Node.js >= 14
- Telegram Bot Token
- Jira Personal Access Token
