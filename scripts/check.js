// Prints what is actually stored in Atlas: npm run check
require('dotenv').config();
const mongoose = require('mongoose');
const Milestone = require('../models/Milestone');
const Task      = require('../models/Task');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || 'efficio_hub' });
  const milestones = await Milestone.find().sort({ order: 1 }).lean();
  for (const m of milestones) {
    const total = await Task.countDocuments({ milestoneId: m._id });
    const done  = await Task.countDocuments({ milestoneId: m._id, status: 'Done' });
    console.log(`${m._id.padEnd(4)} ${String(total).padStart(3)} tasks  ${done} done  ${m.name}`);
  }
  console.log('Total tasks:', await Task.countDocuments());
  const sample = await Task.findOne().sort({ taskId: 1 }).lean();
  console.log('First task :', JSON.stringify(sample, null, 2).slice(0, 400));
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
