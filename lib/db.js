const mongoose  = require('mongoose');
const Project   = require('../models/Project');
const Milestone = require('../models/Milestone');
const Task      = require('../models/Task');
const { seedDocuments } = require('./seedData');

// Cached so each serverless invocation reuses the same connection.
let connecting = null;

async function connectAndSeed() {
  if (mongoose.connection.readyState === 1) return;
  if (!connecting) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
    connecting = (async () => {
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB || 'efficio_hub',
        serverSelectionTimeoutMS: 15000,
      });
      console.log('[MongoDB] Connected to', mongoose.connection.name);
      await seedOnce();
    })().catch(err => { connecting = null; throw err; });
  }
  await connecting;
}

// Seeds exactly once. The marker stops deleted milestones or tasks from being
// re-created the next time the server starts.
async function seedOnce() {
  const meta   = mongoose.connection.db.collection('meta');
  const seeded = await meta.findOne({ _id: 'seed' });
  const count  = await Task.countDocuments();
  if (!seeded && count === 0) {
    const { project, milestones, tasks } = seedDocuments();
    await Project.updateOne({ _id: 'project' }, { $set: project }, { upsert: true });
    if (milestones.length) await Milestone.insertMany(milestones);
    if (tasks.length) await Task.insertMany(tasks);
    console.log(`[Seed] Inserted ${milestones.length} milestones and ${tasks.length} tasks`);
  } else {
    console.log(`[Seed] ${count} tasks already in the database — skipping seed`);
  }
  if (!seeded) await meta.updateOne({ _id: 'seed' }, { $set: { at: new Date() } }, { upsert: true });
}

// Mongoose's top-level message always blames the IP allow list; the per-server
// errors say what actually failed.
function describeDbError(err) {
  const causes = [...(err.reason?.servers?.values() || [])]
    .map(s => s.error && `${s.address}: ${s.error.message}`)
    .filter(Boolean);
  const host = (process.env.MONGODB_URI || '').match(/@([^/?]+)/)?.[1] || 'unknown host';
  return { host, causes };
}

module.exports = { connectAndSeed, seedOnce, describeDbError };
