const crypto = require('crypto');

// Developers unlock editing with ADMIN_KEY (sent as the x-admin-key header).
// Everyone else — the client link — is read-only apart from posting feedback.
function isAdmin(req) {
  const expected = process.env.ADMIN_KEY || '';
  const given    = req.get('x-admin-key') || '';
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(403).json({ success: false, message: 'View-only access: editing requires the developer link' });
}

module.exports = { isAdmin, requireAdmin };
