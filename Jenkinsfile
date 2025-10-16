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
                
                withCredentials([usernamePassword(
                    credentialsId: '6a0b07eb-12fb-48a5-9352-3e9eb58fa0d7',
                    usernameVariable: 'richenhub',
                    passwordVariable: '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'
                )]) {
                    sh """
                        cd /opt/jbot
                        
                        # Сбросить любые локальные изменения
                        git reset --hard
                        git clean -fd
                        
                        # Обновить remote URL с credentials
                        git remote set-url origin https://${GIT_USERNAME}:${GIT_TOKEN}@github.com/richenhub/jirabot.git
                        
                        # Получить последние изменения
                        git fetch origin main
                        
                        # Переключиться на main и обновить
                        git checkout main
                        git reset --hard origin/main
                        
                        echo "✅ Updated to latest commit:"
                        git log -1 --oneline
                    """
                }
            }
        }

        stage('Install dependencies') {
            steps {
                echo '📦 Installing dependencies...'
                sh 'cd /opt/jbot && npm ci --production'
            }
        }

        stage('Deploy') {
            steps {
                echo '🚀 Deploying application...'
                sh """
                    # Остановить и удалить старый процесс
                    pm2 stop ${APP_NAME} || true
                    pm2 delete ${APP_NAME} || true
                    
                    # Запустить из /opt/jbot
                    cd /opt/jbot
                    pm2 start npm --name ${APP_NAME} --cwd /opt/jbot -- start
                    pm2 save
                    
                    echo "=== Deployment Complete ==="
                    echo "Running from: /opt/jbot"
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