const express  = require('express');
const router   = express.Router();
const Feedback = require('../models/Feedback');
const { requireAdmin } = require('../middleware/auth');
const { newId }        = require('./tasks');

// POST feedback — open to the client link, which is the point of this page
router.post('/', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Message is required' });
    const item = await Feedback.create({
      _id: newId('f'),
      text,
      author: String(req.body.author || '').trim(),
      createdAt: Date.now(),
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE feedback — developers only
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
