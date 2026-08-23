const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wardUnit:   { type: mongoose.Schema.Types.ObjectId, ref: 'WardUnit', default: null },
  document:   { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  name:       { type: String, required: true },
  sector:     { type: String, required: true },
  status:     { type: String, enum: ['planned', 'ongoing', 'completed', 'delayed'], default: 'planned' },
   budget:        { type: Number, default: 0 },
  revisedBudget: { type: Number, default: null },
  spent:         { type: Number, default: 0 },
  completionOverride: { type: Number, min: 0, max: 100, default: null },
  province:   { type: String },
  district:   { type: String },
  municipality: { type: String },
  ward:       { type: String },
  fiscalYear: { type: String },
}, { timestamps: true });

projectSchema.index({ user: 1, sector: 1, status: 1 });
projectSchema.index({ user: 1, fiscalYear: 1 });
projectSchema.index({ province: 1, district: 1, municipality: 1, ward: 1 });
projectSchema.index({ wardUnit: 1, fiscalYear: 1 });

module.exports = mongoose.model('Project', projectSchema);




