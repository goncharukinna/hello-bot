// index.js
require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const fs = require('fs');

const { connect } = require('./rabbitmq');
const { sendToQueue } = require('./producer');
const { startConsumer } = require('./consumer');

// ---------- Языковые ресурсы ----------
const strings = {
  ru: {
    welcome: (name) => `Привет, ${name}! 👋\n\nЯ проведу небольшой опрос. Отвечай на вопросы, и в конце я покажу результат.`,
    askName: '📝 Как тебя зовут?',
    askAge: 'Сколько тебе лет?',
    askGender: 'Укажи свой пол:',
    askCity: 'Из какого ты города?',
    askHobby: 'Расскажи о своём хобби (одним предложением)',
    askColor: 'Какой твой любимый цвет?',
    thanks: (data) => {
      return `✅ **Спасибо за участие в опросе!**\n\n`
        + `👤 Имя: ${data.name}\n`
        + `📅 Возраст: ${data.age}\n`
        + `🚻 Пол: ${data.gender}\n`
        + `🏙 Город: ${data.city}\n`
        + `🎨 Любимый цвет: ${data.color}\n`
        + `💡 Хобби: ${data.hobby}`;
    },
    unknown: 'Извини, я не понял. Пожалуйста, ответь на вопрос.',
    cancel: '❌ Опрос отменён.',
  },
  en: {
    welcome: (name) => `Hello, ${name}! 👋\n\nI'll conduct a short survey. Answer the questions, and I'll show you the result at the end.`,
    askName: '📝 What is your name?',
    askAge: 'How old are you?',
    askGender: 'What is your gender?',
    askCity: 'What city are you from?',
    askHobby: 'Tell me about your hobby (in one sentence)',
    askColor: 'What is your favorite color?',
    thanks: (data) => {
      return `✅ **Thanks for participating!**\n\n`
        + `👤 Name: ${data.name}\n`
        + `📅 Age: ${data.age}\n`
        + `🚻 Gender: ${data.gender}\n`
        + `🏙 City: ${data.city}\n`
        + `🎨 Favorite color: ${data.color}\n`
        + `💡 Hobby: ${data.hobby}`;
    },
    unknown: 'Sorry, I didn\'t understand. Please answer the question.',
    cancel: '❌ Survey cancelled.',
  },
};

function getLang(ctx) {
  const langCode = ctx.from?.language_code || 'ru';
  return strings[langCode] || strings.ru;
}

// ---------- Сцена для опроса ----------
const surveyScene = new Scenes.BaseScene('survey');

surveyScene.enter(async (ctx) => {
  const lang = getLang(ctx);
  const name = ctx.from.first_name || 'друг';
  await ctx.reply(lang.welcome(name));
  await ctx.reply(lang.askName);
  ctx.scene.state.step = 'name';
});

