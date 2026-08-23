const mongoose = require('mongoose');

const wardUnitSchema = new mongoose.Schema({
  province: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true },
  municipality: { type: String, default: '', trim: true },
  ward: { type: String, required: true, trim: true },
  representative: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

wardUnitSchema.index({ province: 1, district: 1, municipality: 1, ward: 1 }, { unique: true });
module.exports = mongoose.model('WardUnit', wardUnitSchema);
