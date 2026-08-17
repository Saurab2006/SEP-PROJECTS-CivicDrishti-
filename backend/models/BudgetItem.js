const mongoose = require('mongoose');

const budgetItemSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  document:   { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  title:      { type: String, required: true },
  department: { type: String, required: true },
  sector:     { type: String, required: true },
  amount:     { type: Number, required: true, default: 0 },
  revisedAmount: { type: Number, default: null },
  spent:      { type: Number, default: 0 },
  status:     { type: String, enum: ['planned', 'ongoing', 'completed', 'delayed'], default: 'planned' },
  completionOverride: { type: Number, min: 0, max: 100, default: null },
  fiscalYear: { type: String, required: true },
  province:   { type: String },
  district:   { type: String },
  municipality: { type: String },
  ward:       { type: String },
  page:       { type: Number, default: 1 },
  confidence: { type: Number, default: 0.9 },
  flagged: { type: Boolean, default: false },
  flagReason: { type: String, trim: true, default: '' },
  flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  flaggedAt: { type: Date, default: null },
}, { timestamps: true });

budgetItemSchema.index({ user: 1, fiscalYear: 1, sector: 1 });
budgetItemSchema.index({ user: 1, amount: -1 });
budgetItemSchema.index({ province: 1, district: 1, municipality: 1, ward: 1 });
budgetItemSchema.index({ title: 'text', department: 'text', district: 'text', municipality: 'text', ward: 'text' });

module.exports = mongoose.model('BudgetItem', budgetItemSchema);