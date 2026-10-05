const mongoose = require('mongoose');

// _id is the task's document id ('t_xxx'); taskId is the running serial number.
const taskSchema = new mongoose.Schema({
  _id:            { type: String },
  milestoneId:    { type: String, required: true, ref: 'Milestone' },
  taskId:         { type: Number, default: 0 },
  text:           { type: String, required: true },
  status:         { type: String, enum: ['Pending', 'In Progress', 'Completed', 'On Hold'], default: 'Pending' },
  priority:       { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  owner:          { type: String, default: '' },
  startDate:      { type: String, default: '' },
  dueDate:        { type: String, default: '' },
  createdAt:      { type: Number, default: () => Date.now() },
}, { versionKey: false });

taskSchema.index({ milestoneId: 1 });
taskSchema.index({ taskId: 1 });
taskSchema.index({ status: 1 });

module.exports = mongoose.model('Task', taskSchema);
