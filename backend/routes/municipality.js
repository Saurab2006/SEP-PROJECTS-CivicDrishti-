const express = require('express');
const IncidentReport = require('../models/IncidentReport');
const BudgetItem = require('../models/BudgetItem');
const Project = require('../models/Project');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

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

module.exports = router;
