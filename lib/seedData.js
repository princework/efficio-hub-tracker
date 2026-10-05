// public/seed-data.js is the browser's seed file; it exports itself for Node
// too, so the page and the database are seeded from one copy. Requiring it
// (rather than reading it) also keeps it in the serverless bundle.
function loadSeed() {
  return require('../public/seed-data.js');
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
        // the seed restarts its task ids inside each milestone (m1/t1, m2/t1…),
        // so the stored id is namespaced to stay unique in one collection
        _id: m.id + ':' + t.id,
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
