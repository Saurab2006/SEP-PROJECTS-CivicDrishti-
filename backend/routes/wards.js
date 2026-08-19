const express = require('express');
const WardUnit = require('../models/WardUnit');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();
function publicWard(w) { return { _id: w._id, province: w.province, district: w.district, municipality: w.municipality, ward: w.ward, representative: w.representative || null }; }

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'ward_rep') {
      filter.province = req.user.wardRepresentativeApplication?.province || '';
      filter.district = req.user.wardRepresentativeApplication?.district || '';
      filter.ward = req.user.wardRepresentativeApplication?.ward || '';
    }
    const wards = await WardUnit.find(filter).sort({ province: 1, district: 1, ward: 1 }).populate('representative', 'name email role status wardRepresentativeApplication');
    res.json({ wards: wards.map(publicWard) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { province, district, municipality, ward, representative } = req.body || {};
    if (!province || !district || !ward) return res.status(422).json({ error: 'Province, district and ward are required' });
    const doc = await WardUnit.findOneAndUpdate(
      { province, district, municipality: municipality || '', ward: String(ward) },
      { province, district, municipality: municipality || '', ward: String(ward), representative: representative || null, createdBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('representative', 'name email role status wardRepresentativeApplication');
    res.status(201).json({ ward: publicWard(doc) });
    logAudit(req, { action: 'UPDATE_WARD', targetType: 'WardUnit', targetId: doc._id, targetLabel: `Ward ${doc.ward}, ${doc.municipality || doc.district}`, newValue: { province, district, municipality, ward, representative }, province, district, municipality, ward: String(ward) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const update = {};
    ['province', 'district', 'municipality', 'ward'].forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (req.body.representative !== undefined) update.representative = req.body.representative || null;
    const before = await WardUnit.findById(req.params.id).lean();
    const ward = await WardUnit.findByIdAndUpdate(req.params.id, update, { new: true }).populate('representative', 'name email role status wardRepresentativeApplication');
    if (!ward) return res.status(404).json({ error: 'Ward not found' });
    res.json({ ward: publicWard(ward) });
    logAudit(req, { action: 'UPDATE_WARD', targetType: 'WardUnit', targetId: ward._id, targetLabel: `Ward ${ward.ward}, ${ward.municipality || ward.district}`, previousValue: before, newValue: update, province: ward.province, district: ward.district, municipality: ward.municipality, ward: String(ward.ward) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/representatives/applications', protect, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find({ 'wardRepresentativeApplication.requested': true }).select('-password').sort({ createdAt: -1 });
    res.json({ applications: users.map(u => u.toPublic()) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
