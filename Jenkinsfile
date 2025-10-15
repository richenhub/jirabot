pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git url: 'git@github.com:richenhub/jirabot.git', branch: 'main', credentialsId: 'github-ssh'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Deploy') {
            steps {
                sshagent(['vps-ssh']) {
                    sh '''
                        # Создаем папку, если ее нет, и очищаем
                        mkdir -p /opt/jbot
                        rm -rf /opt/jbot/*

                        # Копируем с Jenkins на VPS
                        rsync -avz --exclude '.git' . vps_user@185.105.89.250:/opt/jbot/

                        # На VPS: ставим зависимости и перезапускаем
                        ssh vps_user@185.105.89.250 '
                            cd /opt/jbot
                            npm ci
                            pm2 restart jira-bot
                        '
                    '''
                }
            }
        }
    }
}
