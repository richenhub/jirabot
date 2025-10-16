pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
        REPO_URL = 'https://richenhub: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@github.com/richenhub/jirabot.git'
        APP_NAME = 'jira-bot'
        APP_ENTRY = 'index.js'
    }

    stages {

        stage('Checkout') {
            steps {
                echo '📥 Cloning repository...'
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[ url: "${env.REPO_URL}" ]],
                    extensions: [
                        [$class: 'WipeWorkspace'], 
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
                echo '
