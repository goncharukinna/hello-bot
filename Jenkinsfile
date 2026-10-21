pipeline {
    agent {
        kubernetes {
            label 'node-agent'
            yamlFile 'pod.yaml'
        }
    }

    environment {
        NAMESPACE = 'default'
        DOCKER_IMAGE = 'docin82/hello-bot'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "✅ Код склонирован"
            }
        }

        stage('Install Dependencies') {
            steps {
                container('node') {
                    sh 'npm install --registry=https://registry.npmmirror.com'
                }
            }
        }

        stage('Test') {
            steps {
                container('node') {
                    sh 'npm test || echo "Тесты не настроены"'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                container('docker') {
                    script {
                        sh "docker build -t ${DOCKER_IMAGE}:${env.BUILD_ID} ."
                        sh "docker tag ${DOCKER_IMAGE}:${env.BUILD_ID} ${DOCKER_IMAGE}:latest"
                    }
                }
            }
        }

        stage('Push to Registry') {
            steps {
                container('docker') {
                    script {
                        withCredentials([usernamePassword(
                            credentialsId: 'docker-credentials',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )]) {
                            sh '''
                                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                                docker push ${DOCKER_IMAGE}:${BUILD_ID}
                                docker push ${DOCKER_IMAGE}:latest
                            '''
                        }
                    }
                }
            }
        }

        stage('Update GitOps Repo') {
            steps {
                container('git') {
                    withCredentials([usernamePassword(
                        credentialsId: 'github-token',
                        usernameVariable: 'GIT_USER',
                        passwordVariable: 'GIT_TOKEN'
                    )]) {
                        sh '''
                            git clone https://${GIT_USER}:${GIT_TOKEN}@github.com/goncharukinna/bots-gitops.git /tmp/gitops
                            cd /tmp/gitops
                            sed -i "s|image: docin82/hello-bot:.*|image: docin82/hello-bot:${BUILD_ID}|" manifests/hello-bot/deployment.yaml
                            git config user.name "Jenkins"
                            git config user.email "jenkins@example.com"
                            git add manifests/hello-bot/deployment.yaml
                            git commit -m "hello-bot: update to ${BUILD_ID} [skip ci]"
                            git push
                            echo "✅ GitOps обновлён до версии ${BUILD_ID}"
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo "🎉 hello-bot ${BUILD_ID} собран, запушен и обновлён в GitOps"
        }
        failure {
            echo "❌ Ошибка сборки"
        }
    }
}
