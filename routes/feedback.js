const express   = require('express');
const router    = express.Router();
const Feedback  = require('../models/Feedback');
const Milestone = require('../models/Milestone');
const Task      = require('../models/Task');
const { requireAdmin } = require('../middleware/auth');
const { newId }        = require('./tasks');

// POST feedback — open to the client link, which is the point of this page
router.post('/', async (req, res) => {
  try {
    const milestoneId = String(req.body.milestoneId || '');
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const milestone = await Milestone.findById(milestoneId).lean();
    if (!milestone) return res.status(400).json({ success: false, message: 'Unknown milestone' });

    // a task reference only counts when it really sits in that milestone
    let taskId = req.body.taskId ? String(req.body.taskId) : null;
    if (taskId) {
      const task = await Task.findOne({ _id: taskId, milestoneId }).lean();
      if (!task) return res.status(400).json({ success: false, message: 'Unknown task for that milestone' });
    }

    const item = await Feedback.create({
      _id: newId('f'), milestoneId, taskId, message, createdAt: Date.now(),
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH status / reply — developers only
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const update = {};
    if (req.body.status !== undefined) update.status = req.body.status;
    const item = await Feedback.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Feedback not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE — developers only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const item = await Feedback.findByIdAndDelete(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Feedback not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
