const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'important' },
  audience: { type: String, enum: ['all', 'admin', 'municipality_head', 'researcher'], default: 'all' },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

noticeSchema.index({ active: 1, audience: 1, createdAt: -1 });

module.exports = mongoose.model('Notice', noticeSchema);

