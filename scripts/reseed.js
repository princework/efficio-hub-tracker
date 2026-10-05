// Wipes the tracker collections and loads the seed again: npm run reseed
// Only ever run this against a database you are happy to replace.
require('dotenv').config();
const mongoose = require('mongoose');
const { seedOnce } = require('../lib/db');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'efficio_hub',
    serverSelectionTimeoutMS: 15000,
  });
  const db = mongoose.connection.db;
  console.log('[Reseed] Database:', mongoose.connection.name);
  for (const name of ['projects', 'milestones', 'tasks', 'feedback', 'meta']) {
    const n = await db.collection(name).countDocuments().catch(() => 0);
    await db.collection(name).deleteMany({});
    console.log(`[Reseed] Cleared ${name} (${n} documents)`);
  }
  await seedOnce();
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
