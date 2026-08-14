const express = require('express');
const BudgetItem = require('../models/BudgetItem');
const Document = require('../models/Document');
const Activity = require('../models/Activity');
const ChangeRequest = require('../models/ChangeRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Project = require('../models/Project');
const { protect, requireRole } = require('../middleware/auth');
const { budgetDecisionEmail } = require('../utils/authEmails');

const router = express.Router();

function publicBudgetItem(i) {
  return {
    _id: i._id, title: i.title, department: i.department, sector: i.sector,
    amount: i.amount, spent: i.spent || 0, status: i.status || 'planned',
    completionOverride: i.completionOverride ?? null, province: i.province || deriveProvince(i.district), fiscalYear: i.fiscalYear, district: i.district,
    municipality: i.municipality, ward: i.ward, page: i.page,
    confidence: i.confidence, flagged: i.flagged, flagReason: i.flagReason,
    flaggedAt: i.flaggedAt, documentId: i.document?._id, documentTitle: i.document?.title,
  };
}
function csvEscape(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }


const PROVINCES = [
  { name: 'Koshi Province', code: 'P1', districts: ['Taplejung','Panchthar','Ilam','Jhapa','Morang','Sunsari','Dhankuta','Terhathum','Sankhuwasabha','Bhojpur','Solukhumbu','Okhaldhunga','Khotang','Udayapur'] },
  { name: 'Madhesh Province', code: 'P2', districts: ['Saptari','Siraha','Dhanusha','Mahottari','Sarlahi','Rautahat','Bara','Parsa'] },
  { name: 'Bagmati Province', code: 'P3', districts: ['Dolakha','Sindhupalchok','Rasuwa','Dhading','Nuwakot','Kathmandu','Bhaktapur','Lalitpur','Kavrepalanchok','Ramechhap','Sindhuli','Makwanpur','Chitwan'] },
  { name: 'Gandaki Province', code: 'P4', districts: ['Gorkha','Lamjung','Tanahun','Kaski','Manang','Mustang','Parbat','Syangja','Myagdi','Baglung','Nawalpur'] },
  { name: 'Lumbini Province', code: 'P5', districts: ['Rupandehi','Kapilvastu','Nawalparasi','Palpa','Arghakhanchi','Gulmi','Dang','Pyuthan','Rolpa','Eastern Rukum','Banke','Bardiya'] },
  { name: 'Karnali Province', code: 'P6', districts: ['Western Rukum','Salyan','Dolpa','Jumla','Mugu','Humla','Kalikot','Jajarkot','Dailekh','Surkhet'] },
  { name: 'Sudurpashchim Province', code: 'P7', districts: ['Kailali','Kanchanpur','Dadeldhura','Doti','Achham','Bajura','Bajhang','Baitadi','Darchula'] },
];
const DISTRICT_TO_PROVINCE = PROVINCES.reduce((acc, p) => { p.districts.forEach(d => { acc[d.toLowerCase()] = p.name; }); return acc; }, {});
const STATUS_PERCENT = { planned: 10, ongoing: 55, completed: 100, delayed: 35 };
function deriveProvince(district) { return DISTRICT_TO_PROVINCE[String(district || '').toLowerCase()] || 'Unmapped Province'; }
function completionFor(row) {
  const manual = Number(row.completionOverride);
  if (Number.isFinite(manual)) return Math.max(0, Math.min(100, manual));
  return STATUS_PERCENT[row.status] ?? 25;
}
function emptyNode(level, name, parent = null) {
  return { id: `${level}:${parent || 'root'}:${name}`, level, name, parent, allocated: 0, spent: 0, completed: 0, remaining: 0, completion: 0, planned: 0, ongoing: 0, completedStage: 0, delayed: 0, projectCount: 0 };
}
function addToNode(node, row) {
  const allocated = Number(row.amount ?? row.budget ?? 0) || 0;
  const percent = completionFor(row);
  const spent = Number(row.spent) > 0 ? Number(row.spent) : allocated * (percent / 100);
  node.allocated += allocated;
  node.spent += spent;
  node.completed += allocated * (percent / 100);
  node.remaining += allocated * (1 - percent / 100);
  node.projectCount += 1;
  const status = row.status || 'planned';
  if (status === 'completed') node.completedStage += 1;
  else if (status === 'ongoing') node.ongoing += 1;
  else if (status === 'delayed') node.delayed += 1;
  else node.planned += 1;
}
function finishNode(node) {
  node.allocated = Math.round(node.allocated);
  node.spent = Math.round(node.spent);
  node.completed = Math.round(node.completed);
  node.remaining = Math.max(0, Math.round(node.remaining));
  node.completion = node.allocated ? Math.round((node.completed / node.allocated) * 100) : 0;
  return node;
}
function buildTracking(items, projects) {
  const rows = [...items, ...projects].map(row => ({
    amount: row.amount ?? row.budget ?? 0,
    spent: row.spent || 0,
    status: row.status || 'planned',
    completionOverride: row.completionOverride,
    province: row.province || deriveProvince(row.district),
    district: row.district || 'Unspecified District',
    municipality: row.municipality || 'Municipality not specified',
    ward: row.ward ? `Ward ${row.ward}` : 'Ward not specified',
  }));
  const maps = { province: new Map(), district: new Map(), municipality: new Map(), ward: new Map() };
  const ensure = (level, name, parent) => {
    const key = `${parent || 'root'}|${name}`;
    if (!maps[level].has(key)) maps[level].set(key, emptyNode(level, name, parent));
    return maps[level].get(key);
  };
  PROVINCES.forEach(p => ensure('province', p.name, null));
  rows.forEach(row => {
    [ensure('province', row.province, null), ensure('district', row.district, row.province), ensure('municipality', row.municipality, row.district), ensure('ward', row.ward, row.municipality)].forEach(node => addToNode(node, row));
  });
  const toArray = level => Array.from(maps[level].values()).map(finishNode).sort((a, b) => b.allocated - a.allocated || a.name.localeCompare(b.name));
  return { provinces: toArray('province'), districts: toArray('district'), municipalities: toArray('municipality'), wards: toArray('ward'), generatedAt: new Date().toISOString() };
}
router.get('/export.csv', protect, async (req, res) => {
  try {
    const items = await BudgetItem.find({ user: req.user._id }).sort({ fiscalYear: -1, amount: -1 }).limit(5000);
    const headers = ['Title', 'Department', 'Sector', 'Amount', 'Fiscal Year', 'District', 'Municipality', 'Ward', 'Flagged'];
    const rows = items.map(i => [i.title, i.department, i.sector, i.amount, i.fiscalYear, i.district, i.municipality, i.ward, i.flagged ? 'yes' : 'no'].map(csvEscape).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="govinsight-budget-export.csv"');
    res.send([headers.map(csvEscape).join(','), ...rows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/tracking', protect, async (req, res) => {
  try {
    const user = req.user._id;
    const [items, projects] = await Promise.all([
      BudgetItem.find(req.user.role === 'ward_rep' ? { district: req.user.wardRepresentativeApplication?.district || '__none__', ward: String(req.user.wardRepresentativeApplication?.ward || '__none__') } : { user }).select('amount spent status completionOverride province district municipality ward').lean(),
      Project.find(req.user.role === 'ward_rep' ? { district: req.user.wardRepresentativeApplication?.district || '__none__', ward: String(req.user.wardRepresentativeApplication?.ward || '__none__') } : { user }).select('budget spent status completionOverride province district municipality ward').lean(),
    ]);
    res.json(buildTracking(items, projects));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'ward_rep' ? {} : { user: req.user._id };
    if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; filter.district = a.district || '__none__'; filter.ward = String(a.ward || '__none__'); }
    if (req.query.sector && req.query.sector !== 'all') filter.sector = req.query.sector;
    if (req.query.fiscalYear && req.query.fiscalYear !== 'all') filter.fiscalYear = req.query.fiscalYear;
    if (req.query.district && req.query.district !== 'all') filter.district = req.query.district;
    if (req.query.ward && req.query.ward !== 'all') filter.ward = req.query.ward;
    if (req.query.flagged === 'true') filter.flagged = true;
    if (req.query.q) filter.$or = [
      { title: { $regex: req.query.q, $options: 'i' } },
      { department: { $regex: req.query.q, $options: 'i' } },
      { district: { $regex: req.query.q, $options: 'i' } },
      { municipality: { $regex: req.query.q, $options: 'i' } },
    ];

    const items = await BudgetItem.find(filter).sort({ amount: -1 }).limit(Number(req.query.limit) || 100).populate('document', 'title');
    res.json({ items: items.map(publicBudgetItem) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/meta/wards', protect, async (req, res) => {
  try {
    const filter = { user: req.user._id, ward: { $nin: [null, ''] } };
    if (req.query.district && req.query.district !== 'all') filter.district = req.query.district;
    const wards = await BudgetItem.distinct('ward', filter);
    res.json({ wards: wards.sort() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/changes', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { requestedBy: req.user._id };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    const changes = await ChangeRequest.find(filter).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 100)
      .populate('budgetItem', 'title amount department sector fiscalYear district')
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role');
    res.json({ changes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/changes', protect, requireRole('official', 'ward_rep'), async (req, res) => {
  try {
    let { title, department, sector, amount, fiscalYear, district, municipality, ward, reason } = req.body;
    if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; district = a.district || district; municipality = a.municipality || municipality; ward = a.ward || ward; }
    if (!title || !department || !sector || !fiscalYear) return res.status(422).json({ error: 'Title, department, sector, and fiscal year are required' });
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) return res.status(422).json({ error: 'Amount must be a valid positive number' });
    const doc = await Document.create({ user: req.user._id, title: `Proposed record - ${title}`, fileName: 'manual-entry', docType: 'budget', fiscalYear, district: district || '', municipality: municipality || '', totalBudget: amountNum, summary: 'Manual budget record proposed by official.' });
    const change = await ChangeRequest.create({ user: req.user._id, budgetItem: null, type: 'create', requestedBy: req.user._id, reason: reason || '', proposed: { title, department, sector, amount: amountNum, fiscalYear, district: district || '', municipality: municipality || '', ward: ward || '', document: doc._id } });
    await Activity.create({ user: req.user._id, type: 'change-request', message: `Proposed a new budget record: "${title}"` });
    res.status(201).json({ change });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/changes', protect, requireRole('official', 'ward_rep'), async (req, res) => {
  try {
    const budgetFilter = req.user.role === 'ward_rep' ? { _id: req.params.id, district: req.user.wardRepresentativeApplication?.district || '__none__', ward: String(req.user.wardRepresentativeApplication?.ward || '__none__') } : { _id: req.params.id, user: req.user._id };
    const budgetItem = await BudgetItem.findOne(budgetFilter);
    if (!budgetItem) return res.status(404).json({ error: 'Budget item not found' });
    const allowed = ['title', 'department', 'sector', 'amount', 'fiscalYear', 'district', 'municipality', 'ward'];
    const proposed = {};
    allowed.forEach(key => { if (req.body[key] !== undefined && req.body[key] !== '') proposed[key] = req.body[key]; });
    if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; proposed.district = a.district || proposed.district; proposed.municipality = a.municipality || proposed.municipality; proposed.ward = a.ward || proposed.ward; }
    if (proposed.amount !== undefined) {
      proposed.amount = Number(proposed.amount);
      if (!Number.isFinite(proposed.amount) || proposed.amount < 0) return res.status(422).json({ error: 'Amount must be a valid positive number' });
    }
    if (Object.keys(proposed).length === 0) return res.status(422).json({ error: 'Add at least one proposed change' });
    const change = await ChangeRequest.create({ user: budgetItem.user, budgetItem: budgetItem._id, type: 'update', requestedBy: req.user._id, reason: req.body.reason || '', proposed });
    await Activity.create({ user: req.user._id, type: 'change-request', message: `Proposed a budget update for "${budgetItem.title}"` });
    res.status(201).json({ change });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/changes/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(422).json({ error: 'Status must be approved or rejected' });
    const change = await ChangeRequest.findById(req.params.id).populate('budgetItem').populate('requestedBy', 'name email');
    if (!change) return res.status(404).json({ error: 'Change request not found' });
    if (change.status !== 'pending') return res.status(409).json({ error: 'Change request already reviewed' });
    change.status = status;
    change.reviewedBy = req.user._id;
    change.reviewedAt = new Date();
    await change.save();

    if (change.requestedBy?.email) budgetDecisionEmail(change.requestedBy, change, status);

    if (status === 'approved') {
      if (change.type === 'create' || !change.budgetItem) {
        const p = change.proposed || {};
        await BudgetItem.create({ user: change.user, document: p.document, title: p.title, department: p.department, sector: p.sector, amount: p.amount, fiscalYear: p.fiscalYear, district: p.district || '', municipality: p.municipality || '', ward: p.ward || '', page: 1, confidence: 1 });
        await Activity.create({ user: change.user, type: 'approval', message: `Approved new budget record "${p.title}"` });
      } else {
        await BudgetItem.findByIdAndUpdate(change.budgetItem._id, change.proposed, { new: true });
        await Activity.create({ user: change.user, type: 'approval', message: `Approved budget update for "${change.budgetItem.title}"` });
      }
    } else {
      await Activity.create({ user: change.user, type: 'approval', message: `Rejected budget change request` });
    }
    res.json({ change });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/flag', protect, async (req, res) => {
  try {
    const reason = (req.body?.reason || '').trim();
    if (!reason) return res.status(422).json({ error: 'Please describe why this entry looks suspicious' });
    const item = await BudgetItem.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { flagged: true, flagReason: reason, flaggedBy: req.user._id, flaggedAt: new Date() }, { new: true });
    if (!item) return res.status(404).json({ error: 'Budget item not found' });
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (admins.length) await Notification.insertMany(admins.map(u => ({ user: u._id, type: 'budget-flagged', title: 'Budget entry flagged', message: `"${item.title}" was flagged for review: ${reason}`, link: '/budget' })));
    res.status(201).json({ item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/flag', protect, requireRole('admin'), async (req, res) => {
  try {
    const item = await BudgetItem.findByIdAndUpdate(req.params.id, { flagged: false, flagReason: '', flaggedBy: null, flaggedAt: null }, { new: true });
    if (!item) return res.status(404).json({ error: 'Budget item not found' });
    res.json({ item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;




