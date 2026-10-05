const fs   = require('fs');
const path = require('path');

// public/seed-data.js is a browser file (`var EFFICIO_SEED = {…}`), so it is
// read and evaluated here rather than required, keeping one copy of the seed.
function loadSeed() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'seed-data.js'), 'utf8');
  return new Function(src + '; return EFFICIO_SEED;')();
}

// Flattens the seed into the documents stored in MongoDB.
function seedDocuments() {
  const seed = loadSeed();
  const project = Object.assign({ _id: 'project' }, seed.project);

  const milestones = (seed.milestones || []).map(m => ({
    _id: m.id,
    name: m.name,
    order: m.order || 0,
    objective: m.objective || '',
    allocatedDays: m.allocatedDays || 0,
    createdAt: m.createdAt || Date.now(),
  }));

  const tasks = [];
  (seed.milestones || []).forEach(m => {
    (seed.tasks && seed.tasks[m.id] ? seed.tasks[m.id] : []).forEach(t => {
      tasks.push({
        _id: t.id,
        milestoneId: m.id,
        taskId: t.taskId || 0,
        text: t.text,
        status: t.status || 'Not Started',
        priority: t.priority || 'Medium',
        owner: t.owner || '',
        startDate: t.startDate || '',
        dueDate: t.dueDate || '',
        notes: t.notes || '',
        clientFeedback: t.clientFeedback || '',
        createdAt: t.createdAt || Date.now(),
      });
    });
  });

  return { project, milestones, tasks };
}

module.exports = { loadSeed, seedDocuments };
