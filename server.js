const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const path = require("path");
const cron = require("node-cron");
const User = require("./models/User");
const Draft = require("./models/Draft");
const Broadcast = require("./models/Draft");

const fs = require("fs");
const connectDB = require("./db/connect");
const { BOT_TOKEN } = process.env;

require("dotenv").config();

const app = express();
const bot = new Telegraf(BOT_TOKEN);

connectDB();

const admins = ["denys_kladko", "aram21m"];

function showMainMenu(ctx) {
  const buttons = [
    ["Магазин", "О продуктах"],
    ["Личный кабинет", "Специальные предложения"],
    ["Поддержка", "Наши ресурсы"],
  ];
  if (ctx.isAdmin) {
    buttons.push(["Рассылка"]);
  }
  ctx.reply(
    "Добро пожаловать! Выберите опцию:",
    Markup.keyboard(buttons).resize()
  );
}

async function selectRecipients(ctx) {
  const users = await User.find();
  const buttons = users.map((user) => [
    {
      text: user.username || `ID: ${user.chatId}`,
      callback_data: `sendTo_${user.chatId}`,
    },
  ]);

  buttons.push([{ text: "Главное меню", callback_data: "backToMenu" }]);

  const message = await ctx.reply("...", {
    reply_markup: { remove_keyboard: true },
  });

  setTimeout(() => {
    ctx.deleteMessage(message.message_id);
  }, 0);

  await ctx.reply("Выберите получателей:", {
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
}

bot.use((ctx, next) => {
  if (admins.includes(ctx.from.username)) {
    ctx.isAdmin = true;
  } else {
    ctx.isAdmin = false;
  }
  return next();
});

bot.start(showMainMenu);

bot.hears("Рассылка", async (ctx) => {
  if (!ctx.isAdmin) return;

  await Draft.deleteMany({ adminId: ctx.from.id });

  await Draft.create({ adminId: ctx.from.id, text: "", media: [] });

  const message = await ctx.reply("...", {
    reply_markup: { remove_keyboard: true },
  });

  setTimeout(() => {
    ctx.deleteMessage(message.message_id);
  }, 0);

  await ctx.reply("Добавьте файлы фото/видео и текст", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Обратно", callback_data: "backToMenu" }],
      ],
    },
  });
});

async function prepareToSend(ctx) {
  const draft = await Draft.findOne({ adminId: ctx.from.id });
  if (!draft) {
    await ctx.reply("Черновик не найден. Начните с команды /broadcast.");
    return;
  }

  await Broadcast.create({
    text: draft.text,
    media: draft.media,
    sendToAll: false,
    recipients: [],
  });

  await Draft.deleteMany({ adminId: ctx.from.id });

  ctx.reply("Рассылка сохранена. Отправить всем или выбрать получателей?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Всем", callback_data: "send_to_all" }],
        [{ text: "Выбрать получателей", callback_data: "select_recipients" }],
      ],
    },
  });
}

async function sendMediaGroup(ctx, userId, broadcast) {
  if (broadcast.media.length > 0) {
    const mediaGroup = broadcast.media.map((item, index) => {
      const inputMedia = {
        type: item.type,
        media: item.fileId,
      };
      if (index === broadcast.media.length - 1 && broadcast.text) {
        inputMedia.caption = broadcast.text;
        inputMedia.parse_mode = "HTML";
      }
      return inputMedia;
    });
    await ctx.telegram.sendMediaGroup(userId, mediaGroup);
  } else {
    await ctx.telegram.sendMessage(userId, broadcast.text);
  }
}

bot.on("message", async (ctx) => {
  if (!ctx.isAdmin) return;

  const draft = await Draft.findOne({ adminId: ctx.from.id });
  if (!draft) return;

  if (ctx.message.text) {
    draft.text = ctx.message.text;
    await draft.save();
  }

  if (ctx.message.photo) {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    draft.media.push({ type: "photo", fileId });
    if (ctx.message.caption) {
      draft.text = ctx.message.caption;
    }
    await draft.save();
  } else if (ctx.message.video) {
    draft.media.push({ type: "video", fileId: ctx.message.video.file_id });
    if (ctx.message.caption) {
      draft.text = ctx.message.caption;
    }
    await draft.save();
  } else if (ctx.message.document) {
    if (ctx.message.caption) {
      draft.text = ctx.message.caption;
    }
    draft.media.push({
      type: "document",
      fileId: ctx.message.document.file_id,
    });
    await draft.save();
  }

  ctx.reply(`Добавьте файлы либо нажмите на кнопку "Отправить"`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Отправить", callback_data: "prepareToSend" }],
      ],
    },
  });
});

bot.on("callback_query", async (ctx) => {
  const broadcast = await Broadcast.findOne().sort({ _id: -1 });
  if (!broadcast) return;

  const data = ctx.callbackQuery.data;

  if (data === "prepareToSend") {
    return prepareToSend(ctx);
  }

  if (data.startsWith("sendTo_")) {
    const userId = data.split("_")[1];
    await ctx.answerCbQuery("Отправляем сообщение...");

    try {
      await sendMediaGroup(ctx, userId, broadcast);
    } catch (err) {
      console.error(`Ошибка при отправке пользователю ${userId}:`, err.message);
    }
    await ctx.reply("Сообщение отправлено!");

    selectRecipients(ctx);
  }

  if (data === "backToMenu") {
    showMainMenu(ctx);
  }

  if (data === "send_to_all") {
    const users = await User.find();
    users.forEach(async (user) => {
      try {
        await sendMediaGroup(ctx, user.chatId, broadcast);
      } catch (err) {
        console.error(
          `Ошибка при отправке пользователю ${user.chatId}:`,
          err.message
        );
      }
    });
    await ctx.answerCbQuery("Рассылка отправлена всем.");
    await showMainMenu(ctx);
  } else if (data === "select_recipients") {
    selectRecipients(ctx);
  }
});

bot.hears("Магазин", (ctx) => {
  ctx.reply(
    "Выберите продукт:",
    Markup.keyboard([["Обучение", "Аналитика"]]).resize()
  );
});

bot.hears("Специальные предложения", (ctx) => {
  ctx
    .reply("На данный момент доступных предложений для новых участников нет.")
    .resize();
});

bot.hears("Обучение", (ctx) => {
  ctx.reply(
    "Выберите тариф на Обучение:",
    Markup.keyboard([
      ["Продвинутый - 880$", "Премиум - 1250$", "Назад"],
    ]).resize()
  );
});

bot.hears("Назад", showMainMenu);

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

cron.schedule("* * * * *", async () => {
  const now = new Date();

  const users = await User.find({
    paymentRequestedAt: { $ne: null },
    paymentCompleted: false,
  });

  users.forEach(async (user) => {
    const minutesSinceRequest = (now - user.paymentRequestedAt) / 60000;

    if (minutesSinceRequest >= 5 && !user.notified5min) {
      bot.telegram.sendMessage(
        user.chatId,
        `Вы ещё не оплатили ${user.product} (${user.tariff}). Напоминаем, что адрес для оплаты: afsadasfaafdg34423`
      );
      await User.findByIdAndUpdate(user._id, { notified5min: true });
    }

    if (minutesSinceRequest >= 30 && !user.notified30min) {
      bot.telegram.sendMessage(
        user.chatId,
        `Прошло уже 30 минут, а вы так и не оплатили ${user.product} (${user.tariff}). Если нужна помощь, обратитесь в поддержку.`
      );
      await User.findByIdAndUpdate(user._id, { notified30min: true });
    }
  });
});

app.listen(process.env.PORT || 5000, () =>
  console.log("Сервер запущен на порту 5000")
);
