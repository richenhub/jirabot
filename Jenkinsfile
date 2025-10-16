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
                
                sh 'git log -1 --oneline'
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
                    # Остановить и удалить старый процесс
                    pm2 stop ${APP_NAME} || true
                    pm2 delete ${APP_NAME} || true
                    
                    # Запустить через npm start
                    pm2 start npm --name ${APP_NAME} -- start
                    
                    # Или если нужно указать директорию
                    # pm2 start npm --name ${APP_NAME} --cwd \$(pwd) -- start
                    
                    pm2 save
                    
                    echo "=== Deployment Complete ==="
                    echo "Running from: \$(pwd)"
                    pm2 list
                    pm2 logs ${APP_NAME} --lines 20 --nostream
                """
            }
        }
    }

    post {
        success {
            echo '✅ Deployment successful!'
            sh 'git log -1 --pretty=format:"✅ Deployed: %h - %s"'
        }
        failure {
            echo '❌ Deployment failed!'
        }
    }
}