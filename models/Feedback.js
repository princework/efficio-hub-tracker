const mongoose = require('mongoose');

// Client feedback on a milestone, optionally narrowed to one task inside it
const feedbackSchema = new mongoose.Schema({
  _id:         { type: String },
  milestoneId: { type: String, required: true, ref: 'Milestone' },
  taskId:      { type: String, default: null, ref: 'Task' },
  author:      { type: String, required: true, trim: true, maxlength: 80 },
  message:     { type: String, required: true, trim: true, maxlength: 2000 },
  status:      { type: String, enum: ['Open', 'Resolved'], default: 'Open' },
  // The team's response, which the client sees on the same card
  reply:       { type: String, default: '', trim: true, maxlength: 2000 },
  repliedAt:   { type: Number, default: null },
  createdAt:   { type: Number, default: () => Date.now() },
}, { versionKey: false });

feedbackSchema.index({ milestoneId: 1, createdAt: -1 });
feedbackSchema.index({ taskId: 1 });
feedbackSchema.index({ status: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
