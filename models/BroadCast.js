const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  text: String,
  media: [
    {
      type: {
        type: String,
        required: true,
      },
      fileId: {
        type: String,
        required: true,
      },
    },
  ],
  sendToAll: Boolean,
  recipients: [Number],
});

const Broadcast = mongoose.model('Broadcast', broadcastSchema);

module.exports = Broadcast;
