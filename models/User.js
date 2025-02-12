const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  chatId: {
    type: Number,
    required: true,
    unique: true
  },
  product: String,
  tariff: String,
  price: Number,
  paymentRequestedAt: Date,
  paymentCompleted: {
    type: Boolean,
    default: false
  },
  notified5min: {
    type: Boolean,
    default: false
  },
  notified30min: {
    type: Boolean,
    default: false
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
