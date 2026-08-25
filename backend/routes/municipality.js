const express = require('express');
const IncidentReport = require('../models/IncidentReport');
const BudgetItem = require('../models/BudgetItem');
const Project = require('../models/Project');
const User = require('../models/User');
const WardUnit = require('../models/WardUnit');
const { protect, requireRole } = require('../middleware/auth');
const { welcomeEmail } = require('../utils/authEmails');

const router = express.Router();

router.get('/dashboard', protect, requireRole('municipality_head'), async (req, res) => {
  try {
    const profile = req.user.municipalityHeadProfile || {};
    const scope = { 'location.district': profile.district || '__none__', 'location.municipality': profile.municipality || '__none__' };
    const budgetScope = { district: profile.district || '__none__', municipality: profile.municipality || '__none__' };
    const [reports, budgets, projects, wardReps, citizens] = await Promise.all([
      IncidentReport.find(scope).sort({ priorityScore: -1, createdAt: -1 }).limit(50).lean(),
      BudgetItem.find(budgetScope).sort({ amount: -1 }).limit(50).lean(),
      Project.find(budgetScope).sort({ createdAt: -1 }).limit(50).lean(),
      User.find({ role: 'ward_rep', status: 'active', 'wardRepresentativeApplication.status': 'approved', 'wardRepresentativeApplication.district': profile.district || '', 'wardRepresentativeApplication.municipality': profile.municipality || '' }).select('name email wardRepresentativeApplication').lean(),
      User.countDocuments({ role: 'researcher', status: 'active', 'civicLocation.district': profile.district || '', 'civicLocation.municipality': profile.municipality || '' }),
    ]);
    const allocated = budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0) + projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const spent = budgets.reduce((sum, b) => sum + (Number(b.spent) || 0), 0) + projects.reduce((sum, p) => sum + (Number(p.spent) || 0), 0);
    const byWard = {};
    reports.forEach(r => { const ward = String(r.location?.ward || 'Unassigned'); byWard[ward] = byWard[ward] || { ward, reports: 0, urgent: 0 }; byWard[ward].reports += 1; if (['high','critical'].includes(r.priorityLevel) || ['high','critical'].includes(r.severity)) byWard[ward].urgent += 1; });
    res.json({ profile, summary: { reports: reports.length, activeReports: reports.filter(r => !['completed','rejected','duplicate'].includes(r.status)).length, citizens, wardRepresentatives: wardReps.length, allocated, spent, remaining: Math.max(0, allocated - spent) }, wards: Object.values(byWard).sort((a,b) => Number(a.ward) - Number(b.ward)), reports, budgets, projects, wardRepresentatives: wardReps });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// A municipality head can directly create a ward representative account for
// a ward inside their own municipality - the account is created active and
// pre-approved (no separate admin review step), and is scoped to the head's
// own province/district/municipality so they can't assign someone outside
// their jurisdiction. The new rep is also linked into WardUnit so it shows
// up immediately in the admin's Ward Offices directory.
router.get('/ward-representatives', protect, requireRole('municipality_head'), async (req, res) => {
  try {
    const profile = req.user.municipalityHeadProfile || {};
    const reps = await User.find({
      role: 'ward_rep',
      'wardRepresentativeApplication.district': profile.district || '__none__',
      'wardRepresentativeApplication.municipality': profile.municipality || '__none__',
    }).select('-password').sort({ createdAt: -1 });
    res.json({ representatives: reps.map(u => u.toPublic()) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ward-representatives', protect, requireRole('municipality_head'), async (req, res) => {
  try {
    const profile = req.user.municipalityHeadProfile || {};
    if (!profile.district || !profile.municipality) return res.status(422).json({ error: 'Your municipality profile is incomplete - contact an admin' });
    const { name, email, password, ward, details } = req.body || {};
    if (!name || !email || !password || !ward) return res.status(422).json({ error: 'Name, email, password and ward are required' });
    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'An account with this email already exists' });

    const rep = await User.create({
      name: String(name).trim(), email: String(email).toLowerCase().trim(), password,
      role: 'ward_rep', organization: profile.municipality, jobTitle: 'Ward Representative',
      status: 'active', verificationStatus: 'verified', emailVerified: true,
      wardRepresentativeApplication: {
        requested: true, status: 'approved',
        province: profile.province || '', district: profile.district, municipality: profile.municipality, ward: String(ward),
        details: details || `Added by municipality head ${req.user.name}`,
        reviewedAt: new Date(),
      },
      civicLocation: { province: profile.province || '', district: profile.district, municipality: profile.municipality, ward: String(ward) },
    });

    await WardUnit.findOneAndUpdate(
      { province: profile.province || '', district: profile.district, municipality: profile.municipality, ward: String(ward) },
      { province: profile.province || '', district: profile.district, municipality: profile.municipality, ward: String(ward), representative: rep._id, createdBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    welcomeEmail(rep);
    res.status(201).json({ representative: rep.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;