require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { connectAndSeed, describeDbError } = require('./lib/db');
const { isAdmin } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Every API call connects (and seeds on the very first one) before routing.
app.use('/api', async (req, res, next) => {
  try {
    await connectAndSeed();
    next();
  } catch (err) {
    const { host, causes } = describeDbError(err);
    console.error('[MongoDB] Connection failed:', err.message, host, causes);
    res.status(503).json({ success: false, message: 'Database unavailable: ' + err.message, host, causes });
  }
});

app.use('/api/state',      require('./routes/state'));
app.use('/api/tasks',      require('./routes/tasks'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/api/feedback',   require('./routes/feedback'));
app.use('/api/project',    require('./routes/project'));

// Tells the frontend whether this browser holds the developer key
app.get('/api/auth', (req, res) => {
  res.json({ success: true, data: { admin: isAdmin(req), configured: !!process.env.ADMIN_KEY } });
});

// Serve the frontend for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
module.exports.connectAndSeed = connectAndSeed;
module.exports.describeDbError = describeDbError;
