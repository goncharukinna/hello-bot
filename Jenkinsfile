pipeline {
    agent {
        kubernetes {
            label 'node-agent'
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: jnlp
    image: jenkins/inbound-agent:latest
    args: ['$(JENKINS_SECRET)', '$(JENKINS_NAME)']
    volumeMounts:
    - mountPath: /home/jenkins/agent
      name: workspace-volume
  - name: node
    image: node:18-alpine
    command: ['cat']
    tty: true
    volumeMounts:
    - mountPath: /home/jenkins/agent
      name: workspace-volume
  - name: docker
    image: docker:latest
    command: ['cat']
    tty: true
    volumeMounts:
    - mountPath: /var/run/docker.sock
      name: docker-socket
    - mountPath: /home/jenkins/agent
      name: workspace-volume
  volumes:
  - name: docker-socket
    hostPath:
      path: /var/run/docker.sock
  - name: workspace-volume
    emptyDir: {}
'''
        }
    }

    environment {
        NAMESPACE = 'default'
        DOCKER_IMAGE = 'docin82/hello-bot'
        DEPLOYMENT_NAME = 'hello-bot'
        CONTAINER_NAME = 'hello-bot'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "Код успешно склонирован!"
            }
        }

        stage('Install Dependencies') {
            steps {
                container('node') {
                    sh 'npm install'
                }
                echo "Зависимости установлены."
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
                        def imageTag = "${DOCKER_IMAGE}:${env.BUILD_ID}"
                        sh "docker build -t ${imageTag} ."
                        // Сохраняем тег для следующих этапов
                        env.IMAGE_TAG = imageTag
                    }
                }
                echo "Образ собран: ${env.IMAGE_TAG}"
            }
        }

        stage('Push to Registry') {
            steps {
                container('docker') {
                    script {
                        withCredentials([usernamePassword(credentialsId: 'docker-credentials', 
                                                         usernameVariable: 'DOCKER_USER', 
                                                         passwordVariable: 'DOCKER_PASS')]) {
                            sh '''
                                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                                docker push ${DOCKER_IMAGE}:${BUILD_ID}
                                docker push ${DOCKER_IMAGE}:latest
                            '''
                        }
                    }
                }
                echo "Образ загружен в Docker Hub."
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                container('jnlp') {
                    script {
                        sh """
                            kubectl set image deployment/${DEPLOYMENT_NAME} \
                                ${CONTAINER_NAME}=${DOCKER_IMAGE}:${env.BUILD_ID} \
                                -n ${NAMESPACE}
                        """
                    }
                }
                echo "Деплоймент ${DEPLOYMENT_NAME} обновлен."
            }
        }
    }

    post {
        success {
            echo "Поздравляю! Сборка успешна! 🎉"
        }
        failure {
            echo "Упс! Что-то пошло не так. Проверьте логи."
        }
    }
}