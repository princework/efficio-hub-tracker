// The seed only ever loads the database now — the page itself reads MongoDB.
function loadSeed() {
  return require('../data/seed-data.js');
}

// Flattens the seed into the documents stored in MongoDB.
function seedDocuments() {
  const seed = loadSeed();
  const project = Object.assign({ _id: 'project' }, seed.project);

  const milestones = (seed.milestones || []).map(m => ({
    _id: m.id,
    name: m.name,
    shortName: m.shortName || '',
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
        status: t.status || 'Pending',
        priority: t.priority || 'Medium',
        owner: t.owner || '',
        startDate: t.startDate || '',
        dueDate: t.dueDate || '',
        clientFeedback: t.clientFeedback || '',
        createdAt: t.createdAt || Date.now(),
      });
    });
  });

  return { project, milestones, tasks };
}

module.exports = { loadSeed, seedDocuments };
