const mongoose = require('mongoose');

const draftSchema = new mongoose.Schema({
  adminId: Number,
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
});

const Draft = mongoose.model('Draft', draftSchema);

module.exports = Draft;
