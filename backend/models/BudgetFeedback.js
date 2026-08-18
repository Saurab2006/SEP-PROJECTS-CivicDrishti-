const mongoose = require('mongoose');

const budgetFeedbackSchema = new mongoose.Schema({
  budgetItem: { type: mongoose.Schema.Types.ObjectId, ref: 'BudgetItem', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  verdict: { type: String, enum: ['yes', 'partially', 'no'], required: true },
  comment: { type: String, trim: true, maxlength: 1000, default: '' },
  photo: { type: String, default: '' },
  photoName: { type: String, trim: true, default: '' },
  moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

budgetFeedbackSchema.index({ budgetItem: 1, user: 1 }, { unique: true });
budgetFeedbackSchema.index({ budgetItem: 1, moderationStatus: 1 });

module.exports = mongoose.model('BudgetFeedback', budgetFeedbackSchema);
