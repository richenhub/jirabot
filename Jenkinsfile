pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://richenhub: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@github.com/richenhub/jirabot.git'
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Build / Validate') {
            steps {
                // Здесь можно добавить линтер, тесты и т.д.
                echo 'Dependencies installed. Skipping build phase (Node bot).'
            }
        }

        stage('Restart bot') {
            steps {
                // Останавливаем и перезапускаем через pm2
                sh '''
                    if ! command -v pm2 >/dev/null; then
                      npm install -g pm2
                    fi
                    pm2 delete jira-bot || true
                    pm2 start index.js --name jira-bot
                '''
            }
        }
    }

    post {
        failure {
            echo '❌ Build failed!'
        }
        success {
            echo '✅ Bot updated and restarted successfully.'
        }
    }
}
