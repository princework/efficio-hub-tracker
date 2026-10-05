const express   = require('express');
const router    = express.Router();
const Milestone = require('../models/Milestone');
const Task      = require('../models/Task');
const Feedback  = require('../models/Feedback');
const { requireAdmin } = require('../middleware/auth');
const { newId }        = require('./tasks');

// POST a new milestone — developers only
router.post('/', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Milestone name is required' });
    const last = await Milestone.findOne().sort({ order: -1 }).lean();
    const milestone = await Milestone.create({
      _id: req.body.id || newId('m'),
      name,
      shortName: req.body.shortName || '',
      order: req.body.order != null ? Number(req.body.order) : (last?.order || 0) + 10,
      objective: req.body.objective || '',
      allocatedDays: Number(req.body.allocatedDays) || 0,
    });
    res.status(201).json({ success: true, data: milestone });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH a milestone — developers only
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const update = {};
    ['name', 'shortName', 'order', 'objective', 'allocatedDays'].forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const milestone = await Milestone.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).lean();
    if (!milestone) return res.status(404).json({ success: false, message: 'Milestone not found' });
    res.json({ success: true, data: milestone });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE a milestone and every task in it — developers only, permanent
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const milestone = await Milestone.findByIdAndDelete(req.params.id).lean();
    if (!milestone) return res.status(404).json({ success: false, message: 'Milestone not found' });
    const tasks = await Task.deleteMany({ milestoneId: req.params.id });
    const fb = await Feedback.deleteMany({ milestoneId: req.params.id });
    res.json({ success: true, data: { milestone, tasksDeleted: tasks.deletedCount, feedbackDeleted: fb.deletedCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
