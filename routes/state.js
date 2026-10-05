const express   = require('express');
const router    = express.Router();
const Project   = require('../models/Project');
const Milestone = require('../models/Milestone');
const Task      = require('../models/Task');
const Feedback  = require('../models/Feedback');

// One call returns the whole tracker in the shape the frontend already holds
// in memory, so the page can render from a single request.
router.get('/', async (req, res) => {
  try {
    const [project, milestones, tasks, feedback] = await Promise.all([
      Project.findById('project').lean(),
      Milestone.find().sort({ order: 1 }).lean(),
      Task.find().sort({ taskId: 1 }).lean(),
      Feedback.find().sort({ createdAt: -1 }).lean(),
    ]);

    const milestoneMap = {};
    const tasksByMilestone = {};
    milestones.forEach(m => {
      const { _id, ...rest } = m;
      milestoneMap[_id] = rest;
      tasksByMilestone[_id] = {};
    });

    tasks.forEach(t => {
      const { _id, milestoneId, ...rest } = t;
      if (!tasksByMilestone[milestoneId]) tasksByMilestone[milestoneId] = {};
      tasksByMilestone[milestoneId][_id] = rest;
    });

    const feedbackMap = {};
    feedback.forEach(f => {
      const { _id, ...rest } = f;
      feedbackMap[_id] = rest;
    });

    res.json({
      success: true,
      data: {
        project: project ? (({ _id, ...rest }) => rest)(project) : { name: 'Efficio Hub', description: '' },
        milestones: milestoneMap,
        tasksByMilestone,
        feedback: feedbackMap,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
