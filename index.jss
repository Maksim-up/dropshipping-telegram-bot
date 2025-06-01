require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const crypto = require('crypto');

const token = process.env.TELEGRAM_TOKEN;
const adminChatId = process.env.CHAT_ID;
const port = process.env.PORT || 4000;

const bot = new TelegramBot(token);
bot.setWebHook(`https://${process.env.HOST}/bot${token}`);

const app = express();
app.use(express.json());

// Чтобы Telegram присылал обновления сюда
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const userStates = {};

const steps = [
  'Введите ваше имя:',
  'Введите ваш телефон:',
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

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

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
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
