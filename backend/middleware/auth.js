const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../utils/token');

const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'User not found or suspended' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

// Gates write actions (reporting an issue, commenting, supporting) behind
// identity verification. Viewing/browsing stays open to everyone signed in;
// this only applies to routes that create or change something tied to a
// person, so a citizen can't submit reports under an unverifiable identity.
const requireVerified = (req, res, next) => {
  // Only citizen/ward-rep accounts go through identity verification at all
  // (admins and municipality heads are provisioned directly, not self-signed-up).
  if (!['researcher', 'ward_rep'].includes(req.user.role)) return next();
  if (req.user.verificationStatus !== 'verified') {
    return res.status(403).json({ error: 'Please verify your identity in Settings before doing this', code: 'VERIFICATION_REQUIRED' });
  }
  next();
};

module.exports = { protect, requireRole, requireVerified };