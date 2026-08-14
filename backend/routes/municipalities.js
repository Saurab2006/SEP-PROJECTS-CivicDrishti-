const express = require('express');
const Municipality = require('../models/Municipality');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

function clean(body) {
  return {
    province: String(body.province || '').trim(),
    district: String(body.district || '').trim(),
    name: String(body.name || body.municipality || '').trim(),
    type: body.type || 'municipality',
    wards: Array.isArray(body.wards) ? body.wards.map(String).filter(Boolean) : String(body.ards || body.wards || '').split(',').map(s => s.trim()).filter(Boolean),
    officeAddress: String(body.officeAddress || '').trim(),
    officePhone: String(body.officePhone || '').trim(),
  };
}

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'municipality_head') {
      const a = req.user.municipalityHeadProfile || {};
      filter.district = a.district || '__none__';
      filter.name = a.municipality || '__none__';
    }
    const municipalities = await Municipality.find(filter).sort({ province: 1, district: 1, name: 1 }).populate('head', 'name email role status');
    res.json({ municipalities });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const data = clean(req.body || {});
    if (!data.province || !data.district || !data.name) return res.status(422).json({ error: 'Province, district and municipality name are required' });
    const municipality = await Municipality.findOneAndUpdate(
      { province: data.province, district: data.district, name: data.name },
      { ...data, createdBy: req.user._id, updatedBy: req.user._id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ municipality });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const municipality = await Municipality.findByIdAndUpdate(req.params.id, { ...clean(req.body || {}), updatedBy: req.user._id }, { new: true });
    if (!municipality) return res.status(404).json({ error: 'Municipality not found' });
    res.json({ municipality });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
