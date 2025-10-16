properties([
    pipelineTriggers([
        githubPush()
    ])
])

pipeline {
    agent any

    triggers {
        githubPush() 
        pollSCM('H/5 * * * *') 
    }

    environment {
        NODE_ENV = 'production'
        APP_NAME = 'jira-bot'
        APP_ENTRY = 'index.js'
    }

    stages {

        stage('Clean Workspace') {
            steps {
                echo '🧹 Cleaning workspace...'
                cleanWs()  
            }
        }

        stage('Checkout') {
            steps {
                echo '📥 Cloning private repository...'
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [
                        [$class: 'CleanBeforeCheckout'], 
                        [$class: 'CloneOption', depth: 0, noTags: false, reference: '', shallow: false]
                    ],
                    userRemoteConfigs: [[
                        credentialsId: 'github-credentials',
                        url: 'https://github.com/richenhub/jirabot.git'
                    ]]
                ])
                
                sh 'git log -3 --oneline'
                sh 'git branch -a' 
            }
        }

         stage('Install dependencies') {
            steps {
                echo '📦 Installing dependencies...'
                sh 'node -v && npm -v'
                sh 'rm -rf node_modules package-lock.json' 
                sh 'npm install'
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
            sh 'git log -1 --pretty=format:"Deployed commit: %h - %s (%an)"'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}