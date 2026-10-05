// Moves per-task clientFeedback text into feedback documents and drops the field.
require('dotenv').config();
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'efficio_hub',
    serverSelectionTimeoutMS: 15000,
  });
  const tasks = mongoose.connection.db.collection('tasks');
  const withText = await tasks.find({ clientFeedback: { $nin: ['', null] } }).toArray();
  for (const t of withText) {
    await Feedback.create({
      _id: 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      milestoneId: t.milestoneId, taskId: t._id,
      author: 'Client', message: t.clientFeedback, createdAt: Date.now(),
    });
    console.log(`moved feedback from ${t._id}`);
  }
  const res = await tasks.updateMany({ clientFeedback: { $exists: true } }, { $unset: { clientFeedback: '' } });
  console.log(`carried over ${withText.length} note(s); cleared the field on ${res.modifiedCount} tasks`);

  // older feedback documents had only text/author
  const fb = mongoose.connection.db.collection('feedback');
  const legacy = await fb.countDocuments({ message: { $exists: false } });
  console.log(`legacy feedback documents without a message: ${legacy}`);
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
