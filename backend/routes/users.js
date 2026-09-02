const express = require('express');
const User = require('../models/User');
const Document = require('../models/Document');
const WardUnit = require('../models/WardUnit');
const { protect, requireRole } = require('../middleware/auth');
const { accountDecisionEmail } = require('../utils/authEmails');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();

const HIDDEN_DEMO_EMAILS = ['researcher@govinsight.np', 'analyst@govinsight.np', 'admin@govinsight.np'];
const ROLE_VALUES = ['admin', 'researcher', 'ward_rep', 'municipality_head'];

router.get('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find({ email: { $nin: HIDDEN_DEMO_EMAILS } }).select('-password').sort({ createdAt: -1 });
    const enriched = await Promise.all(users.map(async u => {
      const docCount = await Document.countDocuments({ user: u._id });
      return { ...u.toAdminList(), documentCount: docCount };
    }));
    res.json({ users: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.patch('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const { role, status, verificationStatus, wardRepresentativeStatus } = req.body;
    const update = {};

    if (role && ROLE_VALUES.includes(role)) update.role = role;
    if (status && ['active', 'suspended'].includes(status)) update.status = status;
    if (verificationStatus && ['pending', 'verified', 'rejected'].includes(verificationStatus)) {
      update.verificationStatus = verificationStatus;
      if (verificationStatus === 'rejected') update.status = 'suspended';
    }

    const before = await User.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'User not found' });

    if (wardRepresentativeStatus && ['approved', 'rejected'].includes(wardRepresentativeStatus)) {
      update['wardRepresentativeApplication.status'] = wardRepresentativeStatus;
      update['wardRepresentativeApplication.reviewedAt'] = new Date();
      if (wardRepresentativeStatus === 'approved') {
        update.role = 'ward_rep';
        update.status = 'active';
        update.verificationStatus = 'verified';
      } else {
        update.status = 'suspended';
        update.verificationStatus = 'rejected';
      }
    }

    const targetLabel = before.name || before.email || String(before._id);
    const loc = before.wardRepresentativeApplication || {};
    const locFields = { province: loc.province || '', district: loc.district || '', municipality: loc.municipality || '', ward: String(loc.ward || '') };
    if (wardRepresentativeStatus === 'approved') {
      logAudit(req, { action: 'APPROVE_OFFICIAL', targetType: 'User', targetId: before._id, targetLabel, previousValue: { wardRepresentativeStatus: before.wardRepresentativeApplication?.status }, newValue: { wardRepresentativeStatus: 'approved' }, ...locFields });
    } else if (wardRepresentativeStatus === 'rejected') {
      logAudit(req, { action: 'REJECT_VERIFICATION', targetType: 'User', targetId: before._id, targetLabel, previousValue: { wardRepresentativeStatus: before.wardRepresentativeApplication?.status }, newValue: { wardRepresentativeStatus: 'rejected' }, ...locFields });
    } else if (verificationStatus) {
      logAudit(req, { action: verificationStatus === 'verified' ? 'APPROVE_VERIFICATION' : 'REJECT_VERIFICATION', targetType: 'User', targetId: before._id, targetLabel, previousValue: { verificationStatus: before.verificationStatus }, newValue: { verificationStatus }, ...locFields });
    }
    if (role && role !== before.role) {
      logAudit(req, { action: 'CHANGE_ROLE', targetType: 'User', targetId: before._id, targetLabel, previousValue: { role: before.role }, newValue: { role }, ...locFields });
    }
    if (status && status !== before.status && !wardRepresentativeStatus) {
      logAudit(req, { action: status === 'suspended' ? 'SUSPEND_USER' : 'REACTIVATE_USER', targetType: 'User', targetId: before._id, targetLabel, previousValue: { status: before.status }, newValue: { status }, ...locFields });
    }

    const updated = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    res.json({ user: updated.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ error: 'You cannot remove your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await Promise.all([
      Document.deleteMany({ user: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);
    res.json({ ok: true });

    logAudit(req, { action: 'DELETE_USER', targetType: 'User', targetId: user._id, targetLabel: user.name || user.email, previousValue: { name: user.name, email: user.email, role: user.role, status: user.status } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/:id/citizenship-doc', protect, requireRole('admin', 'municipality_head'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('citizenshipDoc citizenshipDocName name verificationStatus');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.citizenshipDoc) return res.status(404).json({ error: 'No citizenship document on file' });
    res.json({ citizenshipDoc: user.citizenshipDoc, citizenshipDocName: user.citizenshipDocName, name: user.name, verificationStatus: user.verificationStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;