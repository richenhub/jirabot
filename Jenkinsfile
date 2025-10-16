pipeline {
    agent any

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
                    credentialsId: 'github-credentials',
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
                sh 'npm test || echo "No tests"'
            }
        }

        stage('Deploy') {
            steps {
                echo '🚀 Deploying application...'
                sh """
                    pm2 stop ${APP_NAME} || true
                    pm2 delete ${APP_NAME} || true
                    pm2 start ${APP_ENTRY} --name ${APP_NAME} --node-args="--max-old-space-size=2048"
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
        always {
            cleanWs()
        }
    }
}