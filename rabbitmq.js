// rabbitmq.js
const amqp = require('amqplib');

const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD;
const RABBITMQ_PORT = process.env.RABBITMQ_PORT || 5672;

let connection = null;
let channel = null;

async function connect() {
  // Проверяем, что все переменные заданы
  if (!RABBITMQ_HOST || !RABBITMQ_USER || !RABBITMQ_PASSWORD) {
    throw new Error(
      `Не заданы переменные RabbitMQ: HOST=${RABBITMQ_HOST || 'undefined'}, USER=${RABBITMQ_USER || 'undefined'}, PASSWORD=${RABBITMQ_PASSWORD ? '***' : 'undefined'}`
    );
  }

  const url = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;
  console.log(`🔌 Подключение к RabbitMQ: ${RABBITMQ_HOST}:${RABBITMQ_PORT}...`);

  connection = await amqp.connect(url);
  channel = await connection.createChannel();

  connection.on('error', (err) => {
    console.error('RabbitMQ connection error:', err.message);
  });

  connection.on('close', () => {
    console.warn('RabbitMQ connection closed');
    channel = null;
    connection = null;
  });

  console.log('✅ Подключено к RabbitMQ');
  return channel;
}

function getChannel() {
  if (!channel) throw new Error('RabbitMQ channel не инициализирован');
  return channel;
}

function isConnected() {
  return channel !== null && connection !== null;
}

module.exports = { connect, getChannel, isConnected };
