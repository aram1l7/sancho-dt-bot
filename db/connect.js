require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB подключен!');
  } catch (err) {
    console.error('Ошибка подключения к MongoDB:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
