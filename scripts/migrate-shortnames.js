// Fills in milestone short names for a database seeded before they existed.
require('dotenv').config();
const mongoose  = require('mongoose');
const Milestone = require('../models/Milestone');
const { seedDocuments } = require('../lib/seedData');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'efficio_hub',
    serverSelectionTimeoutMS: 15000,
  });
  let filled = 0;
  for (const m of seedDocuments().milestones) {
    if (!m.shortName) continue;
    const res = await Milestone.updateOne(
      { _id: m._id, $or: [{ shortName: { $exists: false } }, { shortName: '' }] },
      { $set: { shortName: m.shortName } }
    );
    if (res.modifiedCount) { filled++; console.log(`${m._id} → ${m.shortName}`); }
  }
  console.log(filled ? `Filled ${filled} short names` : 'Nothing to fill');
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
