const express = require('express');
const router  = express.Router();
const Project = require('../models/Project');
const { requireAdmin } = require('../middleware/auth');

// PATCH the project name / description — developers only
router.patch('/', requireAdmin, async (req, res) => {
  try {
    const update = {};
    ['name', 'tagline', 'description', 'overview', 'finalOutcome', 'totalDays'].forEach(k => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });
    const project = await Project.findByIdAndUpdate('project', { $set: update }, { new: true, upsert: true, runValidators: true }).lean();
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