surveyScene.on('text', async (ctx) => {
  const lang = getLang(ctx);
  const state = ctx.scene.state;

  // Обработка команды /cancel
  if (ctx.message.text === '/cancel') {
    await ctx.reply(lang.cancel);
    return ctx.scene.leave();
  }

  // Определяем текущий шаг и сохраняем ответ
  switch (state.step) {
    case 'name':
      state.name = ctx.message.text;
      state.step = 'age';
      await ctx.reply(lang.askAge);
      break;

    case 'age':
      const age = parseInt(ctx.message.text);
      if (isNaN(age) || age < 1 || age > 120) {
        await ctx.reply('❌ Пожалуйста, введи корректный возраст (число от 1 до 120).');
        return;
      }
      state.age = age;
      state.step = 'gender';
      await ctx.reply(
        lang.askGender,
        Markup.keyboard([
          ['Мужской', 'Женский'],
          ['Другой', 'Не хочу отвечать']
        ]).oneTime().resize()
      );
      break;

    case 'gender':
      state.gender = ctx.message.text;
      state.step = 'city';
      await ctx.reply(lang.askCity);
      break;

    case 'city':
      state.city = ctx.message.text;
      state.step = 'color';
      await ctx.reply(
        lang.askColor,
        Markup.keyboard([
          ['🔴 Красный', '🔵 Синий', '🟢 Зелёный'],
          ['🟡 Жёлтый', '⚫️ Чёрный', '⚪️ Белый'],
          ['🟣 Фиолетовый', '🟠 Оранжевый', 'Другой']
        ]).oneTime().resize()
      );
      break;

    case 'color':
      state.color = ctx.message.text;
      state.step = 'hobby';
      await ctx.reply(lang.askHobby);
      break;

    case 'hobby':
      state.hobby = ctx.message.text;
      // Опрос завершён
      const data = {
        name: state.name,
        age: state.age,
        gender: state.gender,
        city: state.city,
        color: state.color,
        hobby: state.hobby,
        userId: ctx.from.id,
        username: ctx.from.username || '—',
        date: new Date().toISOString(),
      };

      // Сохраняем результат в файл (JSONL)
      try {
        fs.appendFileSync('survey_results.json', JSON.stringify(data) + '\n');
      } catch (err) {
        console.error('Ошибка сохранения анкеты:', err);
      }

      // Отправляем итоговое сообщение
      await ctx.reply(
        lang.thanks(data),
        { parse_mode: 'Markdown' }
      );
      await ctx.reply(
        'Спасибо! 😊\nТы можешь пройти опрос ещё раз — просто напиши /start',
        Markup.removeKeyboard()
      );
      await ctx.scene.leave();
      break;

    default:
      await ctx.reply(lang.unknown);
  }
});

// Обработка всех сообщений в сцене (если пользователь ввёл что-то не то)
surveyScene.use(async (ctx) => {
  if (ctx.message && ctx.message.text && ctx.message.text !== '/cancel') {
    // Если текст не был обработан в switch, но мы уже обрабатываем всё в on('text')
    // Этот блок на случай, если пользователь отправил что-то не текстовое
    await ctx.reply('Пожалуйста, отвечай текстом или нажимай кнопки.');
  }
});

// ---------- Инициализация бота ----------
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session());

const stage = new Scenes.Stage([surveyScene]);
bot.use(stage.middleware());

// ---------- Команда /start (отправка события + запуск опроса) ----------
bot.start(async (ctx) => {
  const firstName = ctx.from.first_name || 'друг';

  // Отправляем событие в RabbitMQ (если очередь доступна)
  try {
    await sendToQueue('user_events', {
      event: 'start',
      userId: ctx.from.id,
      name: firstName,
      username: ctx.from.username || '—',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('⚠️ RabbitMQ недоступен, продолжаем без него:', err.message);
    // Не прерываем работу бота, если RabbitMQ упал
  }

  // Запускаем сцену опроса (приветствие + первый вопрос)
  await ctx.scene.enter('survey');
});

// ---------- Команда /help ----------
bot.help(async (ctx) => {
  await ctx.reply(
    '🤖 **Помощь**\n\n' +
      'Я бот для проведения опросов.\n' +
      '• /start — начать опрос\n' +
      '• /cancel — отменить опрос\n' +
      '• /help — показать это сообщение\n\n' +
      'Просто отвечай на вопросы, и в конце я покажу результат.'
  );
});

// ---------- Запуск бота + RabbitMQ ----------
(async () => {
  try {
    // 1. Запускаем бота
    await bot.launch();
    console.log('✅ Бот для опросов запущен!');

    // 2. Подключаемся к RabbitMQ (после запуска бота)
    try {
      await connect();
      console.log('✅ RabbitMQ подключён');

      // 3. Слушаем очередь уведомлений
      startConsumer('notifications', async (data) => {
        console.log('📥 Получено уведомление:', data);
        if (data.userId && data.text) {
          try {
            await bot.telegram.sendMessage(data.userId, data.text);
          } catch (err) {
            console.error('Не удалось отправить уведомление:', err.message);
          }
        }
      });
    } catch (err) {
      console.error('⚠️ RabbitMQ не подключён, бот работает без него:', err.message);
      // Бот продолжит работать даже без RabbitMQ
    }
  } catch (err) {
    console.error('❌ Ошибка запуска бота:', err);
    process.exit(1);
  }
})();

// ---------- Graceful shutdown ----------
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));