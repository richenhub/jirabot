pipeline {
    agent any

    stages {
        //stage('Checkout') {
            //steps {
                // git branch: 'main', url: 'https://github.com/richenhub/jirabot.git'
                stage('Checkout') {
                    git url: 'git@github.com:richenhub/jirabot.git', credentialsId: 'github-ssh'
                }
            // }
        // }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Deploy') {
            steps {
                sshagent (credentials: ['vps-ssh-key']) {
                    sh '''
                    cd /opt/jbot
                    git pull origin main
                    npm ci
                    pm2 restart jira-bot
                    '''
                }
            }
        }
    }
}
