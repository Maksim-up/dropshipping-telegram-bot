require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const token = process.env.TELEGRAM_TOKEN;
const adminChatId = process.env.CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

const userStates = {};
const orderTimeouts = {};

const steps = [
  'Введите ваше имя:',
  'Введите ваш телефон (например, +998901234567):',
  'Введите товар:',
  'Введите размер:',
  'Введите город:',
  'Введите адрес:',
];

const paymentDetails = `
💳 Реквизиты для оплаты:
- Номер карты: 4294 3400 0365 4321
- Получатель: Vyugin Maksim
- Важно! В комментарии к переводу укажите ID заказа
`;

function generateOrderId() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function isValidPhone(phone) {
  // Пример простой проверки телефона: должен начинаться с + и содержать 12-15 цифр
  return /^\+\d{12,15}$/.test(phone);
}

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Проверка таймаута на повторный заказ
  if (orderTimeouts[chatId]) {
    const diff = Date.now() - orderTimeouts[chatId];
    if (diff < 5 * 60 * 1000) {
      bot.sendMessage(chatId, `Пожалуйста, подождите ${Math.ceil((5 * 60 * 1000 - diff) / 1000)} секунд перед новым заказом.`);
      return;
    } else {
      delete orderTimeouts[chatId];
    }
  }

  if (!userStates[chatId]) {
    userStates[chatId] = { step: 0, data: {} };
    bot.sendMessage(chatId, steps[0]);
    return;
  }

  const user = userStates[chatId];

  switch (user.step) {
    case 0:
      user.data.name = text;
      break;
    case 1:
      if (!isValidPhone(text)) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректный номер телефона в формате +998901234567');
        return; // не увеличиваем шаг, чтобы пользователь ввёл правильно
      }
      user.data.phone = text;
      break;
    case 2:
      user.data.product = text;
      break;
    case 3:
      user.data.size = text;
      break;
    case 4:
      user.data.city = text;
      break;
    case 5:
      user.data.address = text;
      break;
  }

  user.step++;

  if (user.step < steps.length) {
    bot.sendMessage(chatId, steps[user.step]);
  } else {
    const order = user.data;
    const orderId = generateOrderId();

    const adminMessage =
      `📦 Новый заказ #${orderId}:\n` +
      `👤 Имя: ${order.name}\n` +
      `📞 Телефон: ${order.phone}\n` +
      `👟 Товар: ${order.product}\n` +
      `📏 Размер: ${order.size}\n` +
      `📍 Город: ${order.city}\n` +
      `🏠 Адрес: ${order.address}`;

    bot.sendMessage(adminChatId, adminMessage);

    bot.sendMessage(
      chatId,
      `Спасибо за заказ! Ваш номер заказа: #${orderId}\n` +
        paymentDetails +
        '\nПосле оплаты пришлите, пожалуйста, подтверждение.'
    );

    delete userStates[chatId];
    orderTimeouts[chatId] = Date.now(); // ставим таймаут на 5 минут
  }
});
