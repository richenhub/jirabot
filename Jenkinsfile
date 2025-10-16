pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
        APP_NAME = 'jira-bot'
        APP_ENTRY = 'index.js'
        // Используйте credentials вместо токена в URL
        GIT_CREDENTIALS = credentials('github-token-id') 
    }

    stages {
        stage('Checkout') {
            steps {
                echo '📥 Cloning repository...'
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[ 
                        url: 'https://github.com/richenhub/jirabot.git',
                        credentialsId: 'github-token-id' // ID из Jenkins Credentials
                    ]],
                    extensions: [
                        [$class: 'CloneOption', noTags: false, shallow: false, depth: 0, timeout: 20]
                    ]
                ])
                sh 'git log -1 --oneline'
            }
        }

        stage('Install dependencies') {
            steps {
                echo '📦 Installing dependencies...'
                sh 'node -v && npm -v'
                sh 'npm ci'
            }
        }

        stage('Build / Validate') {
            steps {
                echo '🔨 Building and validating...'
                // Добавьте ваши команды сборки/валидации
                sh 'npm run build || true'  // если есть build скрипт
                sh 'npm test || true'       // если есть тесты
            }
        }

        stage('Deploy') {
            steps {
                echo '🚀 Deploying application...'
                // Пример с PM2
                sh """
                    pm2 stop ${APP_NAME} || true
                    pm2 start ${APP_ENTRY} --name ${APP_NAME}
                    pm2 save
                """
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}