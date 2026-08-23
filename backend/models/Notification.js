const mongoose = require('mongoose');
const { sendEmailQuietly } = require('../utils/email');

const notificationSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:    { type: String, required: true, enum: ['new-report', 'assigned', 'eta-updated', 'verified', 'completed', 'flagged-fake', 'duplicate', 'not-duplicate', 'comment', 'budget-flagged', 'important-notice', 'reopened', 'closed', 'rejected', 'transferred', 'escalated', 'linked-project', 'ward-issue', 'ward-community-issue', 'issue-supported', 'priority-escalated', 'municipality-escalation'] },
  title:   { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  link:    { type: String, default: '' },
  read:    { type: Boolean, default: false },
  report:  { type: mongoose.Schema.Types.ObjectId, ref: 'IncidentReport' },
  province: { type: String, default: '', trim: true },
  district: { type: String, default: '', trim: true },
  municipality: { type: String, default: '', trim: true },
  ward: { type: String, default: '', trim: true },
  priority: { type: String, default: '', trim: true },
  idempotencyKey: { type: String, trim: true, default: undefined },
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true, $gt: '' } } });
notificationSchema.pre('validate', function () { if (!this.idempotencyKey) this.idempotencyKey = undefined; });
async function emailForNotification(notification) {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(notification.user).select('email name').lean();
    if (!user?.email) return;
    const link = notification.link ? `\n\nOpen: ${notification.link}` : '';
    sendEmailQuietly({
      to: user.email,
      subject: `Civicदृष्टि: ${notification.title}`,
      text: `${notification.message}${link}`,
    });
  } catch (err) {
    console.warn('Email notification lookup skipped:', err.message);
  }
}
notificationSchema.post('save', function (doc) { emailForNotification(doc); });
notificationSchema.post('insertMany', function (docs) { (docs || []).forEach(emailForNotification); });

module.exports = mongoose.model('Notification', notificationSchema);