const mongoose = require('mongoose');

// A single document (_id: 'project') holding the tracker's own details.
const projectSchema = new mongoose.Schema({
  _id:         { type: String, default: 'project' },
  name:        { type: String, default: 'Efficio Hub' },
  tagline:     { type: String, default: '' },
  description: { type: String, default: '' },
  overview:    { type: String, default: '' },
  finalOutcome:{ type: String, default: '' },
  totalDays:   { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Project', projectSchema);
