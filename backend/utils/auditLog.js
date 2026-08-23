const AuditLog = require('../models/AuditLog');

// Human-readable label for each action enum value, used by the audit log
// table on the frontend so admins don't have to decode ALL_CAPS constants.
const ACTION_LABELS = {
  APPROVE_OFFICIAL: 'Approved ward representative',
  REJECT_VERIFICATION: 'Rejected identity verification',
  APPROVE_VERIFICATION: 'Approved identity verification',
  CHANGE_ROLE: 'Changed user role',
  SUSPEND_USER: 'Suspended user',
  REACTIVATE_USER: 'Reactivated user',
  DELETE_USER: 'Deleted user',
  EDIT_BUDGET: 'Edited budget record',
  APPROVE_CHANGE: 'Approved budget change',
  REJECT_CHANGE: 'Rejected budget change',
  IMPORT_BUDGET: 'Imported budget CSV',
  CHANGE_REPORT_STATUS: 'Changed report status',
  ASSIGN_AUTHORITY: 'Assigned authority to report',
  MARK_FAKE: 'Flagged report as fake',
  CREATE_AUTHORITY: 'Added authority',
  CREATE_NOTICE: 'Published notice',
  UPDATE_WARD: 'Updated ward office',
  UPDATE_RECORD: 'Updated record',
  DELETE_RECORD: 'Deleted record',
};

// Writes one audit entry. Never throws into the caller's request handler —
// a logging failure should not block or roll back the admin action itself,
// so failures are swallowed and just printed to the server console.
async function logAudit(req, { action, targetType, targetId, targetLabel = '', previousValue = null, newValue = null, result = 'SUCCESS', province = '', district = '', municipality = '', ward = '' }) {
  try {
    const actor = req.user;
    if (!actor || !['admin', 'ward_rep', 'municipality_head'].includes(actor.role)) return;
    await AuditLog.create({
      actor: actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      targetType,
      targetId,
      targetLabel,
      previousValue,
      newValue,
      result,
      province, district, municipality, ward,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
    });
  } catch (err) {
    console.warn('Audit log write failed:', err.message);
  }
}

module.exports = { logAudit, ACTION_LABELS };