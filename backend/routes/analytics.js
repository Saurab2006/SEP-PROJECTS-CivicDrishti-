const express = require('express');
const Document = require('../models/Document');
const BudgetItem = require('../models/BudgetItem');
const Project = require('../models/Project');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');

const SECTOR_COLORS = {
  'Roads & Transport': '#2563EB', Health: '#10B981', Education: '#8B5CF6', 'Drinking Water': '#06B6D4',
  Agriculture: '#F59E0B', Energy: '#EF4444', 'Urban Development': '#EC4899', 'Disaster Management': '#F97316',
};

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const uid = req.user._id;
    const [docs, budgets, projects, activities] = await Promise.all([
      Document.find({ user: uid }).sort({ createdAt: -1 }),
      BudgetItem.find({ user: uid }),
      Project.find({ user: uid }),
      Activity.find({ user: uid }).sort({ createdAt: -1 }).limit(5),
    ]);

    const totalBudget = docs.reduce((a, d) => a + (d.totalBudget || 0), 0);
    const deptSet = new Set(budgets.map(b => b.department));
    const latestFy = docs.length ? docs.sort((a, b) => b.fiscalYear?.localeCompare(a.fiscalYear))[0].fiscalYear : '—';

    // Sector breakdown
    const sectorMap = {};
    budgets.forEach(b => { sectorMap[b.sector] = (sectorMap[b.sector] || 0) + b.amount; });
    const sectorBreakdown = Object.entries(sectorMap)
      .map(([key, value]) => ({ key, value, color: SECTOR_COLORS[key] || '#2563EB' }))
      .sort((a, b) => b.value - a.value).slice(0, 8);

    // Budget trend by FY
    const fyMap = {};
    budgets.forEach(b => { fyMap[b.fiscalYear] = (fyMap[b.fiscalYear] || 0) + b.amount; });
    const budgetTrend = Object.entries(fyMap).map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key));

    // Top departments
    const deptMap = {};
    budgets.forEach(b => { const k = b.department.replace(/^(Ministry|Department) of /, ''); deptMap[k] = (deptMap[k] || 0) + b.amount; });
    const topDepartments = Object.entries(deptMap).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    // District
    const distMap = {};
    budgets.filter(b => b.district).forEach(b => { distMap[b.district] = (distMap[b.district] || 0) + b.amount; });
    const districts = Object.entries(distMap).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    // Budget utilization
    const utilMap = {};
    projects.forEach(p => {
      const e = utilMap[p.sector] || { key: p.sector, total: 0, utilized: 0 };
      e.total += p.budget || 0;
      if (p.status === 'completed' || p.status === 'ongoing') e.utilized += p.budget || 0;
      utilMap[p.sector] = e;
    });
    const utilization = Object.values(utilMap)
      .filter(u => u.total > 0)
      .map(u => ({ ...u, percent: Math.round((u.utilized / u.total) * 100), color: SECTOR_COLORS[u.key] || '#2563EB' }))
      .sort((a, b) => b.total - a.total).slice(0, 6);

    // Recent docs
    const recentDocuments = docs.slice(0, 6).map(d => ({
      _id: d._id, title: d.title, docType: d.docType, status: d.status, totalBudget: d.totalBudget,
      fiscalYear: d.fiscalYear, summary: d.summary, createdAt: d.createdAt,
    }));

    res.json({
      kpis: { documents: docs.length, totalBudget, departments: deptSet.size, projects: projects.length, latestFy },
      sectorBreakdown, budgetTrend, topDepartments, districts, utilization, recentDocuments,
      activity: activities.map(a => ({ _id: a._id, type: a.type, message: a.message, createdAt: a.createdAt })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;