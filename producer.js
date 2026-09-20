// producer.js
const { getChannel } = require('./rabbitmq');

// Универсальная функция отправки в очередь
async function sendToQueue(queue, message) {
  const channel = getChannel();
  
  // durable: true — очередь сохранится после перезапуска RabbitMQ
  await channel.assertQueue(queue, { durable: true });
  
  // persistent: true — сообщение сохранится на диск
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
  
  console.log(`📤 [→ ${queue}]`, message);
}

// Универсальная функция публикации через exchange (для fanout/topic)
async function publish(exchange, routingKey, message) {
  const channel = getChannel();
  
  await channel.assertExchange(exchange, 'topic', { durable: true });
  channel.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );
  
  console.log(`📤 [→ ${exchange}/${routingKey}]`, message);
}

module.exports = { sendToQueue, publish };
