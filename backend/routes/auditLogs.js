const express = require('express');
const AuditLog = require('../models/AuditLog');
const { protect, requireRole } = require('../middleware/auth');
const { ACTION_LABELS } = require('../utils/auditLog');

const router = express.Router();

// Every route here is admin-only and read-only by design: the audit trail
// must stay trustworthy even to the admins it records, so there is no
// PATCH/DELETE here at all (the model also blocks mutation at the DB layer).
router.get('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const q = req.query || {};
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 25));
    const filter = {};

    if (q.actorRole && q.actorRole !== 'all') filter.actorRole = q.actorRole;
    if (q.action && q.action !== 'all') filter.action = q.action;
    if (q.result && q.result !== 'all') filter.result = q.result.toUpperCase();
    if (q.province && q.province !== 'all') filter.province = q.province;
    if (q.municipality && q.municipality !== 'all') filter.municipality = q.municipality;
    if (q.ward && q.ward !== 'all') filter.ward = q.ward;
    if (q.actor) filter.actor = q.actor;
    if (q.from || q.to) {
      filter.createdAt = {};
      if (q.from) filter.createdAt.$gte = new Date(q.from);
      if (q.to) filter.createdAt.$lte = new Date(`${q.to}T23:59:59.999Z`);
    }
    if (q.q) {
      filter.$or = [
        { actorName: { $regex: q.q, $options: 'i' } },
        { targetLabel: { $regex: q.q, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'name email role')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      logs: logs.map(l => ({ ...l, actionLabel: ACTION_LABELS[l.action] || l.action })),
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Small summary block for the top of the audit log page (Total Actions,
// Approvals, Rejections, etc. — mirrors what issue #8 asked for).
router.get('/summary', protect, requireRole('admin'), async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, last30, byAction] = await Promise.all([
      AuditLog.countDocuments({}),
      AuditLog.countDocuments({ createdAt: { $gte: since } }),
      AuditLog.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }]),
    ]);
    const counts = byAction.reduce((acc, row) => { acc[row._id] = row.count; return acc; }, {});
    const approvals = (counts.APPROVE_OFFICIAL || 0) + (counts.APPROVE_VERIFICATION || 0) + (counts.APPROVE_CHANGE || 0);
    const rejections = (counts.REJECT_VERIFICATION || 0) + (counts.REJECT_CHANGE || 0);
    res.json({ total, last30, approvals, rejections, budgetChanges: (counts.EDIT_BUDGET || 0) + (counts.APPROVE_CHANGE || 0) + (counts.REJECT_CHANGE || 0), imports: counts.IMPORT_BUDGET || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;