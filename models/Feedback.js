const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  _id:       { type: String },
  text:      { type: String, required: true },
  author:    { type: String, default: '' },
  createdAt: { type: Number, default: () => Date.now() },
}, { versionKey: false });

feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
