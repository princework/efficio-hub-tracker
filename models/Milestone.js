const mongoose = require('mongoose');

// _id is the milestone id the frontend already uses ('m1', 'm2', …)
const milestoneSchema = new mongoose.Schema({
  _id:           { type: String },
  name:          { type: String, required: true },
  order:         { type: Number, default: 0 },
  objective:     { type: String, default: '' },
  allocatedDays: { type: Number, default: 0 },
  createdAt:     { type: Number, default: () => Date.now() },
}, { versionKey: false });

milestoneSchema.index({ order: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);
