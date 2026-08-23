const mongoose = require('mongoose');

const issueSupportSchema = new mongoose.Schema({
  issue: { type: mongoose.Schema.Types.ObjectId, ref: 'IncidentReport', required: true },
  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  province: { type: String, default: '', trim: true },
  district: { type: String, default: '', trim: true },
  municipality: { type: String, default: '', trim: true },
  ward: { type: String, default: '', trim: true },
}, { timestamps: true });

issueSupportSchema.index({ issue: 1, citizen: 1 }, { unique: true });
issueSupportSchema.index({ province: 1, district: 1, municipality: 1, ward: 1, createdAt: -1 });

module.exports = mongoose.model('IssueSupport', issueSupportSchema);
