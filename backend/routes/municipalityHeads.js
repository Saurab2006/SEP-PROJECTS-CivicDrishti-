const express = require('express');
const Municipality = require('../models/Municipality');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');
const { welcomeEmail } = require('../utils/authEmails');

const router = express.Router();

router.get('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const heads = await User.find({ role: 'municipality_head' }).select('-password').sort({ createdAt: -1 });
    res.json({ heads: heads.map(u => u.toPublic()) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, province, district, municipality, municipalityType, officePhone, officeAddress } = req.body || {};
    if (!name || !email || !password || !province || !district || !municipality) return res.status(422).json({ error: 'Name, email, password, province, district and municipality are required' });
    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'An account with this email already exists' });
    const head = await User.create({
      name: String(name).trim(), email: String(email).toLowerCase().trim(), password,
      role: 'municipality_head', organization: municipality, jobTitle: 'Municipality Head', status: 'active', verificationStatus: 'n/a', emailVerified: true,
      municipalityHeadProfile: { province, district, municipality, municipalityType: municipalityType || 'municipality', officePhone: officePhone || '', officeAddress: officeAddress || '', assignedAt: new Date() },
      civicLocation: { province, district, municipality, municipalityType: municipalityType || 'municipality', ward: '', address: officeAddress || '' },
    });
    const record = await Municipality.findOneAndUpdate(
      { province, district, name: municipality },
      { province, district, name: municipality, type: municipalityType || 'municipality', head: head._id, officePhone: officePhone || '', officeAddress: officeAddress || '', updatedBy: req.user._id, createdBy: req.user._id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    welcomeEmail(head);
    res.status(201).json({ head: head.toPublic(), municipality: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const allowed = ['status', 'name', 'organization', 'jobTitle'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const head = await User.findOneAndUpdate({ _id: req.params.id, role: 'municipality_head' }, update, { new: true }).select('-password');
    if (!head) return res.status(404).json({ error: 'Municipality head not found' });
    res.json({ head: head.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
