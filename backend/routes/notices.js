const express = require('express');
const Notice = require('../models/Notice');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, requireRole } = require('../middleware/auth');
const { sendEmailQuietly } = require('../utils/email');

const router = express.Router();

function visibleFilter(user) {
  return { active: true, audience: { $in: ['all', user.role] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
}

// Expiry is anchored to the calendar day, not a rolling N*24h timer from the
// exact creation time. A notice created any time "today" (even at 12:01am)
// still expires at the end of that same day for a 1-day notice, and at the
// end of the (N-1)th following day for an N-day notice.
function expiresAtEndOfDay(days) {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + (Math.max(1, Number(days) || 1) - 1));
  return d;
}


router.get('/public-active', async (req, res) => {
  try {
    const notice = await Notice.findOne({ active: true, audience: 'all', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).sort({ createdAt: -1 }).populate('createdBy', 'name');
    res.json({ notice });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/active', protect, async (req, res) => {
  try {
    const notice = await Notice.findOne(visibleFilter(req.user)).sort({ createdAt: -1 }).populate('createdBy', 'name');
    res.json({ notice });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 }).limit(50).populate('createdBy', 'name');
    res.json({ notices });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const priority = ['normal', 'important', 'urgent'].includes(req.body?.priority) ? req.body.priority : 'important';
    const audience = ['all', 'admin', 'analyst', 'researcher'].includes(req.body?.audience) ? req.body.audience : 'all';
    const expiresInDays = Number(req.body?.expiresInDays || 7);
    if (!title || !message) return res.status(422).json({ error: 'Title and message are required' });
    const notice = await Notice.create({ title, message, priority, audience, createdBy: req.user._id, expiresAt: expiresAtEndOfDay(expiresInDays) });
    const filter = audience === 'all' ? {} : { role: audience };
    const users = await User.find(filter).select('_id email name');
    if (users.length) {
      await Notification.insertMany(users.map(u => ({ user: u._id, type: 'important-notice', title, message, link: '/dashboard' })));
      users.forEach(u => sendEmailQuietly({ to: u.email, subject: `Important notice: ${title}`, text: `Namaste ${u.name},\n\n${message}\n\nOpen Civicदृष्टि to see the notice.` }));
    }
    res.status(201).json({ notice, emailed: users.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, { active: Boolean(req.body?.active) }, { new: true });
    if (!notice) return res.status(404).json({ error: 'Notice not found' });
    res.json({ notice });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;