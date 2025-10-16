properties([
    pipelineTriggers([
        githubPush()
    ])
])

pipeline {
    agent any

    // ДОБАВЬТЕ ЭТО ⬇️
    triggers {
        githubPush()  // Триггер на GitHub push
        pollSCM('H/5 * * * *')  // Опционально: проверка каждые 5 минут (если webhook не работает)
    }

    environment {
        NODE_ENV = 'production'
        APP_NAME = 'jira-bot'
        APP_ENTRY = 'index.js'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '📥 Cloning private repository...'
                git branch: 'main',
                    credentialsId: '6a0b07eb-12fb-48a5-9352-3e9eb58fa0d7',
                    url: 'https://github.com/richenhub/jirabot.git'
                
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
                sh 'npm run build || echo "No build script"'
            }
        }

        stage('Deploy') {
            steps {
                echo '🚀 Deploying application...'
                sh """
                    pm2 stop ${APP_NAME} || true
                    pm2 delete ${APP_NAME} || true
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