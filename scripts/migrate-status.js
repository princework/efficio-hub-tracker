// Brings stored statuses onto the current set: Pending, In Progress, Completed, On Hold.
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'efficio_hub',
    serverSelectionTimeoutMS: 15000,
  });
  const tasks = mongoose.connection.db.collection('tasks');   // raw, to bypass the new enum
  const renames = { 'Not Started': 'Pending', 'Done': 'Completed' };
  for (const [from, to] of Object.entries(renames)) {
    const res = await tasks.updateMany({ status: from }, { $set: { status: to } });
    if (res.modifiedCount) console.log(`renamed ${res.modifiedCount} × '${from}' → '${to}'`);
  }
  for (const s of ['Pending', 'In Progress', 'Completed', 'On Hold', 'Not Started', 'Done']) {
    console.log(`${s.padEnd(12)} ${await tasks.countDocuments({ status: s })}`);
  }
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
