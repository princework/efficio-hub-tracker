// One-off seeding / verification: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const { connectAndSeed } = require('../lib/db');
const Project   = require('../models/Project');
const Milestone = require('../models/Milestone');
const Task      = require('../models/Task');
const Feedback  = require('../models/Feedback');

(async () => {
  await connectAndSeed();
  const [project, milestones, tasks, feedback] = await Promise.all([
    Project.findById('project').lean(),
    Milestone.countDocuments(),
    Task.countDocuments(),
    Feedback.countDocuments(),
  ]);
  console.log('Database :', mongoose.connection.name);
  console.log('Project  :', project ? project.name : '(none)');
  console.log('Milestones:', milestones);
  console.log('Tasks    :', tasks);
  console.log('Feedback :', feedback);
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
