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
                        credentialsId: 'github-ssh',  // ← ИСПРАВЛЕНО
                        url: 'https://github.com/richenhub/jirabot.git'
                    ]]
                ])
                
                sh 'git log -3 --oneline'
            }
        }

        stage('Install dependencies') {
            steps {
                echo '📦 Installing dependencies...'
                sh 'npm ci'
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
                    pm2 list
                """
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful!'
        }
        failure {
            echo '❌ Deployment failed!'
        }
    }
}