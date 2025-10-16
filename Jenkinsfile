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
        DEPLOY_DIR = '/opt/jbot'
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
                        credentialsId: '6a0b07eb-12fb-48a5-9352-3e9eb58fa0d7',
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
                    # Создать директорию (без sudo)
                    mkdir -p ${DEPLOY_DIR}
                    
                    # Остановить старое приложение
                    pm2 stop ${APP_NAME} || true
                    pm2 delete ${APP_NAME} || true
                    
                    # Скопировать новый код
                    rm -rf ${DEPLOY_DIR}/*
                    cp -r . ${DEPLOY_DIR}/
                    
                    # Запустить приложение
                    cd ${DEPLOY_DIR}
                    pm2 start ${APP_ENTRY} --name ${APP_NAME}
                    pm2 save
                    
                    echo "=== Deployment Complete ==="
                    pm2 list
                    pm2 describe ${APP_NAME}
                """
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful!'
            sh 'git log -1 --pretty=format:"Deployed: %h - %s"'
        }
        failure {
            echo '❌ Deployment failed!'
        }
    }
}