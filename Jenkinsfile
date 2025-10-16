properties([
    pipelineTriggers([
        githubPush()
    ])
])

pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
        APP_NAME = 'jira-bot'
        APP_ENTRY = 'index.js'
        DEPLOY_DIR = '/opt/jirabot' 
    }

    options {
        skipDefaultCheckout()
    }

    stages {
        stage('Checkout') {
            steps {
                echo '📥 Fetching latest code from GitHub...'
                deleteDir()
                
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        credentialsId: 'github-token',
                        url: 'https://github.com/richenhub/jirabot.git'
                    ]]
                ])
                
                sh 'git log -1 --pretty=format:"%h - %s - %an"'
            }
        }

        stage('Install dependencies') {
            steps {
                echo '📦 Installing dependencies...'
                sh 'npm ci --production'
            }
        }

        stage('Deploy') {
            steps {
                echo '🚀 Deploying application...'
                sh """
                    # Создать директорию если не существует
                    sudo mkdir -p ${DEPLOY_DIR}
                    
                    # Остановить старое приложение
                    pm2 stop ${APP_NAME} || true
                    pm2 delete ${APP_NAME} || true
                    
                    # Скопировать новый код
                    echo "Copying files to ${DEPLOY_DIR}..."
                    sudo rm -rf ${DEPLOY_DIR}/*
                    sudo cp -r . ${DEPLOY_DIR}/
                    
                    # Установить права
                    sudo chown -R jenkins:jenkins ${DEPLOY_DIR}
                    
                    # Запустить из продакшен директории
                    cd ${DEPLOY_DIR}
                    pm2 start ${APP_ENTRY} --name ${APP_NAME}
                    pm2 save
                    
                    # Показать статус
                    echo "=== Deployment Info ==="
                    echo "Deployed to: ${DEPLOY_DIR}"
                    pm2 describe ${APP_NAME} | grep -E "script path|cwd|status"
                """
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful!'
            sh """
                echo "Deployed commit:"
                git log -1 --pretty=format:"%h - %s"
                echo ""
                echo "Application running at: ${DEPLOY_DIR}"
            """
        }
        failure {
            echo '❌ Deployment failed!'
        }
    }
}