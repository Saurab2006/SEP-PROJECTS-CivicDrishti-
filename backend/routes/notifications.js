const express = require('express');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const { protect } = require('../middleware/auth');
const { getPublicKey, isPushConfigured } = require('../utils/push');

const router = express.Router();

// The browser's Push API needs this key to create a subscription - handing
// it out only to logged-in users keeps it out of anonymous/robot traffic,
// though VAPID public keys are not secret by design.
router.get('/push/public-key', protect, (req, res) => {
  res.json({ publicKey: getPublicKey(), configured: isPushConfigured() });
});

router.get('/push/status', protect, async (req, res) => {
  try {
    const count = await PushSubscription.countDocuments({ user: req.user._id });
    res.json({ subscribed: count > 0, configured: isPushConfigured() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Opt-in: called after the browser grants Notification permission and
// creates a PushSubscription via the service worker. Upserts on endpoint so
// re-subscribing on the same device (e.g. after clearing permission) never
// creates a duplicate row.
router.post('/push/subscribe', protect, async (req, res) => {
  try {
    const { endpoint, keys, userAgent } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(422).json({ error: 'Invalid push subscription' });
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.user._id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, userAgent: userAgent || '' },
      { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Opt-out: removes this device's subscription (or every device for this
// citizen, if no endpoint is given).
router.delete('/push/subscribe', protect, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    else await PushSubscription.deleteMany({ user: req.user._id });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', protect, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const [items, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ notifications: items, unreadCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: n });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/', protect, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;