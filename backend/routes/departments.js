const express = require('express');
const BudgetItem = require('../models/BudgetItem');
const { protect } = require('../middleware/auth');

const SECTOR_COLORS = {
  'Roads & Transport': '#2563EB', Health: '#10B981', Education: '#8B5CF6', 'Drinking Water': '#06B6D4',
  Agriculture: '#F59E0B', Energy: '#EF4444', 'Urban Development': '#EC4899', 'Disaster Management': '#F97316',
};

function shortDept(name) { return name.replace(/^(Ministry|Department) of /, '').split(',')[0]; }

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const budgets = await BudgetItem.find({ user: req.user._id });
    const name = req.query.name;

    const map = {};
    budgets.forEach(b => {
      const key = shortDept(b.department);
      const e = map[key] || { name: key, total: 0, count: 0, sectors: {}, districts: new Set(), byYear: {} };
      e.total += b.amount; e.count++;
      e.sectors[b.sector] = (e.sectors[b.sector] || 0) + b.amount;
      if (b.district) e.districts.add(b.district);
      e.byYear[b.fiscalYear] = (e.byYear[b.fiscalYear] || 0) + b.amount;
      map[key] = e;
    });

    if (!name) {
      const list = Object.values(map).map(e => ({
        name: e.name, total: e.total, count: e.count,
        topSector: Object.entries(e.sectors).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
        districts: e.districts.size,
      })).sort((a, b) => b.total - a.total);
      return res.json({ departments: list });
    }

    const entry = map[name];
    if (!entry) return res.json({ department: null });

    const lines = budgets.filter(b => shortDept(b.department) === name).sort((a, b) => b.amount - a.amount).slice(0, 60)
      .map(b => ({ _id: b._id, title: b.title, sector: b.sector, amount: b.amount, fiscalYear: b.fiscalYear, district: b.district, page: b.page, documentId: b.document }));

    res.json({
      department: {
        name, total: entry.total, count: entry.count, districts: entry.districts.size,
        topSector: Object.entries(entry.sectors).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
        sectors: Object.entries(entry.sectors).map(([key, value]) => ({ key, value, color: SECTOR_COLORS[key] || '#2563EB' })).sort((a, b) => b.value - a.value),
        trend: Object.entries(entry.byYear).map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key)),
        lines,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
