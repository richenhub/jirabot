pipeline {
    agent any

    environment {
        DEPLOY_USER = 'vps_user'
        DEPLOY_HOST = 'your.server.com'
        APP_PATH = '/opt/jbot'
        RELEASES_PATH = "${APP_PATH}/releases"
        CURRENT_PATH = "${APP_PATH}/current"
        SSH_CREDENTIALS = 'vps_user'
    }

    stages {
        stage('Checkout SCM') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Deploy') {
            steps {
                sshagent([SSH_CREDENTIALS]) {
                    script {
                        def releaseDir = "${RELEASES_PATH}/${env.BUILD_ID}"

                        sh """
                            ssh ${DEPLOY_USER}@${DEPLOY_HOST} '
                                mkdir -p ${releaseDir} &&
                                mkdir -p ${RELEASES_PATH}
                            '
                        """

                        // Копируем файлы в новую папку
                        sh """
                            rsync -av --exclude='.git' ./ ${DEPLOY_USER}@${DEPLOY_HOST}:${releaseDir}/
                        """

                        // Обновляем символическую ссылку
                        sh """
                            ssh ${DEPLOY_USER}@${DEPLOY_HOST} '
                                ln -sfn ${releaseDir} ${CURRENT_PATH}
                            '
                        """
                    }
                }
            }
        }
    }
}
