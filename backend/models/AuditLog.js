const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actorRole: {
    type: String,
    enum: ['admin', 'ward_rep', 'municipality_head'],
    required: true,
  },
  action: {
    type: String,
    enum: [
      'APPROVE_OFFICIAL',
      'REJECT_VERIFICATION',
      'EDIT_BUDGET',
      'APPROVE_CHANGE',
      'REJECT_CHANGE',
      'IMPORT_BUDGET',
      'CHANGE_REPORT_STATUS',
      'ASSIGN_AUTHORITY',
      'CREATE_AUTHORITY',
      'CREATE_NOTICE',
      'UPDATE_WARD',
      'MARK_FAKE',
      'UPDATE_RECORD',
      'DELETE_RECORD',
    ],
    required: true,
  },
  targetType: {
    type: String,
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  previousValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  result: {
    type: String,
    enum: ['SUCCESS', 'FAILURE'],
    default: 'SUCCESS',
  },
  province: String,
  district: String,
  municipality: String,
  ward: String,
  ipAddress: String,
}, { timestamps: true });

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ province: 1, municipality: 1, ward: 1 });

function blockMutation(next) {
  next(new Error('Audit records are immutable'));
}

auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);

module.exports = mongoose.model('AuditLog', auditLogSchema);
