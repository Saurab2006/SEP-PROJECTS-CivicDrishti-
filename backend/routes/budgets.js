const express = require('express');
const BudgetItem = require('../models/BudgetItem');
const Document = require('../models/Document');
const Activity = require('../models/Activity');
const ChangeRequest = require('../models/ChangeRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Project = require('../models/Project');
const WardUnit = require('../models/WardUnit');
const BudgetFeedback = require('../models/BudgetFeedback');
const IncidentReport = require('../models/IncidentReport');
const { protect, requireRole } = require('../middleware/auth');
const { budgetDecisionEmail } = require('../utils/authEmails');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();

function financialFlow(i) {
  const originalApprovedBudget = Number(i.originalApprovedBudget || i.amount || 0);
  const revisedBudget = Number(i.revisedBudget || i.amount || originalApprovedBudget);
  const releasedAmount = Number(i.releasedAmount || i.spent || 0);
  const contractedAmount = Number(i.contractedAmount || 0);
  const paidAmount = Number(i.paidAmount || i.spent || 0);
  return {
    originalApprovedBudget, revisedBudget, releasedAmount, contractedAmount, paidAmount,
    remainingAmount: Math.max(0, revisedBudget - paidAmount),
    releasePercent: revisedBudget ? Math.round((releasedAmount / revisedBudget) * 100) : 0,
    paidPercent: revisedBudget ? Math.round((paidAmount / revisedBudget) * 100) : 0,
  };
}
function publicBudgetItem(i) {
  const flow = financialFlow(i);
  return {
    _id: i._id, title: i.title, department: i.department, sector: i.sector,
    expenditureType: i.expenditureType || 'Capital Expenditure', programType: i.programType || 'Infrastructure',
    fundingSources: i.fundingSources || [], amount: i.amount, spent: i.spent || flow.paidAmount,
    status: i.status || 'planned', completionOverride: i.completionOverride ?? null,
    province: i.province || deriveProvince(i.district), fiscalYear: i.fiscalYear, district: i.district,
    municipality: i.municipality, ward: i.ward, page: i.page, financialFlow: flow,
    confidence: i.confidence, flagged: i.flagged, flagReason: i.flagReason, flaggedAt: i.flaggedAt,
    isDemo: Boolean(i.isDemo), demoLabel: i.demoLabel || (i.isDemo ? 'Demo Data' : ''),
    evidenceDocuments: i.evidenceDocuments || [], documentId: i.document?._id, documentTitle: i.document?.title,
  };
}
function csvEscape(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

// Case- and whitespace-insensitive exact match. Location names on budget
// records are free-typed by officials (municipality heads / ward reps), so
// "Morang" vs "morang " vs "Morang" would previously fail a strict ===
// match and silently return zero results — even for a citizen's own,
// correctly-approved ward budget. Ward numbers already got this treatment
// via wardVariants(); province/district/municipality now get it too.
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function exactCI(value) { return { $regex: `^${escapeRegExp(String(value).trim())}$`, $options: 'i' }; }
// Province is also free-typed on the citizen's own Settings page, where
// people naturally type the short form ("Koshi") while budget records store
// the official full name ("Koshi Province"). Match either form: the query
// value with or without a trailing "Province".
function provinceMatch(value) {
  const norm = escapeRegExp(String(value || '').trim().replace(/\s+province$/i, ''));
  return { $regex: `^${norm}(\\s+province)?$`, $options: 'i' };
}

function buildBudgetFilter(req) {
  const q = req.query || req || {};
  const filter = {};
  if (q.province && q.province !== 'all') filter.province = provinceMatch(q.province);
  if (q.district && q.district !== 'all') filter.district = exactCI(q.district);
  if (q.municipality && q.municipality !== 'all') filter.municipality = exactCI(q.municipality);
  if (q.ward && q.ward !== 'all') filter.ward = q.ward;
  if (q.department && q.department !== 'all') filter.department = q.department;
  if (q.sector && q.sector !== 'all') filter.sector = q.sector;
  if (q.fiscalYear && q.fiscalYear !== 'all') filter.fiscalYear = q.fiscalYear;
  if (q.project) filter.title = { $regex: q.project, $options: 'i' };
  if (q.q) filter.$or = [
    { title: { $regex: q.q, $options: 'i' } },
    { department: { $regex: q.q, $options: 'i' } },
    { district: { $regex: q.q, $options: 'i' } },
    { municipality: { $regex: q.q, $options: 'i' } },
  ];
  return filter;
}

function numericValue(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

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
async function resolveWardUnitId({ province, district, municipality, ward, createdBy }) {
  if (!province || !district || !ward) return null;
  const doc = await WardUnit.findOneAndUpdate(
    { province, district, municipality: municipality || '', ward: String(ward) },
    { province, district, municipality: municipality || '', ward: String(ward), createdBy },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select('_id');
  return doc?._id || null;
}
function wardLabel(value) {
  const raw = String(value || '').replace(/^Ward\s+/i, '').trim();
  if (!raw) return 'Ward not specified';
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) ? `Ward ${num}` : `Ward ${raw}`;
}
function wardVariants(value) {
  const raw = String(value || '').replace(/^Ward\s+/i, '').trim();
  if (!raw) return ['__none__'];
  const num = Number.parseInt(raw, 10);
  const variants = new Set([raw, raw.padStart(2, '0'), `Ward ${raw}`, `Ward ${raw.padStart(2, '0')}`]);
  if (Number.isFinite(num)) variants.add(String(num));
  return Array.from(variants);
}
let approvedCreateSyncAt = 0;
async function syncApprovedCreatedBudgets() {
  if (Date.now() - approvedCreateSyncAt < 5000) return;
  approvedCreateSyncAt = Date.now();
  const changes = await ChangeRequest.find({ status: 'approved', type: 'create' }).sort({ reviewedAt: -1 }).limit(200);
  for (const change of changes) {
    const p = change.proposed || {};
    if (!p.title || !p.document) continue;
    if (change.budgetItem) {
      const linked = await BudgetItem.exists({ _id: change.budgetItem });
      if (linked) continue;
    }
    const existing = await BudgetItem.findOne({ $or: [{ document: p.document }, { title: p.title, fiscalYear: p.fiscalYear, district: p.district || '', municipality: p.municipality || '', ward: p.ward || '' }] }).select('_id');
    if (existing) {
      change.budgetItem = existing._id;
      await change.save();
      continue;
    }
    const amount = numericValue(p.amount, 0);
    const created = await BudgetItem.create({
      user: change.user,
      document: p.document,
      title: p.title,
      department: p.department || 'Municipal Office',
      sector: p.sector || 'Other',
      expenditureType: p.expenditureType || 'Capital Expenditure',
      programType: p.programType || 'Infrastructure',
      amount,
      originalApprovedBudget: numericValue(p.originalApprovedBudget, amount),
      revisedBudget: numericValue(p.revisedBudget, amount),
      releasedAmount: numericValue(p.releasedAmount, 0),
      disbursedAmount: numericValue(p.disbursedAmount || p.releasedAmount, 0),
      contractedAmount: numericValue(p.contractedAmount, 0),
      paidAmount: numericValue(p.paidAmount, 0),
      spent: numericValue(p.paidAmount, 0),
      fiscalYear: p.fiscalYear || '2082/83',
      province: p.province || deriveProvince(p.district),
      district: p.district || '',
      municipality: p.municipality || '',
      ward: p.ward || '',
      wardUnit: p.wardUnit || null,
      confidence: 1,
      isDemo: false,
      revisionHistory: [{ previous: {}, next: p, reason: change.reason || '', requestedBy: change.requestedBy, reviewedBy: change.reviewedBy, status: 'approved', supportingDocument: p.document || null, reviewedAt: change.reviewedAt || new Date() }],
    });
    change.budgetItem = created._id;
    await change.save();
  }
}
function budgetManagementFilter(user, id) {
  if (user.role === 'ward_rep') {
    const a = user.wardRepresentativeApplication || {};
    return { _id: id, province: provinceMatch(a.province || 'Koshi Province'), district: exactCI(a.district || '__none__'), municipality: exactCI(a.municipality || '__none__'), ward: { $in: wardVariants(a.ward) } };
  }
  if (user.role === 'municipality_head') {
    const a = user.municipalityHeadProfile || {};
    return { _id: id, province: provinceMatch(a.province || 'Koshi Province'), district: exactCI(a.district || '__none__'), municipality: exactCI(a.municipality || '__none__') };
  }
  return { _id: id };
}
function pickPreviousBudgetValues(item, proposed) {
  const obj = {};
  Object.keys(proposed || {}).forEach(key => {
    if (key === 'document') return;
    obj[key] = item?.[key];
  });
  return obj;
}
function accountabilityFor(item, feedbackStats, relatedReports) {
  const flow = financialFlow(item);
  const physical = completionFor(item);
  const financial = flow.paidPercent;
  const delayedPenalty = item.status === 'delayed' ? 20 : 0;
  const revisionPenalty = flow.originalApprovedBudget && flow.revisedBudget > flow.originalApprovedBudget * 1.25 ? 12 : 0;
  const pendingReports = (relatedReports || []).filter(r => !['completed', 'rejected', 'duplicate'].includes(r.status)).length;
  const reportPenalty = Math.min(20, pendingReports * 4);
  const positiveFeedback = feedbackStats?.total ? Math.round(((feedbackStats.yes || 0) + (feedbackStats.partially || 0) * 0.5) / feedbackStats.total * 100) : 50;
  const score = Math.max(0, Math.min(100, Math.round((physical * 0.35) + ((100 - Math.abs(financial - physical)) * 0.2) + (positiveFeedback * 0.2) + 25 - delayedPenalty - revisionPenalty - reportPenalty)));
  const flags = [];
  if (flow.paidAmount > flow.revisedBudget) flags.push('Over Budget');
  if (item.status === 'delayed') flags.push('Delayed');
  if (financial > physical + 30) flags.push('High Spending / Low Progress');
  if (flow.originalApprovedBudget && flow.revisedBudget > flow.originalApprovedBudget * 1.25) flags.push('Significant Budget Revision');
  if (pendingReports >= 3) flags.push('Citizen Reports Need Attention');
  return { score, flags, disclaimer: 'Civicदृष्टि indicator only. Not an official government rating.' };
}
function completionFor(row) {
  const manual = Number(row.completionOverride);
  if (Number.isFinite(manual)) return Math.max(0, Math.min(100, manual));
  return STATUS_PERCENT[row.status] ?? 25;
}
function emptyNode(level, name, parent = null) {
  return { id: `${level}:${parent || 'root'}:${name}`, level, name, parent, allocated: 0, spent: 0, completed: 0, remaining: 0, completion: 0, planned: 0, ongoing: 0, completedStage: 0, delayed: 0, projectCount: 0 };
}
function addToNode(node, row) {
  const flow = financialFlow(row);
  const allocated = Number(flow.revisedBudget ?? row.amount ?? row.budget ?? 0) || 0;
  const percent = completionFor(row);
  const spent = Number(row.spent || flow.paidAmount) > 0 ? Number(row.spent || flow.paidAmount) : allocated * (percent / 100);
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
    const items = await BudgetItem.find({}).sort({ fiscalYear: -1, amount: -1 }).limit(5000);
    const headers = ['Title', 'Department', 'Sector', 'Expenditure Type', 'Program Type', 'Original Approved', 'Revised', 'Released', 'Contracted', 'Paid', 'Remaining', 'Fiscal Year', 'Province', 'District', 'Municipality', 'Ward', 'Demo Label', 'Flagged'];
    const rows = items.map(i => [i.title, i.department, i.sector, i.expenditureType, i.programType, financialFlow(i).originalApprovedBudget, financialFlow(i).revisedBudget, financialFlow(i).releasedAmount, financialFlow(i).contractedAmount, financialFlow(i).paidAmount, financialFlow(i).remainingAmount, i.fiscalYear, i.province || deriveProvince(i.district), i.district, i.municipality, i.ward, i.demoLabel || (i.isDemo ? 'Demo Data' : ''), i.flagged ? 'yes' : 'no'].map(csvEscape).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="civicdrishti-public-budget-export.csv"');
    res.send([headers.map(csvEscape).join(','), ...rows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/meta/departments', protect, async (req, res) => {
  try {
    const departments = await BudgetItem.distinct('department', {});
    res.json({ departments: departments.filter(Boolean).sort() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/meta/fiscal-years', protect, async (req, res) => {
  try {
    const fiscalYears = await BudgetItem.distinct('fiscalYear', {});
    res.json({ fiscalYears: fiscalYears.filter(Boolean).sort().reverse() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lets an official search for a project to link a civic issue to, scoped to
// the same ward/municipality/district as the issue so the picker only shows
// relevant options rather than every project in the system.
router.get('/projects', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'ward_rep' ? {} : { user: req.user._id };
    if (req.user.role === 'ward_rep') {
      const a = req.user.wardRepresentativeApplication || {};
      filter.district = a.district || '__none__';
      filter.ward = String(a.ward || '__none__');
    }
    if (req.query.district) filter.district = req.query.district;
    if (req.query.municipality) filter.municipality = req.query.municipality;
    if (req.query.ward) filter.ward = String(req.query.ward);
    if (req.query.q) filter.name = { $regex: req.query.q, $options: 'i' };
    const projects = await Project.find(filter).sort({ name: 1 }).limit(100)
      .select('name sector status budget revisedBudget spent completionOverride province district municipality ward fiscalYear');
    res.json({ projects });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Full detail for the "Linked Project" card on an issue: approved budget,
// revised budget, reported expenditure, and physical progress.
router.get('/projects/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const approvedBudget = project.budget || 0;
    const spent = project.spent || 0;
    res.json({
      project: {
        _id: project._id, name: project.name, sector: project.sector, status: project.status,
        approvedBudget, revisedBudget: project.revisedBudget ?? null, expenditure: spent,
        remaining: Math.max(0, (project.revisedBudget ?? approvedBudget) - spent),
        physicalProgress: completionFor(project),
        province: project.province, district: project.district, municipality: project.municipality, ward: project.ward,
        fiscalYear: project.fiscalYear,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tracking', protect, async (req, res) => {
  try {
    await syncApprovedCreatedBudgets();
    const [items, projects] = await Promise.all([
      BudgetItem.find({}).select('amount originalApprovedBudget revisedBudget releasedAmount contractedAmount paidAmount spent status completionOverride province district municipality ward').lean(),
      Project.find({}).select('budget spent status completionOverride province district municipality ward').lean(),
    ]);
    res.json(buildTracking(items, projects));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/', protect, async (req, res) => {
  try {
    await syncApprovedCreatedBudgets();
    const filter = buildBudgetFilter(req.query);
    if (req.query.ward && req.query.ward !== 'all') filter.ward = { $in: wardVariants(req.query.ward) };

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(5000, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
    const [items, total] = await Promise.all([
      BudgetItem.find(filter).sort({ amount: -1 }).skip((page - 1) * limit).limit(limit).populate('document', 'title'),
      BudgetItem.countDocuments(filter),
    ]);
    res.json({ items: items.map(publicBudgetItem), pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/meta/public', protect, async (req, res) => {
  try {
    res.json({
      fiscalYears: ['2081/82', '2082/83', '2083/84', '2084/85'],
      expenditureTypes: ['Recurrent Expenditure', 'Capital Expenditure', 'Other'],
      sectors: ['Roads & Transportation', 'Drinking Water', 'Health', 'Education', 'Agriculture', 'Sanitation & Waste Management', 'Electricity / Street Lighting', 'Disaster Management', 'Tourism', 'Social Development', 'Environment', 'Public Buildings', 'Other'],
      programTypes: ['Infrastructure', 'Maintenance', 'Service Program', 'Social Program', 'Grant Program', 'Other'],
      fundingSources: ['Internal Revenue', 'Federal Government Grant', 'Provincial Government Grant', 'Revenue Sharing', 'Fiscal Equalization Grant', 'Conditional Grant', 'Special Grant', 'Matching Grant', 'Other lawful funding sources'],
      provinces: PROVINCES,
      demoNotice: 'Demo/sample rows are labelled and should not be presented as official government records.',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/meta/wards', protect, async (req, res) => {
  try {
    const filter = { ward: { $nin: [null, ''] } };
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

router.post('/changes', protect, requireRole('municipality_head', 'ward_rep'), async (req, res) => {
  try {
    let { title, department, sector, amount, originalApprovedBudget, revisedBudget, releasedAmount, contractedAmount, paidAmount, expenditureType, programType, fiscalYear, district, municipality, ward, reason } = req.body;
    if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; district = a.district || district; municipality = a.municipality || municipality; ward = a.ward || ward; }
    if (!title || !department || !sector || !fiscalYear) return res.status(422).json({ error: 'Title, department, sector, and fiscal year are required' });
    const amountNum = numericValue(amount, NaN);
    if (!Number.isFinite(amountNum) || amountNum < 0) return res.status(422).json({ error: 'Amount must be a valid positive number' });
    const proposedMoney = {
      amount: amountNum,
      originalApprovedBudget: numericValue(originalApprovedBudget, amountNum),
      revisedBudget: numericValue(revisedBudget, amountNum),
      releasedAmount: numericValue(releasedAmount, 0),
      contractedAmount: numericValue(contractedAmount, 0),
      paidAmount: numericValue(paidAmount, 0),
    };
    const province = req.body.province || deriveProvince(district);
    const wardUnitId = await resolveWardUnitId({ province, district, municipality, ward, createdBy: req.user._id });
    const doc = await Document.create({ user: req.user._id, title: `Proposed record - ${title}`, fileName: 'manual-entry', docType: 'budget', fiscalYear, district: district || '', municipality: municipality || '', totalBudget: amountNum, summary: 'Manual budget record proposed by official.' });
    const change = await ChangeRequest.create({ user: req.user._id, budgetItem: null, type: 'create', requestedBy: req.user._id, reason: reason || '', proposed: { title, department, sector, expenditureType: expenditureType || 'Capital Expenditure', programType: programType || 'Infrastructure', ...proposedMoney, fiscalYear, province, district: district || '', municipality: municipality || '', ward: ward || '', wardUnit: wardUnitId, document: doc._id } });
    await Activity.create({ user: req.user._id, type: 'change-request', message: `Proposed a new budget record: "${title}"` });
    res.status(201).json({ change });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/changes', protect, requireRole('municipality_head', 'ward_rep'), async (req, res) => {
  try {
    const budgetFilter = budgetManagementFilter(req.user, req.params.id);
    const budgetItem = await BudgetItem.findOne(budgetFilter);
    if (!budgetItem) return res.status(404).json({ error: 'Budget item not found' });
    const allowed = ['title', 'department', 'sector', 'amount', 'fiscalYear', 'province', 'district', 'municipality', 'ward', 'expenditureType', 'programType', 'originalApprovedBudget', 'revisedBudget', 'releasedAmount', 'contractedAmount', 'paidAmount', 'status', 'completionOverride', 'responsibleAuthority'];
    const proposed = {};
    allowed.forEach(key => { if (req.body[key] !== undefined && req.body[key] !== '') proposed[key] = req.body[key]; });
    if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; proposed.district = a.district || proposed.district; proposed.municipality = a.municipality || proposed.municipality; proposed.ward = a.ward || proposed.ward; }
    ['amount', 'originalApprovedBudget', 'revisedBudget', 'releasedAmount', 'contractedAmount', 'paidAmount'].forEach(key => {
      if (proposed[key] !== undefined) proposed[key] = Number(proposed[key]);
    });
    const invalidMoney = ['amount', 'originalApprovedBudget', 'revisedBudget', 'releasedAmount', 'contractedAmount', 'paidAmount'].find(key => proposed[key] !== undefined && (!Number.isFinite(proposed[key]) || proposed[key] < 0));
    if (invalidMoney) return res.status(422).json({ error: 'Budget amounts must be valid positive numbers' });
    if (proposed.province || proposed.district || proposed.municipality || proposed.ward) {
      proposed.province = proposed.province || budgetItem.province || deriveProvince(proposed.district || budgetItem.district);
      proposed.district = proposed.district || budgetItem.district || '';
      proposed.municipality = proposed.municipality || budgetItem.municipality || '';
      proposed.ward = proposed.ward || budgetItem.ward || '';
      proposed.wardUnit = await resolveWardUnitId({ province: proposed.province, district: proposed.district, municipality: proposed.municipality, ward: proposed.ward, createdBy: req.user._id });
    }
    if (Object.keys(proposed).length === 0) return res.status(422).json({ error: 'Add at least one proposed change' });
    const change = await ChangeRequest.create({ user: budgetItem.user, budgetItem: budgetItem._id, type: 'update', requestedBy: req.user._id, reason: req.body.reason || '', previous: pickPreviousBudgetValues(budgetItem, proposed), proposed });
    await Activity.create({ user: req.user._id, type: 'change-request', message: `Proposed a budget update for "${budgetItem.title}"` });
    res.status(201).json({ change });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/changes/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(422).json({ error: 'Status must be approved or rejected' });
    const change = await ChangeRequest.findById(req.params.id).populate('budgetItem').populate('requestedBy', 'name email');
    if (!change) return res.status(404).json({ error: 'Change request not found' });
    if (change.status !== 'pending') return res.status(409).json({ error: 'Change request already reviewed' });
    if (String(change.requestedBy?._id || change.requestedBy) === String(req.user._id)) return res.status(403).json({ error: 'You cannot approve your own budget change request' });
    change.status = status;
    change.reviewedBy = req.user._id;
    change.reviewedAt = new Date();
    if (status === 'rejected') change.rejectionReason = rejectionReason || change.rejectionReason || 'No rejection reason provided';
    await change.save();

    if (change.requestedBy?.email) budgetDecisionEmail(change.requestedBy, change, status);

    if (status === 'approved') {
      if (change.type === 'create' || !change.budgetItem) {
        const p = change.proposed || {};
        const approvedFlow = {
          amount: numericValue(p.amount, 0),
          originalApprovedBudget: numericValue(p.originalApprovedBudget, numericValue(p.amount, 0)),
          revisedBudget: numericValue(p.revisedBudget, numericValue(p.amount, 0)),
          releasedAmount: numericValue(p.releasedAmount, 0),
          disbursedAmount: numericValue(p.disbursedAmount || p.releasedAmount, 0),
          contractedAmount: numericValue(p.contractedAmount, 0),
          paidAmount: numericValue(p.paidAmount, 0),
          spent: numericValue(p.paidAmount, 0),
        };
        const created = await BudgetItem.create({ user: change.user, document: p.document, title: p.title, department: p.department, sector: p.sector, expenditureType: p.expenditureType, programType: p.programType, ...approvedFlow, fiscalYear: p.fiscalYear, province: p.province || deriveProvince(p.district), district: p.district || '', municipality: p.municipality || '', ward: p.ward || '', wardUnit: p.wardUnit || null, page: 1, confidence: 1, isDemo: false, revisionHistory: [{ previous: {}, next: p, reason: change.reason || '', requestedBy: change.requestedBy, reviewedBy: req.user._id, status: 'approved', supportingDocument: p.document || null, reviewedAt: new Date() }] });
        change.budgetItem = created._id;
        await change.save();
        await Activity.create({ user: change.user, type: 'approval', message: `Approved new budget record "${p.title}"` });
        logAudit(req, { action: 'APPROVE_CHANGE', targetType: 'BudgetItem', targetId: created._id, targetLabel: p.title, previousValue: null, newValue: p, province: p.province || '', municipality: p.municipality || '', ward: p.ward || '' });
      } else {
        const approvedUpdate = { ...(change.proposed || {}) };
        ['amount', 'originalApprovedBudget', 'revisedBudget', 'releasedAmount', 'disbursedAmount', 'contractedAmount', 'paidAmount'].forEach(key => {
          if (approvedUpdate[key] !== undefined) approvedUpdate[key] = numericValue(approvedUpdate[key], 0);
        });
        if (approvedUpdate.paidAmount !== undefined) approvedUpdate.spent = approvedUpdate.paidAmount;
        if (!approvedUpdate.province && approvedUpdate.district) approvedUpdate.province = deriveProvince(approvedUpdate.district);
        await BudgetItem.findByIdAndUpdate(change.budgetItem._id, { $set: approvedUpdate, $push: { revisionHistory: { previous: change.previous || {}, next: approvedUpdate, reason: change.reason || '', requestedBy: change.requestedBy, reviewedBy: req.user._id, status: 'approved', supportingDocument: change.proposed?.document || null, reviewedAt: new Date() } } }, { new: true });
        await Activity.create({ user: change.user, type: 'approval', message: `Approved budget update for "${change.budgetItem.title}"` });
        logAudit(req, { action: 'EDIT_BUDGET', targetType: 'BudgetItem', targetId: change.budgetItem._id, targetLabel: change.budgetItem.title, previousValue: change.previous || {}, newValue: change.proposed || {}, province: change.budgetItem.province || '', municipality: change.budgetItem.municipality || '', ward: change.budgetItem.ward || '' });
      }
    } else {
      await Activity.create({ user: change.user, type: 'approval', message: `Rejected budget change request` });
      logAudit(req, { action: 'REJECT_CHANGE', targetType: 'ChangeRequest', targetId: change._id, targetLabel: change.budgetItem?.title || change.proposed?.title || '', previousValue: change.proposed || {}, newValue: { rejectionReason: change.rejectionReason }, province: change.budgetItem?.province || change.proposed?.province || '', municipality: change.budgetItem?.municipality || change.proposed?.municipality || '', ward: change.budgetItem?.ward || change.proposed?.ward || '' });
    }
    res.json({ change });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/detail', protect, async (req, res) => {
  try {
    const item = await BudgetItem.findById(req.params.id).populate('document', 'title fileName fiscalYear').lean();
    if (!item) return res.status(404).json({ error: 'Budget item not found' });
    const [feedbackRows, relatedReports] = await Promise.all([
      BudgetFeedback.find({ budgetItem: item._id, moderationStatus: { $in: ['approved', 'pending'] } }).sort({ createdAt: -1 }).limit(50).populate('user', 'name role civicLocation').lean(),
      IncidentReport.find({
        'location.district': item.district || '__none__',
        'location.municipality': item.municipality || '__none__',
        'location.ward': { $in: wardVariants(item.ward) },
      }).sort({ createdAt: -1 }).limit(25).select('title category status severity location createdAt').lean(),
    ]);
    const feedbackStats = feedbackRows.reduce((acc, row) => {
      acc.total += 1;
      acc[row.verdict] = (acc[row.verdict] || 0) + 1;
      if (row.isDemo) acc.demo += 1;
      return acc;
    }, { total: 0, yes: 0, partially: 0, no: 0, demo: 0 });
    const resolved = relatedReports.filter(r => r.status === 'completed').length;
    const pending = relatedReports.filter(r => !['completed', 'rejected', 'duplicate'].includes(r.status)).length;
    res.json({
      item: publicBudgetItem(item),
      revisionHistory: item.revisionHistory || [],
      documents: item.evidenceDocuments || [],
      progressPhotos: item.progressPhotos || [],
      relatedReports,
      relatedReportStats: { total: relatedReports.length, resolved, pending },
      feedback: feedbackRows.map(publicFeedback),
      feedbackStats,
      indicator: accountabilityFor(item, feedbackStats, relatedReports),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/feedback/:feedbackId/moderation', protect, requireRole('admin'), async (req, res) => {
  try {
    const status = String(req.body?.status || '').toLowerCase();
    if (!['approved', 'rejected'].includes(status)) return res.status(422).json({ error: 'Moderation status must be approved or rejected' });
    const feedback = await BudgetFeedback.findByIdAndUpdate(req.params.feedbackId, { moderationStatus: status }, { new: true });
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });
    await Activity.create({ user: req.user._id, type: 'budget-feedback-moderation', message: (status === 'approved' ? 'Approved' : 'Rejected') + ' community feedback on a public budget record' });
    res.json({ feedback });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Never project user.email / user.phone / user.civicLocation.address here —
// only the display name, role, and registered province/district/municipality/ward
// are safe to surface publicly alongside community feedback.
function publicFeedbackUser(user) {
  if (!user) return null;
  const loc = user.civicLocation || {};
  return { name: user.name || '', role: user.role || '', ward: loc.ward || '', province: loc.province || '', district: loc.district || '', municipality: loc.municipality || '' };
}
function publicFeedback(r) {
  return {
    _id: r._id,
    verdict: r.verdict,
    comment: r.comment,
    photo: r.photo,
    moderationStatus: r.moderationStatus,
    isDemo: r.isDemo,
    createdAt: r.createdAt,
    user: publicFeedbackUser(r.user),
  };
}

// Feedback across every budget record nationwide, for the "Community
// Feedback" board on the Public Budget page. Joins each feedback entry with
// its budget item's project title / location / sector / fiscal year so the
// board can filter by Province -> District -> Municipality -> Ward, Project,
// Sector, Fiscal Year, and Feedback Type in one place. Location shown for
// each entry is the citizen's own registered address (never the project's
// location as a stand-in), matching how feedback is filed against the
// citizen's registered ward.
router.get('/feedback/all', protect, async (req, res) => {
  try {
    const rows = await BudgetFeedback.find({ moderationStatus: { $in: ['approved', 'pending'] } })
      .sort({ createdAt: -1 })
      .limit(2000)
      .populate('user', 'name role civicLocation')
      .populate('budgetItem', 'title sector programType fiscalYear province district municipality ward')
      .lean();

    // Location shown/filterable on the national board comes from the
    // project the feedback was actually left on (always set), falling back
    // to the citizen's own registered ward only where the project itself
    // has no location on file. A citizen's profile location is frequently
    // left blank, so anchoring solely to that would hide real feedback from
    // the exact Province -> District -> Municipality -> Ward search it was
    // filed under.
    const feedback = rows
      .filter(r => r.budgetItem)
      .map(r => ({
        ...publicFeedback(r),
        project: r.budgetItem.title || '',
        sector: r.budgetItem.sector || r.budgetItem.programType || '',
        fiscalYear: r.budgetItem.fiscalYear || '',
        province: r.budgetItem.province || r.user?.civicLocation?.province || '',
        district: r.budgetItem.district || r.user?.civicLocation?.district || '',
        municipality: r.budgetItem.municipality || r.user?.civicLocation?.municipality || '',
        ward: r.budgetItem.ward || r.user?.civicLocation?.ward || '',
      }));

    res.json({ feedback, total: feedback.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/feedback', protect, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const filter = { budgetItem: req.params.id, moderationStatus: { $in: ['approved', 'pending'] } };

    const [rows, total, allForStats] = await Promise.all([
      BudgetFeedback.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'name role civicLocation'),
      BudgetFeedback.countDocuments(filter),
      BudgetFeedback.find(filter).select('verdict isDemo').lean(),
    ]);
    const stats = allForStats.reduce((acc, row) => { acc.total += 1; acc[row.verdict] = (acc[row.verdict] || 0) + 1; if (row.isDemo) acc.demo += 1; return acc; }, { total: 0, yes: 0, partially: 0, no: 0, demo: 0 });

    res.json({ stats, feedback: rows.map(publicFeedback), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/feedback', protect, async (req, res) => {
  try {
    const item = await BudgetItem.findById(req.params.id).select('_id');
    if (!item) return res.status(404).json({ error: 'Budget item not found' });
    const verdict = String(req.body?.verdict || '').toLowerCase();
    if (!['yes', 'partially', 'no'].includes(verdict)) return res.status(422).json({ error: 'Choose Yes, Partially, or No' });
    // Ward is always taken from the citizen's own verified profile — the
    // request body cannot override it, so there is no way to file feedback
    // "as" a different ward than the one the citizen registered with.
    const feedback = await BudgetFeedback.findOneAndUpdate(
      { budgetItem: item._id, user: req.user._id },
      { budgetItem: item._id, user: req.user._id, verdict, comment: req.body.comment || '', photo: req.body.photo || '', photoName: req.body.photoName || '', moderationStatus: 'pending', isDemo: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await Activity.create({ user: req.user._id, type: 'budget-feedback', message: `Submitted community feedback on a public budget record` });
    res.status(201).json({ feedback });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/related-reports', protect, async (req, res) => {
  try {
    const item = await BudgetItem.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: 'Budget item not found' });
    const reports = await IncidentReport.find({
      'location.district': item.district || '__none__',
      'location.municipality': item.municipality || '__none__',
      'location.ward': { $in: wardVariants(item.ward) },
    }).sort({ createdAt: -1 }).limit(25).select('title category status severity location createdAt');
    const resolved = reports.filter(r => r.status === 'completed').length;
    const pending = reports.filter(r => !['completed', 'rejected', 'duplicate'].includes(r.status)).length;
    res.json({ reports, stats: { total: reports.length, resolved, pending } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/accountability', protect, async (req, res) => {
  try {
    const item = await BudgetItem.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: 'Budget item not found' });
    const feedbackRows = await BudgetFeedback.find({ budgetItem: item._id, moderationStatus: { $in: ['approved', 'pending'] } }).lean();
    const feedbackStats = feedbackRows.reduce((acc, row) => { acc.total += 1; acc[row.verdict] = (acc[row.verdict] || 0) + 1; return acc; }, { total: 0, yes: 0, partially: 0, no: 0 });
    const relatedReports = await IncidentReport.find({ 'location.district': item.district || '__none__', 'location.municipality': item.municipality || '__none__', 'location.ward': { $in: wardVariants(item.ward) } }).select('status').lean();
    res.json({ indicator: accountabilityFor(item, feedbackStats, relatedReports), feedbackStats, relatedReportCount: relatedReports.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/:id/flag', protect, async (req, res) => {
  try {
    const reason = (req.body?.reason || '').trim();
    if (!reason) return res.status(422).json({ error: 'Please describe why this entry looks suspicious' });
    const item = await BudgetItem.findOneAndUpdate({ _id: req.params.id }, { flagged: true, flagReason: reason, flaggedBy: req.user._id, flaggedAt: new Date() }, { new: true });
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