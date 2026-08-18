const mongoose = require('mongoose');

// One document per browser/device a citizen has opted in on. A citizen
// with two devices (phone + laptop) simply has two subscriptions, both
// notified. Deleted when the citizen turns notifications off, or
// automatically pruned by sendPushToUser() when the browser reports the
// subscription has expired (410 Gone / 404).
const pushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  userAgent: { type: String, default: '', trim: true },
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);