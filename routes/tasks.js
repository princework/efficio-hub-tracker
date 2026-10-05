const express = require('express');
const router  = express.Router();
const Task    = require('../models/Task');
const Milestone = require('../models/Milestone');
const { requireAdmin } = require('../middleware/auth');

const EDITABLE = ['text', 'status', 'priority', 'owner', 'startDate', 'dueDate', 'clientFeedback', 'milestoneId'];

function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// POST a task into an existing milestone — developers only
router.post('/', requireAdmin, async (req, res) => {
  try {
    const milestoneId = String(req.body.milestoneId || '');
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Task text is required' });
    const milestone = await Milestone.findById(milestoneId).lean();
    if (!milestone) return res.status(400).json({ success: false, message: 'Unknown milestone' });

    const last = await Task.findOne().sort({ taskId: -1 }).lean();
    const task = await Task.create({
      _id: req.body.id || newId('t'),
      milestoneId,
      taskId: (last?.taskId || 0) + 1,
      text,
    });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH a task (partial, including moving it to another milestone) — developers only
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const update = {};
    EDITABLE.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (update.milestoneId) {
      const milestone = await Milestone.findById(update.milestoneId).lean();
      if (!milestone) return res.status(400).json({ success: false, message: 'Unknown milestone' });
    }
    const task = await Task.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).lean();
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE a task — developers only, permanent
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id).lean();
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.newId = newId;
