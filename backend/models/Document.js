const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:         { type: String, required: true },
  fileName:      { type: String, required: true },
  fileSize:      { type: Number, default: 0 },
  docType:       { type: String, enum: ['budget', 'annual-report', 'development-plan', 'audit', 'procurement'], default: 'budget' },
  fiscalYear:    { type: String, default: '2081/82' },
  district:      { type: String },
  municipality:  { type: String },
  organization:  { type: String },
  status:        { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'completed' },
  pageCount:     { type: Number, default: 8 },
  totalBudget:   { type: Number, default: 0 },
  summary:       { type: String },
  highlights:    [String],
  keywords:      [String],
}, { timestamps: true });

documentSchema.index({ user: 1, createdAt: -1 });
documentSchema.index({ user: 1, fiscalYear: 1 });
documentSchema.index({ user: 1, docType: 1, status: 1 });

module.exports = mongoose.model('Document', documentSchema);
