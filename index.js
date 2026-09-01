// index.js
require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');

// ---------- Языковые ресурсы ----------
const strings = {
  ru: {
    welcome: (name) => `Привет, ${name}! 👋\nЯ — твой помощник. Выбери действие:`,
    menu: '📋 Вот наше меню... (пока пусто)',
    help: '❓ Я умею:\n- Отвечать на приветствия\n- Проводить короткий опрос\n- Показывать это меню',
    survey: '📝 Давай проведём небольшой опрос!',
    askName: 'Как тебя зовут?',
    askAge: 'Сколько тебе лет?',
    thanks: (name, age) => `Спасибо, ${name}! Тебе ${age} лет. Приятно познакомиться! 😊`,
    greeting: [
      'Привет! Как дела?',
      'Здравствуй! Чем могу быть полезен?',
      'И тебе привет! Давно не виделись.',
      'Привет-привет! Рассказывай, что нового?',
    ],
    unknown: 'Извини, я не понимаю. Воспользуйся кнопками или напиши /help.',
  },
  en: {
    welcome: (name) => `Hello, ${name}! 👋\nI'm your assistant. Choose an action:`,
    menu: '📋 Here is our menu... (empty for now)',
    help: '❓ I can:\n- Reply to greetings\n- Conduct a short survey\n- Show this menu',
    survey: '📝 Let\'s do a quick survey!',
    askName: 'What is your name?',
    askAge: 'How old are you?',
    thanks: (name, age) => `Thank you, ${name}! You are ${age} years old. Nice to meet you! 😊`,
    greeting: [
      'Hi! How are you?',
      'Hello! How can I help?',
      'Hey there! Long time no see.',
      'Hi hi! What\'s new?',
    ],
    unknown: 'Sorry, I don\'t understand. Use the buttons or type /help.',
  },
};

// Определяем язык пользователя (по умолчанию ru)
function getLang(ctx) {
  // Можно использовать код языка из Telegram или сохранять в сессии
  const langCode = ctx.from?.language_code || 'ru';
  return strings[langCode] || strings.ru;
}

// ---------- Сцена для опроса ----------
const surveyScene = new Scenes.BaseScene('survey');

surveyScene.enter(async (ctx) => {
  const lang = getLang(ctx);
  await ctx.reply(lang.survey);
  await ctx.reply(lang.askName);
  return ctx.scene.state.step = 'name';
});

surveyScene.on('text', async (ctx) => {
  const lang = getLang(ctx);
  const state = ctx.scene.state;

  if (!state.step) state.step = 'name';

  if (state.step === 'name') {
    state.name = ctx.message.text;
    state.step = 'age';
    await ctx.reply(lang.askAge);
  } else if (state.step === 'age') {
    state.age = ctx.message.text;
    // Завершаем сцену
    await ctx.reply(lang.thanks(state.name, state.age));
    await ctx.scene.leave();
  }
});

// Обработка отмены (если пользователь ввел что-то не то)
surveyScene.use(async (ctx) => {
  if (ctx.message && ctx.message.text) {
    // Игнорируем команды, но можно перехватить /cancel
    if (ctx.message.text === '/cancel') {
      await ctx.reply('Опрос отменён.');
      await ctx.scene.leave();
    } else {
      // Пропускаем через обычные обработчики (но мы уже обработали текст выше)
    }
  }
});

// ---------- Инициализация бота ----------
const bot = new Telegraf(process.env.BOT_TOKEN);

// Сессия (храним состояние пользователя)
bot.use(session());

// Регистрируем сцену
const stage = new Scenes.Stage([surveyScene]);
bot.use(stage.middleware());

// ---------- Обработчики команд ----------
bot.start(async (ctx) => {
  const lang = getLang(ctx);
  const firstName = ctx.from.first_name || 'друг';
  await ctx.reply(
    lang.welcome(firstName),
    Markup.inlineKeyboard([
      [Markup.button.callback('📋 Меню', 'menu')],
      [Markup.button.callback('📝 Опрос', 'survey')],
      [Markup.button.callback('❓ Помощь', 'help')],
    ])
  );
});

bot.help(async (ctx) => {
  const lang = getLang(ctx);
  await ctx.reply(lang.help);
});

// ---------- Обработка кнопок ----------
bot.action('menu', async (ctx) => {
  const lang = getLang(ctx);
  await ctx.answerCbQuery(); // убираем состояние "загрузки"
  await ctx.reply(lang.menu);
});

bot.action('survey', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('survey');
});

bot.action('help', async (ctx) => {
  const lang = getLang(ctx);
  await ctx.answerCbQuery();
  await ctx.reply(lang.help);
});

// ---------- Обработка текстовых приветствий ----------
const greetingWords = ['привет', 'hello', 'здравствуй', 'здравствуйте', 'ку', 'салют', 'хай', 'hi'];

bot.hears(greetingWords, async (ctx) => {
  const lang = getLang(ctx);
  const responses = lang.greeting;
  const randomIndex = Math.floor(Math.random() * responses.length);
  await ctx.reply(responses[randomIndex]);
});

// ---------- Обработка всего остального ----------
bot.on('text', async (ctx) => {
  const lang = getLang(ctx);
  // Если текст не обработан предыдущими hear-ами, выводим подсказку
  await ctx.reply(lang.unknown);
});

// ---------- Запуск ----------
bot.launch()
  .then(() => console.log('Бот запущен!'))
  .catch((err) => {
    console.error('Ошибка запуска бота:', err);
    process.exit(1);
  });

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));