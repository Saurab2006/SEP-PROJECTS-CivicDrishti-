const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  authority: { type: mongoose.Schema.Types.ObjectId, ref: 'Authority', required: true },
  report:    { type: mongoose.Schema.Types.ObjectId, ref: 'IncidentReport', default: null },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, trim: true, default: '' },
}, { timestamps: true });

reviewSchema.index({ authority: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);