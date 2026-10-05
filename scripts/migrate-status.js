// Renames the stored status 'Not Started' to 'Pending'.
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'efficio_hub',
    serverSelectionTimeoutMS: 15000,
  });
  const tasks = mongoose.connection.db.collection('tasks');   // raw, to bypass the new enum
  const before = await tasks.countDocuments({ status: 'Not Started' });
  const res = await tasks.updateMany({ status: 'Not Started' }, { $set: { status: 'Pending' } });
  console.log(`'Not Started' documents: ${before} → renamed ${res.modifiedCount}`);
  for (const s of ['Pending', 'In Progress', 'Done', 'Not Started']) {
    console.log(`${s.padEnd(12)} ${await tasks.countDocuments({ status: s })}`);
  }
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
