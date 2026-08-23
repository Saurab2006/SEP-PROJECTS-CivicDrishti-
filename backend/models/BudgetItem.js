const mongoose = require('mongoose');

const budgetItemSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wardUnit:   { type: mongoose.Schema.Types.ObjectId, ref: 'WardUnit', default: null },
  document:   { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  title:      { type: String, required: true },
  department: { type: String, required: true },
  sector:     { type: String, required: true },
  expenditureType: { type: String, enum: ['Recurrent Expenditure', 'Capital Expenditure', 'Other'], default: 'Capital Expenditure' },
  programType: { type: String, enum: ['Infrastructure', 'Maintenance', 'Service Program', 'Social Program', 'Grant Program', 'Other'], default: 'Infrastructure' },
  fundingSources: [{ source: { type: String, trim: true }, amount: { type: Number, default: 0 } }],
  amount:     { type: Number, required: true, default: 0 },
  spent:      { type: Number, default: 0 },
  originalApprovedBudget: { type: Number, default: 0 },
  revisedBudget: { type: Number, default: 0 },
  releasedAmount: { type: Number, default: 0 },
  disbursedAmount: { type: Number, default: 0 },
  contractedAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
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
  isDemo: { type: Boolean, default: false },
  demoLabel: { type: String, default: '' },
  evidenceDocuments: [{ title: { type: String, trim: true }, url: { type: String, trim: true }, uploadedAt: { type: Date, default: Date.now } }],
  responsibleAuthority: { type: String, default: '', trim: true },
  timelineStart: { type: Date, default: null },
  timelineEnd: { type: Date, default: null },
  progressPhotos: [{ title: { type: String, trim: true }, url: { type: String, trim: true }, uploadedAt: { type: Date, default: Date.now } }],
  revisionHistory: [{
    previous: { type: mongoose.Schema.Types.Mixed, default: {} },
    next: { type: mongoose.Schema.Types.Mixed, default: {} },
    reason: { type: String, trim: true, default: '' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['approved', 'rejected'], required: true },
    supportingDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
    reviewedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

budgetItemSchema.index({ user: 1, fiscalYear: 1, sector: 1 });
budgetItemSchema.index({ user: 1, amount: -1 });
budgetItemSchema.index({ province: 1, district: 1, municipality: 1, ward: 1 });
budgetItemSchema.index({ wardUnit: 1, fiscalYear: 1 });
budgetItemSchema.index({ title: 'text', department: 'text', district: 'text', municipality: 'text', ward: 'text' });

module.exports = mongoose.model('BudgetItem', budgetItemSchema);






