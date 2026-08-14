const mongoose = require('mongoose');

const municipalitySchema = new mongoose.Schema({
  province: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['municipality', 'rural_municipality', 'metropolitan', 'sub_metropolitan'], default: 'municipality' },
  wards: [{ type: String, trim: true }],
  head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  officeAddress: { type: String, default: '', trim: true },
  officePhone: { type: String, default: '', trim: true },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

municipalitySchema.index({ province: 1, district: 1, name: 1 }, { unique: true });
municipalitySchema.index({ head: 1 });

module.exports = mongoose.model('Municipality', municipalitySchema);
