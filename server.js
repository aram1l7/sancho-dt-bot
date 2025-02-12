const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const path = require("path");
const cron = require("node-cron");
const User = require('./models/User');

const fs = require("fs");
const connectDB = require("./db/connect");
const { BOT_TOKEN } = process.env;
require("dotenv").config();

const app = express();
const bot = new Telegraf(BOT_TOKEN);

connectDB();

bot.start((ctx) => {
  ctx.reply('Добро пожаловать! Выберите опцию:', Markup.keyboard([
    ['Магазин', 'О продуктах'],
    ['Личный кабинет', 'Специальные предложения'],
    ['Поддержка', 'Наши ресурсы']
  ]).resize());
});

bot.hears('Магазин', (ctx) => {
  ctx.reply('Выберите продукт:', Markup.keyboard([
    ['Обучение', 'Аналитика'],
   
  ]).resize());
});

bot.hears('Специальные предложения', (ctx) => {
  ctx.reply('На данный момент доступных предложений для новых участников нет.').resize()
})

bot.hears("Обучение", (ctx) => {
  ctx.reply(
    "Выберите тариф на Обучение:",
    Markup.keyboard([
      ["Продвинутый - 880$", "Премиум - 1250$"],
    ]).resize()
  );
});

bot.hears("Аналитика", (ctx) => {
  ctx.reply(
    "Выберите тариф на Аналитику:",
    Markup.keyboard([
      ["1 месяц - 20$", "6 месяцев - 108$", "12 месяцев - 192$"],
      ["Назад"],
    ]).resize()
  );
});

bot.hears("Продвинутый - 880$", async (ctx) => {
  const chatId = ctx.chat.id;
  await User.findOneAndUpdate(
    { chatId },
    {
      product: "Обучение",
      tariff: "Продвинутый",
      price: 880,
      paymentRequestedAt: new Date(),
      paymentCompleted: false,
      notified5min: false,
      notified30min: false,
    },
    { upsert: true }
  );
  ctx.reply(
    `Вы выбрали Обучение (Продвинутый) за 880$. Оплатите по адресу: <code>afsadasfaafdg34423</code>`,
    {
      parse_mode: "HTML",
    }
  );
});

bot.hears("Премиум - 1250$", async (ctx) => {
  const chatId = ctx.chat.id;
  await User.findOneAndUpdate(
    { chatId },
    {
      product: "Обучение",
      tariff: "Премиум",
      price: 1250,
      paymentRequestedAt: new Date(),
      paymentCompleted: false,
      notified5min: false,
      notified30min: false,
    },
    { upsert: true }
  );
  ctx.reply(
    `Вы выбрали Обучение (Премиум) за 1250$. Оплатите по адресу: <code>afsadasfaafdg34423</code>`,
    {
      parse_mode: "HTML",
    }
  );
});

bot.hears("1 месяц - 20$", async (ctx) => {
  const chatId = ctx.chat.id;
  await User.findOneAndUpdate(
    { chatId },
    {
      product: "Аналитика",
      tariff: "1 месяц",
      price: 20,
      paymentRequestedAt: new Date(),
      paymentCompleted: false,
      notified5min: false,
      notified30min: false,
    },
    { upsert: true }
  );
  ctx.reply(
    `Вы выбрали Аналитику (1 месяц) за 20$. Оплатите по адресу: <code>afsadasfaafdg34423</code>`,
    {
      parse_mode: "HTML",
    }
  );
});

bot.hears("6 месяцев - 108$", async (ctx) => {
  const chatId = ctx.chat.id;
  await User.findOneAndUpdate(
    { chatId },
    {
      product: "Аналитика",
      tariff: "6 месяцев",
      price: 108,
      paymentRequestedAt: new Date(),
      paymentCompleted: false,
      notified5min: false,
      notified30min: false,
    },
    { upsert: true }
  );
  ctx.reply(
    `Вы выбрали Аналитику (6 месяцев) за 108$. Оплатите по адресу: <code>afsadasfaafdg34423</code>`,
    {
      parse_mode: "HTML",
    }
  );
});

bot.hears("12 месяцев - 192$", async (ctx) => {
  const chatId = ctx.chat.id;
  await User.findOneAndUpdate(
    { chatId },
    {
      product: "Аналитика",
      tariff: "12 месяцев",
      price: 192,
      paymentRequestedAt: new Date(),
      paymentCompleted: false,
      notified5min: false,
      notified30min: false,
    },
    { upsert: true }
  );
  ctx.reply(
    `Вы выбрали Аналитику (12 месяцев) за 192$. Оплатите по адресу: <code>afsadasfaafdg34423</code>`,
    {
      parse_mode: "HTML",
    }
  );
});

bot.launch();

console.log("Бот запущен");

cron.schedule('* * * * *', async () => {
  const now = new Date();

  const users = await User.find({
    paymentRequestedAt: { $ne: null },
    paymentCompleted: false
  });

  users.forEach(async (user) => {
    const minutesSinceRequest = (now - user.paymentRequestedAt) / 60000;

    if (minutesSinceRequest >= 5 && !user.notified5min) {
      bot.telegram.sendMessage(user.chatId, `Вы ещё не оплатили ${user.product} (${user.tariff}). Напоминаем, что адрес для оплаты: afsadasfaafdg34423`);
      await User.findByIdAndUpdate(user._id, { notified5min: true });
    }

    if (minutesSinceRequest >= 30 && !user.notified30min) {
      bot.telegram.sendMessage(user.chatId, `Прошло уже 30 минут, а вы так и не оплатили ${user.product} (${user.tariff}). Если нужна помощь, обратитесь в поддержку.`);
      await User.findByIdAndUpdate(user._id, { notified30min: true });
    }
  });
});


app.listen(process.env.PORT || 5000, () => console.log("Сервер запущен на порту 5000"));
