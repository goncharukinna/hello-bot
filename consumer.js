// consumer.js
const { getChannel } = require('./rabbitmq');

async function startConsumer(queue, handler) {
  const channel = getChannel();
  
  await channel.assertQueue(queue, { durable: true });
  
  // prefetch: обрабатывать по одному сообщению за раз
  // (полезно, если обработка долгая — не забирать всё сразу)
  channel.prefetch(1);
  
  console.log(`👂 [← ${queue}] Ожидание сообщений...`);
  
  channel.consume(queue, async (msg) => {
    if (msg === null) return;
    
    try {
      const data = JSON.parse(msg.content.toString());
      console.log(`📥 [← ${queue}]`, data);
      
      await handler(data);
      channel.ack(msg);  // ✅ Подтверждаем успешную обработку
    } catch (err) {
      console.error(`❌ Ошибка обработки из ${queue}:`, err.message);
      // nack с requeue=true вернёт сообщение в очередь для повтора
      channel.nack(msg, false, true);
    }
  });
}

module.exports = { startConsumer };
