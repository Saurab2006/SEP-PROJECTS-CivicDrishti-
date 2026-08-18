const express = require('express');
const User = require('../models/User');
const Document = require('../models/Document');
const WardUnit = require('../models/WardUnit');
const { protect, requireRole } = require('../middleware/auth');
const { accountDecisionEmail } = require('../utils/authEmails');

const router = express.Router();

const HIDDEN_DEMO_EMAILS = ['researcher@govinsight.np', 'analyst@govinsight.np', 'admin@govinsight.np'];
const ROLE_VALUES = ['admin', 'researcher', 'ward_rep', 'municipality_head'];

// GET /api/users - admin only
router.get('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find({ email: { $nin: HIDDEN_DEMO_EMAILS } }).select('-password').sort({ createdAt: -1 });
    const enriched = await Promise.all(users.map(async u => {
      const docCount = await Document.countDocuments({ user: u._id });
      return { ...u.toPublic(), documentCount: docCount };
    }));
    res.json({ users: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id - admin only
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

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (wardRepresentativeStatus === 'approved') {
      const app = user.wardRepresentativeApplication || {};
      if (app.province && app.district && app.ward) {
        await WardUnit.findOneAndUpdate({ province: app.province, district: app.district, municipality: app.municipality || '', ward: String(app.ward) }, { province: app.province, district: app.district, municipality: app.municipality || '', ward: String(app.ward), representative: user._id, createdBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
      }
    }
    res.json({ user: user.toPublic() });

    if (wardRepresentativeStatus && before.email) {
      accountDecisionEmail(before, wardRepresentativeStatus);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id - admin only
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id/citizenship-doc - admin/municipality head only.
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


