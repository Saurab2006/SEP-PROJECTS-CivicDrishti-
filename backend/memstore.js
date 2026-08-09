const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { fallbackSuggestAuthoritiesForArea } = require('./utils/authorityAI');
const { sendEmailQuietly } = require('./utils/email');
const { code, hashCode, expires, validHash, welcomeEmail, otpEmail, resetEmail, accountDecisionEmail, budgetDecisionEmail } = require('./utils/authEmails');

function id() { return crypto.randomBytes(12).toString('hex'); }
function now() { return new Date().toISOString(); }
function normalizePhone(raw) { return String(raw || '').replace(/[^\d]/g, ''); }

// ---- stores ----
const users = [];
const documents = [];
const budgetItems = [];
const projects = [];
const activities = [];
const changeRequests = [];
const reports = [];
const notifications = [];
const authorities = [];
const reviews = [];
const notices = [];
const wardUnits = [];

// ---- civic reporting reference data ----
const REPORT_CATEGORIES = [
  { value: 'flood', label: 'Flood / Waterlogging', baseDays: 3 },
  { value: 'road-damage', label: 'Road Damage / Pothole', baseDays: 7 },
  { value: 'tunnel-blockage', label: 'Tunnel Blockage / Overflow', baseDays: 2 },
  { value: 'bridge-damage', label: 'Bridge Damage', baseDays: 10 },
  { value: 'landslide', label: 'Landslide', baseDays: 5 },
  { value: 'drainage', label: 'Drainage / Sewerage', baseDays: 4 },
  { value: 'electrical', label: 'Electrical Hazard', baseDays: 1 },
  { value: 'water-supply', label: 'Water Supply Disruption', baseDays: 3 },
  { value: 'other', label: 'Other', baseDays: 5 },
];
const REPORT_AUTHORITIES = [
  'Department of Roads',
  'Municipal Ward Office',
  'Disaster Management Authority',
  'Water Supply & Sewerage Corporation',
  'Urban Development Dept',
  'Electricity Authority',
];

// ---- seed data ----
const SECTORS = ['Roads & Transport', 'Health', 'Education', 'Drinking Water', 'Agriculture', 'Energy', 'Urban Development', 'Disaster Management'];
const DEPTS = ['Municipal Executive', 'Department of Roads', 'Ministry of Health', 'Ministry of Education', 'Water Supply Dept', 'Agriculture Dept', 'Energy Dept', 'Urban Development Dept'];
const STATUSES = ['planned', 'ongoing', 'completed', 'delayed'];
const DOCS_SPEC = [
  { title: 'Kathmandu Metropolitan City â€” Annual Budget', docType: 'budget', fiscalYear: '2081/82', district: 'Kathmandu', municipality: 'Kathmandu Metro' },
  { title: 'Pokhara Metropolitan City â€” Annual Budget', docType: 'budget', fiscalYear: '2080/81', district: 'Kaski', municipality: 'Pokhara Metro' },
  { title: 'Office of Auditor General â€” Audit Report', docType: 'audit', fiscalYear: '2080/81', district: 'Chitwan', municipality: 'Bharatpur Metro' },
  { title: 'Butwal Sub-Metro â€” Development Plan', docType: 'development-plan', fiscalYear: '2081/82', district: 'Rupandehi', municipality: 'Butwal Sub-Metro' },
  { title: 'Dept of Roads â€” Procurement Notice', docType: 'procurement', fiscalYear: '2081/82', district: 'Sunsari', municipality: 'Dharan Sub-Metro' },
  { title: 'Dhangadhi Sub-Metro â€” Annual Report', docType: 'annual-report', fiscalYear: '2079/80', district: 'Kailali', municipality: 'Dhangadhi Sub-Metro' },
];
const PROJ_NAMES = ['Ring Road Upgrade', 'Health Post Construction', 'Seti River Bridge', 'Water Supply Network', 'Kalika School Block', 'Solar Street Lights', 'Sanitary Landfill', 'Bus Park Hub', 'Flood Embankment', 'Data Centre', 'Agriculture Centre', 'Heritage Walkway'];
const WARD_COUNT = 32; // Nepal's local units vary in ward count; used for demo seeding only
const PREFIXES = ['Construction of', 'Upgrading of', 'Rehabilitation of', 'Expansion of'];
const SUBJECTS = ['Ward Office', 'Road Section', 'Health Post', 'School Block', 'Water Tank', 'Bridge', 'Street Lights', 'Market Centre'];
const PROVINCE_DISTRICTS = [
  { name: 'Koshi Province', districts: ['Sunsari','Morang','Jhapa','Ilam','Dhankuta'] },
  { name: 'Madhesh Province', districts: ['Dhanusha','Parsa','Bara','Saptari'] },
  { name: 'Bagmati Province', districts: ['Kathmandu','Lalitpur','Bhaktapur','Chitwan','Makwanpur'] },
  { name: 'Gandaki Province', districts: ['Kaski','Tanahun','Gorkha','Baglung'] },
  { name: 'Lumbini Province', districts: ['Rupandehi','Dang','Banke','Bardiya'] },
  { name: 'Karnali Province', districts: ['Surkhet','Jumla','Dailekh','Kalikot'] },
  { name: 'Sudurpashchim Province', districts: ['Kailali','Kanchanpur','Doti','Dadeldhura'] },
];
const DISTRICT_PROVINCE = PROVINCE_DISTRICTS.reduce((acc, p) => { p.districts.forEach(d => { acc[d.toLowerCase()] = p.name; }); return acc; }, {});
const STAGE_PERCENT = { planned: 10, ongoing: 55, completed: 100, delayed: 35 };
function provinceFor(district) { return DISTRICT_PROVINCE[String(district || '').toLowerCase()] || 'Unmapped Province'; }
function progressFor(row) {
  const manual = Number(row.completionOverride);
  if (Number.isFinite(manual)) return Math.max(0, Math.min(100, manual));
  return STAGE_PERCENT[row.status] ?? 25;
}
function makeTrackingNode(level, name, parent = null) {
  return { id: `${level}:${parent || 'root'}:${name}`, level, name, parent, allocated: 0, spent: 0, completed: 0, remaining: 0, completion: 0, planned: 0, ongoing: 0, completedStage: 0, delayed: 0, projectCount: 0 };
}
function addTracking(node, row) {
  const allocated = Number(row.amount ?? row.budget ?? 0) || 0;
  const percent = progressFor(row);
  const spent = Number(row.spent) > 0 ? Number(row.spent) : allocated * (percent / 100);
  node.allocated += allocated;
  node.spent += spent;
  node.completed += allocated * (percent / 100);
  node.remaining += allocated * (1 - percent / 100);
  node.projectCount += 1;
  if (row.status === 'completed') node.completedStage += 1;
  else if (row.status === 'ongoing') node.ongoing += 1;
  else if (row.status === 'delayed') node.delayed += 1;
  else node.planned += 1;
}
function finalizeTracking(node) {
  node.allocated = Math.round(node.allocated);
  node.spent = Math.round(node.spent);
  node.completed = Math.round(node.completed);
  node.remaining = Math.max(0, Math.round(node.remaining));
  node.completion = node.allocated ? Math.round((node.completed / node.allocated) * 100) : 0;
  return node;
}
function buildBudgetTracking(budgetRows, projectRows) {
  const maps = { province: new Map(), district: new Map(), municipality: new Map(), ward: new Map() };
  const ensure = (level, name, parent) => {
    const key = `${parent || 'root'}|${name}`;
    if (!maps[level].has(key)) maps[level].set(key, makeTrackingNode(level, name, parent));
    return maps[level].get(key);
  };
  PROVINCE_DISTRICTS.forEach(p => ensure('province', p.name, null));
  [...budgetRows, ...projectRows].forEach(raw => {
    const row = { ...raw, amount: raw.amount ?? raw.budget ?? 0, province: raw.province || provinceFor(raw.district), district: raw.district || 'Unspecified District', municipality: raw.municipality || 'Municipality not specified', ward: raw.ward ? `Ward ${raw.ward}` : 'Ward not specified', status: raw.status || 'planned' };
    [ensure('province', row.province, null), ensure('district', row.district, row.province), ensure('municipality', row.municipality, row.district), ensure('ward', row.ward, row.municipality)].forEach(node => addTracking(node, row));
  });
  const list = level => Array.from(maps[level].values()).map(finalizeTracking).sort((a, b) => b.allocated - a.allocated || a.name.localeCompare(b.name));
  return { provinces: list('province'), districts: list('district'), municipalities: list('municipality'), wards: list('ward'), generatedAt: now() };
}

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

// ---- civic reporting helpers ----

// Lightweight rule-based "AI" estimator: takes the category's typical repair
// window and adjusts it by how urgent the citizen marked the problem.
// (Stands in for a model call â€” swap for a real completion if ever wired up.)
function estimateDays(category, severity) {
  const spec = REPORT_CATEGORIES.find(c => c.value === category) || REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1];
  const factor = { critical: 0.5, high: 0.75, medium: 1, low: 1.3 }[severity] ?? 1;
  return Math.max(1, Math.round(spec.baseDays * factor));
}

function addDays(days) { const d = new Date(); d.setDate(d.getDate() + Number(days || 0)); return d.toISOString(); }

function normalizeText(s) { return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean); }

// Two reports are treated as "the same problem" when they share a category,
// sit in the same district, and their location text overlaps meaningfully â€”
// this is what lets many citizen reports of one broken tunnel collapse into
// a single work item instead of flooding the queue with duplicates.
function textOverlap(a, b) {
  const wa = new Set(normalizeText(a));
  const wb = new Set(normalizeText(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach(w => { if (wb.has(w)) shared++; });
  return shared / Math.min(wa.size, wb.size);
}

function findDuplicateCandidate(category, location) {
  const cutoff = Date.now() - 21 * 24 * 60 * 60 * 1000; // look back 3 weeks
  return reports.find(r =>
    !r.duplicateOf &&
    r.category === category &&
    !['completed', 'rejected'].includes(r.status) &&
    (r.location.district || '').toLowerCase() === (location.district || '').toLowerCase() &&
    new Date(r.createdAt).getTime() > cutoff &&
    textOverlap(r.location.address, location.address) >= 0.4
  ) || null;
}

// Base authorities every fresh install ships with, so "Assign" always has
// options even before any admin or AI suggestion has run.
(function seedBaseAuthorities() {
  REPORT_AUTHORITIES.forEach(name => {
    authorities.push({
      _id: id(), name, department: name, district: '', categories: [],
      contactEmail: '', contactPhone: '', source: 'seed', createdBy: null,
      ratingAvg: 0, ratingCount: 0, createdAt: now(), updatedAt: now(),
    });
  });
})();

function seedForUser(userId) {
  if (documents.length > 0) return 0;

  const r = rng(Date.now());
  let created = 0;

  for (const spec of DOCS_SPEC) {
    const totalBudget = (1 + r() * 8) * 1e9;
    const docId = id();
    documents.push({
      _id: docId, user: userId, ...spec,
      fileName: spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf',
      fileSize: 800000 + Math.floor(r() * 2000000),
      organization: spec.municipality, status: 'completed', pageCount: 8, totalBudget,
      summary: `This ${spec.docType} for FY ${spec.fiscalYear} from ${spec.municipality} contains extracted budget lines.`,
      highlights: [`Total: Rs ${(totalBudget / 1e9).toFixed(2)} Arab`, `${6 + Math.floor(r() * 12)} departments`],
      keywords: ['budget', spec.district.toLowerCase()],
      createdAt: now(), updatedAt: now(),
    });

    for (let i = 0; i < 14 + Math.floor(r() * 14); i++) {
      budgetItems.push({
        _id: id(), user: userId, document: docId,
        title: `${pick(r, PREFIXES)} ${pick(r, SUBJECTS)} â€” ${spec.municipality}`,
        department: pick(r, DEPTS), sector: pick(r, SECTORS),
        amount: (0.2 + r() * 12) * 1e7, fiscalYear: spec.fiscalYear,
        province: provinceFor(spec.district), district: spec.district, municipality: spec.municipality, ward: String(1 + Math.floor(r() * WARD_COUNT)),
        status: pick(r, STATUSES), completionOverride: r() > 0.78 ? Math.floor(15 + r() * 80) : null,
        page: 1 + Math.floor(r() * 8),
        confidence: 0.82 + r() * 0.16,
        flagged: false, flagReason: '', flaggedBy: null, flaggedAt: null,
      });
    }

    for (let i = 0; i < 4 + Math.floor(r() * 8); i++) {
      projects.push({
        _id: id(), user: userId, document: docId,
        name: pick(r, PROJ_NAMES), sector: pick(r, SECTORS),
        status: pick(r, STATUSES), budget: (0.5 + r() * 18) * 1e7,
        spent: 0, completionOverride: r() > 0.7 ? Math.floor(10 + r() * 90) : null,
        province: provinceFor(spec.district), district: spec.district, municipality: spec.municipality, ward: String(1 + Math.floor(r() * WARD_COUNT)), fiscalYear: spec.fiscalYear,
      });
    }
    created++;
  }

  activities.push({ _id: id(), user: userId, type: 'account', message: 'Workspace seeded with 6 sample documents', createdAt: now() });
  return created;
}

// ---- API ----
const store = {
  // Auth
  async findUserByEmail(email) { return users.find(u => u.email === email) || null; },
  async createUser({ name, email, password, role, organization, citizenshipDoc, citizenshipDocName, province, district, municipality, ward, applicationDetails }) {
    const hashed = await bcrypt.hash(password, 12);
    const jobTitle = role === 'admin' ? 'Administrator' : role === 'analyst' ? 'Analyst' : role === 'ward_rep' ? 'Ward Representative' : 'Researcher';
    const u = {
      _id: id(), name, email: email.toLowerCase().trim(), password: hashed, role,
      organization: organization || 'Independent', jobTitle, avatarHue: Math.floor(Math.random() * 360),
      status: role === 'ward_rep' ? 'suspended' : 'active', createdAt: now(),
      citizenshipDoc: ['researcher', 'ward_rep'].includes(role) ? (citizenshipDoc || '') : '',
      citizenshipDocName: ['researcher', 'ward_rep'].includes(role) ? (citizenshipDocName || '') : '',
      verificationStatus: ['researcher', 'ward_rep'].includes(role) ? 'pending' : 'n/a',
      emailVerified: false, emailOtpHash: '', emailOtpExpires: null, resetPasswordHash: '', resetPasswordExpires: null,
      wardRepresentativeApplication: role === 'ward_rep' ? { requested: true, status: 'pending', province: province || '', district: district || '', municipality: municipality || '', ward: ward || '', details: applicationDetails || '', document: citizenshipDoc || '', documentName: citizenshipDocName || '', reviewedAt: null } : { requested: false, status: 'none' },
    };
    users.push(u);
    return u;
  },
  async comparePassword(user, candidate) { return bcrypt.compare(candidate, user.password); },
  async setPassword(user, password) {
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordHash = '';
    user.resetPasswordExpires = null;
    user.updatedAt = now();
    return user;
  },
  setEmailOtp(user, otp = code()) {
    user.emailOtpHash = hashCode(otp);
    user.emailOtpExpires = expires(15).toISOString();
    return otp;
  },
  verifyEmailOtp(user, otp) {
    if (!validHash(user.emailOtpHash, otp, user.emailOtpExpires)) return false;
    user.emailVerified = true;
    user.emailOtpHash = '';
    user.emailOtpExpires = null;
    user.updatedAt = now();
    return true;
  },
  setResetOtp(user, otp = code()) {
    user.resetPasswordHash = hashCode(otp);
    user.resetPasswordExpires = expires(15).toISOString();
    return otp;
  },
  userCount() { return users.length; },
  toPublic(u) {
    const { password, citizenshipDoc, ...rest } = u;
    return { ...rest, hasCitizenshipDoc: !!citizenshipDoc };
  },
  getCitizenshipDoc(userId) {
    const u = users.find(u => u._id === userId);
    if (!u) return null;
    return { citizenshipDoc: u.citizenshipDoc || '', citizenshipDocName: u.citizenshipDocName || '' };
  },

  // Seed
  seedForUser,

  // Analytics
  getDocuments() { return documents; },
  getBudgets() { return budgetItems; },
  getProjects() { return projects; },
  getActivities() { return activities.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5); },
  getBudgetTracking() { return buildBudgetTracking(budgetItems, projects); },
  getBudgetTrackingForUser(user) {
    if (user.role !== 'ward_rep') return buildBudgetTracking(budgetItems, projects);
    const a = user.wardRepresentativeApplication || {};
    const match = row => row.district === a.district && String(row.ward || '') === String(a.ward || '');
    return buildBudgetTracking(budgetItems.filter(match), projects.filter(match));
  },
  filterBudgets({ q, sector, fiscalYear, district, ward, flagged, limit = 100 }) {
    let result = budgetItems.slice();
    if (q) { const re = new RegExp(q, 'i'); result = result.filter(b => re.test(b.title) || re.test(b.district || '')); }
    if (sector && sector !== 'all') result = result.filter(b => b.sector === sector);
    if (fiscalYear && fiscalYear !== 'all') result = result.filter(b => b.fiscalYear === fiscalYear);
    if (district) { const re = new RegExp(district, 'i'); result = result.filter(b => re.test(b.district || '')); }
    if (ward) result = result.filter(b => (b.ward || '') === String(ward));
    if (flagged === 'true' || flagged === true) result = result.filter(b => b.flagged);
    return result.sort((a, b) => b.amount - a.amount).slice(0, limit).map(b => {
      const doc = documents.find(d => d._id === b.document);
      return { ...b, documentId: doc?._id, documentTitle: doc?.title };
    });
  },

  // ---- Corruption / misuse flagging channel (separate from fake-issue flagging) ----
  // A lightweight channel any signed-in user can use to flag a suspicious
  // budget line (inflated amount, implausible department/sector pairing,
  // duplicate entry, etc.) for admin review â€” independent of the analyst
  // change-request workflow, which is for correcting data, not reporting misuse.
  flagBudgetItem(itemId, userId, reason) {
    const item = budgetItems.find(b => b._id === itemId);
    if (!item) return { error: 'Budget item not found' };
    if (!reason || !reason.trim()) return { error: 'Please describe why this entry looks suspicious' };
    item.flagged = true;
    item.flagReason = reason.trim();
    item.flaggedBy = userId;
    item.flaggedAt = now();
    activities.push({ _id: id(), user: userId, type: 'flag', message: `Flagged "${item.title}" as potentially suspicious`, createdAt: now() });
    store.notifyRoles(['admin'], { type: 'budget-flagged', title: 'Budget entry flagged', message: `"${item.title}" was flagged for review: ${reason.trim()}`, link: '/budget' });
    return { item };
  },
  unflagBudgetItem(itemId, actingUser) {
    if (actingUser.role !== 'admin') return { error: 'Only admins can clear a flag' };
    const item = budgetItems.find(b => b._id === itemId);
    if (!item) return { error: 'Budget item not found' };
    item.flagged = false; item.flagReason = ''; item.flaggedBy = null; item.flaggedAt = null;
    return { item };
  },

  createBudgetChange(budgetItemId, requestedBy, proposed, reason) {
    const item = budgetItems.find(b => b._id === budgetItemId);
    if (!item) return null;
    const change = {
      _id: id(),
      type: 'edit',
      budgetItem: item._id,
      requestedBy,
      status: 'pending',
      reason: reason || '',
      proposed,
      createdAt: now(),
      updatedAt: now(),
    };
    changeRequests.push(change);
    activities.push({ _id: id(), user: requestedBy, type: 'change-request', message: `Proposed a budget update for "${item.title}"`, createdAt: now() });
    return change;
  },
  createBudgetChangeNew(requestedBy, proposed, reason) {
    const change = {
      _id: id(),
      type: 'create',
      budgetItem: null,
      requestedBy,
      status: 'pending',
      reason: reason || '',
      proposed,
      createdAt: now(),
      updatedAt: now(),
    };
    changeRequests.push(change);
    activities.push({ _id: id(), user: requestedBy, type: 'change-request', message: `Proposed a new budget record: "${proposed.title}"`, createdAt: now() });
    return change;
  },
  getBudgetChanges(user, { status = 'all', limit = 100 } = {}) {
    let result = user.role === 'admin'
      ? changeRequests
      : changeRequests.filter(c => c.requestedBy === user._id);
    if (status !== 'all') result = result.filter(c => c.status === status);
    return result
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, Number(limit) || 100)
      .map(c => ({
        ...c,
        budgetItem: budgetItems.find(b => b._id === c.budgetItem) || null,
        requestedBy: store.toPublic(users.find(u => u._id === c.requestedBy) || {}),
        reviewedBy: c.reviewedBy ? store.toPublic(users.find(u => u._id === c.reviewedBy) || {}) : null,
      }));
  },
  reviewBudgetChange(changeId, reviewerId, status) {
    const change = changeRequests.find(c => c._id === changeId);
    if (!change || change.status !== 'pending') return null;

    if (change.type === 'create') {
      change.status = status;
      change.reviewedBy = reviewerId;
      change.reviewedAt = now();
      change.updatedAt = now();
      if (status === 'approved') {
        const p = change.proposed;
        const docId = id();
        documents.push({
          _id: docId, user: change.requestedBy, title: `${p.title} â€” Manually Added Record`,
          docType: 'manual-entry', fiscalYear: p.fiscalYear, district: p.district || '',
          fileName: null, fileSize: 0, organization: p.district || 'Manual Entry', status: 'completed',
          pageCount: 0, totalBudget: p.amount,
          summary: `Manually added record for ${p.district || 'an unspecified district'}, FY ${p.fiscalYear}.`,
          highlights: [], keywords: ['manual', (p.district || '').toLowerCase()],
          createdAt: now(), updatedAt: now(),
        });
        const newItem = {
          _id: id(), user: change.requestedBy, document: docId,
          title: p.title, department: p.department, sector: p.sector,
          amount: p.amount, fiscalYear: p.fiscalYear, district: p.district || '', ward: p.ward || '',
          page: 1, confidence: 1,
          flagged: false, flagReason: '', flaggedBy: null, flaggedAt: null,
        };
        budgetItems.push(newItem);
        change.budgetItem = newItem._id;
      }
      activities.push({ _id: id(), user: change.requestedBy, type: 'approval', message: `${status === 'approved' ? 'Approved a new budget record' : 'Rejected a new budget record proposal'}: "${change.proposed.title}"`, createdAt: now() });
      const requester = users.find(u => u._id === change.requestedBy);
      if (requester?.email) budgetDecisionEmail(requester, change, status);
      return change;
    }

    const item = budgetItems.find(b => b._id === change.budgetItem);
    if (!item) return null;
    change.status = status;
    change.reviewedBy = reviewerId;
    change.reviewedAt = now();
    change.updatedAt = now();
    if (status === 'approved') Object.assign(item, change.proposed, { updatedAt: now() });
    activities.push({ _id: id(), user: change.requestedBy, type: 'approval', message: `${status === 'approved' ? 'Approved' : 'Rejected'} budget update for "${item.title}"`, createdAt: now() });
    const requester = users.find(u => u._id === change.requestedBy);
    if (requester?.email) budgetDecisionEmail(requester, { ...change, budgetItem: item }, status);
    return change;
  },

  // Users (admin)
  getAllUsers() {
    return users.map(u => {
      const docCount = documents.filter(d => d.user === u._id).length;
      return { ...store.toPublic(u), documentCount: docCount };
    });
  },
  updateUser(userId, updates) {
    const u = users.find(u => u._id === userId);
    if (!u) return null;
    const beforeStatus = u.status;
    const beforeVerification = u.verificationStatus;
    if (updates.wardRepresentativeStatus && ['approved', 'rejected'].includes(updates.wardRepresentativeStatus)) {
      u.wardRepresentativeApplication = u.wardRepresentativeApplication || { requested: true };
      u.wardRepresentativeApplication.status = updates.wardRepresentativeStatus;
      u.wardRepresentativeApplication.reviewedAt = now();
      if (updates.wardRepresentativeStatus === 'approved') { u.role = 'ward_rep'; u.status = 'active'; u.verificationStatus = 'verified'; const a = u.wardRepresentativeApplication || {}; if (a.province && a.district && a.ward) store.upsertWardUnit(userId, { province: a.province, district: a.district, municipality: a.municipality || '', ward: a.ward, representative: u._id }); }
      else { u.status = 'suspended'; u.verificationStatus = 'rejected'; }
    }
    if (updates.role && ['admin', 'analyst', 'researcher', 'ward_rep'].includes(updates.role)) u.role = updates.role;
    if (updates.status) u.status = updates.status;
    if (updates.verificationStatus && ['pending', 'verified', 'rejected'].includes(updates.verificationStatus)) { u.verificationStatus = updates.verificationStatus; if (updates.verificationStatus === 'rejected') u.status = 'suspended'; }
    if ((updates.verificationStatus && beforeVerification !== u.verificationStatus) || (updates.status && beforeStatus !== u.status) || updates.wardRepresentativeStatus) accountDecisionEmail(u, updates.wardRepresentativeStatus || updates.verificationStatus || updates.status);
    return store.toPublic(u);
  },

  listWardUnits(user) {
    let rows = wardUnits.slice();
    if (user.role === 'ward_rep') {
      const a = user.wardRepresentativeApplication || {};
      rows = rows.filter(w => w.province === a.province && w.district === a.district && String(w.ward) === String(a.ward));
    }
    return rows.map(w => ({ ...w, representative: w.representative ? store.toPublic(users.find(u => u._id === w.representative) || {}) : null }));
  },
  upsertWardUnit(adminId, { province, district, municipality = '', ward, representative = null }) {
    if (!province || !district || !ward) return { error: 'Province, district and ward are required' };
    let row = wardUnits.find(w => w.province === province && w.district === district && (w.municipality || '') === (municipality || '') && String(w.ward) === String(ward));
    if (!row) {
      row = { _id: id(), province, district, municipality: municipality || '', ward: String(ward), representative: representative || null, createdBy: adminId, createdAt: now(), updatedAt: now() };
      wardUnits.push(row);
    } else {
      Object.assign(row, { province, district, municipality: municipality || '', ward: String(ward), representative: representative || null, updatedAt: now() });
    }
    return { ward: { ...row, representative: row.representative ? store.toPublic(users.find(u => u._id === row.representative) || {}) : null } };
  },
  updateWardUnit(wardId, updates) {
    const row = wardUnits.find(w => w._id === wardId);
    if (!row) return null;
    ['province', 'district', 'municipality', 'ward'].forEach(k => { if (updates[k] !== undefined) row[k] = String(updates[k]); });
    if (updates.representative !== undefined) row.representative = updates.representative || null;
    row.updatedAt = now();
    return { ...row, representative: row.representative ? store.toPublic(users.find(u => u._id === row.representative) || {}) : null };
  },
  wardApplications() {
    return users.filter(u => u.wardRepresentativeApplication?.requested).map(store.toPublic);
  },
  createNotice(adminId, { title, message, priority = 'important', audience = 'all', expiresInDays = 7 }) {
    title = String(title || '').trim();
    message = String(message || '').trim();
    if (!title || !message) return { error: 'Title and message are required' };
    if (!['normal', 'important', 'urgent'].includes(priority)) priority = 'important';
    if (!['all', 'admin', 'analyst', 'researcher'].includes(audience)) audience = 'all';
    // Anchor expiry to the end of the calendar day, not a rolling N*24h
    // timer from the exact creation time.
    const expiryDate = new Date();
    expiryDate.setHours(23, 59, 59, 999);
    expiryDate.setDate(expiryDate.getDate() + (Math.max(1, Number(expiresInDays) || 7) - 1));
    const notice = { _id: id(), title, message, priority, audience, active: true, createdBy: adminId, createdAt: now(), updatedAt: now(), expiresAt: expiryDate.toISOString() };
    notices.unshift(notice);
    const targets = users.filter(u => audience === 'all' || u.role === audience);
    targets.forEach(u => {
      store.createNotification(u._id, { type: 'important-notice', title, message, link: '/dashboard' });
      sendEmailQuietly({ to: u.email, subject: `Important notice: ${title}`, text: `Namaste ${u.name},\n\n${message}\n\nOpen Civicदृष्टि to see the notice.` });
    });
    return { notice, emailed: targets.length };
  },
  activeNotice(user) {
    return notices.find(n => n.active && (n.audience === 'all' || n.audience === user.role) && (!n.expiresAt || new Date(n.expiresAt).getTime() > Date.now())) || null;
  },
  listNotices() { return notices.slice(0, 50); },
  setNoticeActive(noticeId, active) {
    const n = notices.find(n => n._id === noticeId);
    if (!n) return null;
    n.active = Boolean(active);
    n.updatedAt = now();
    return n;
  },
  // Token lookup
  findUserById(userId) { return users.find(u => u._id === userId) || null; },
  findUserByPhone(phone) { return users.find(u => u.phone && u.phone === phone) || null; },

  // Auto-creates a minimal, phone-verified "researcher" account for a
  // citizen who reports an issue via SMS before ever using the web app.
  // No password/email â€” this account authenticates only by phone number
  // matching an inbound SMS sender, never through the normal login form.
  createSmsUser(phone) {
    const u = {
      _id: id(), name: `SMS Reporter ${phone.slice(-4)}`, email: `sms-${phone}@no-reply.govinsight.local`,
      password: '', role: 'researcher', organization: 'SMS Reporter', jobTitle: 'Citizen Reporter',
      avatarHue: Math.floor(Math.random() * 360), status: 'active', createdAt: now(),
      phone, citizenshipDoc: '', citizenshipDocName: '', verificationStatus: 'n/a',
    };
    users.push(u);
    return u;
  },

  // ---- Civic reports (flood / road / tunnel etc.) ----
  reportMeta() {
    const names = authorities.length ? authorities.map(a => a.name) : REPORT_AUTHORITIES;
    return { categories: REPORT_CATEGORIES, authorities: names };
  },

  publicReport(r, viewerId = null) {
    const reporter = users.find(u => u._id === r.reportedBy);
    const original = r.duplicateOf ? reports.find(x => x._id === r.duplicateOf) : null;
    return {
      ...r,
      reportedBy: reporter ? store.toPublic(reporter) : null,
      duplicateOfTitle: original ? original.title : null,
      timeline: r.timeline.map(t => ({ ...t, by: (users.find(u => u._id === t.by) && store.toPublic(users.find(u => u._id === t.by))) || null })),
      upvoteCount: (r.upvotes || []).length,
      hasUpvoted: viewerId ? (r.upvotes || []).includes(viewerId) : false,
      comments: (r.comments || []).map(c => ({ ...c, user: store.toPublic(users.find(u => u._id === c.user) || {}) })),
    };
  },

  // ---- Public upvote & comment on issues (community priority signal) ----
  toggleUpvote(reportId, userId) {
    const r = reports.find(x => x._id === reportId);
    if (!r) return { error: 'Report not found' };
    r.upvotes = r.upvotes || [];
    const i = r.upvotes.indexOf(userId);
    if (i === -1) r.upvotes.push(userId); else r.upvotes.splice(i, 1);
    return { report: store.publicReport(r, userId) };
  },
  addReportComment(reportId, userId, text) {
    const r = reports.find(x => x._id === reportId);
    if (!r) return { error: 'Report not found' };
    if (!text || !text.trim()) return { error: 'Comment cannot be empty' };
    r.comments = r.comments || [];
    const comment = { _id: id(), user: userId, text: text.trim(), createdAt: now() };
    r.comments.push(comment);
    if (r.reportedBy !== userId) {
      store.createNotification(r.reportedBy, { type: 'comment', title: 'New comment on your report', message: `Someone commented on "${r.title}"`, link: `/issues/${r._id}`, report: r._id });
    }
    return { report: store.publicReport(r, userId) };
  },

  createReport(userId, { title, category, description, severity, location, reporterContact, photo, photoName, viaSms = false }) {
    const spec = REPORT_CATEGORIES.find(c => c.value === category);
    if (!spec) return { error: 'Unknown category' };
    if (!title || !description || !location?.address) return { error: 'Title, description and address are required' };
    if (!reporterContact || !reporterContact.trim()) return { error: 'A contact number is required so authorities can reach you about this report' };
    if (!viaSms && (location?.lat == null || location?.lng == null)) return { error: 'Please pin your live location â€” it is required to submit a report' };
    // Photos are optional (SMS-submitted reports can't attach one), capped at
    // ~5MB as a base64 data URL (~6.7MB encoded) to match the 5MB photo cap.
    if (photo && photo.length > 7 * 1024 * 1024) return { error: 'Photo is too large â€” max 5MB' };

    const dup = findDuplicateCandidate(category, location);
    const days = estimateDays(category, severity);
    const report = {
      _id: id(),
      title: title.trim(),
      category,
      description: description.trim(),
      severity: severity || 'medium',
      location: { address: location.address || '', district: location.district || '', municipality: location.municipality || '', ward: location.ward || '', lat: location.lat ?? null, lng: location.lng ?? null },
      reportedBy: userId,
      reporterContact: reporterContact || '',
      photo: photo || '', photoName: photoName || '',
      viaSms: !!viaSms,
      upvotes: [userId],
      comments: [],
      status: dup ? 'duplicate' : 'pending',
      estimatedDays: dup ? dup.estimatedDays : days,
      dueDate: dup ? dup.dueDate : addDays(days),
      completedAt: null,
      assignedDepartment: dup ? dup.assignedDepartment : '',
      assignedContact: dup ? dup.assignedContact : '',
      assignedBy: null,
      isFake: false,
      fakeReason: '',
      duplicateOf: dup ? dup._id : null,
      confirmations: 1,
      timeline: [{ action: dup ? 'reported (matched to existing issue)' : 'reported', note: dup ? `Linked to an existing report: "${dup.title}"` : `AI-suggested resolution window: ${days} day(s)`, by: userId, at: now() }],
      createdAt: now(), updatedAt: now(),
    };
    reports.push(report);

    if (dup) {
      dup.confirmations += 1;
      dup.updatedAt = now();
      dup.timeline.push({ action: 'duplicate-confirmed', note: `Another citizen reported the same issue (${dup.confirmations} reports total)`, by: userId, at: now() });
      // Let whoever is already handling the original know it's escalating.
      if (dup.assignedBy) store.createNotification(dup.assignedBy, { type: 'duplicate', title: 'Another report on an active issue', message: `"${dup.title}" now has ${dup.confirmations} citizen reports.`, link: `/issues/${dup._id}`, report: dup._id });
    } else {
      store.notifyRoles(['admin', 'analyst'], { type: 'new-report', title: 'New community report', message: `${title.trim()} â€” ${location.address}${location.district ? ', ' + location.district : ''}`, link: `/issues/${report._id}`, report: report._id });
    }
    activities.push({ _id: id(), user: userId, type: 'report', message: `Reported a ${spec.label.toLowerCase()} issue: "${title.trim()}"`, createdAt: now() });
    return { report: store.publicReport(report) };
  },

  listReports(user, { status = 'all', category = 'all', district = '', mine = false, flagged = false, limit = 200 } = {}) {
    let result = reports.slice();
    // Citizens / researchers only ever see their own submissions; staff see everything.
    if (user.role === 'researcher' || mine === 'true' || mine === true) {
      result = result.filter(r => r.reportedBy === user._id);
    }
    if (status !== 'all') result = result.filter(r => r.status === status);
    if (category !== 'all') result = result.filter(r => r.category === category);
    if (district) { const re = new RegExp(district, 'i'); result = result.filter(r => re.test(r.location.district || '')); }
    if (flagged === 'true' || flagged === true) result = result.filter(r => r.isFake);
    return result
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, Number(limit) || 200)
      .map(r => store.publicReport(r, user._id));
  },

  reportStats(user) {
    const scope = user.role === 'researcher' ? reports.filter(r => r.reportedBy === user._id) : reports;
    const active = scope.filter(r => !['completed', 'rejected', 'duplicate'].includes(r.status));
    return {
      total: scope.length,
      pending: scope.filter(r => r.status === 'pending').length,
      active: active.length,
      completed: scope.filter(r => r.status === 'completed').length,
      flagged: scope.filter(r => r.isFake).length,
      duplicates: scope.filter(r => r.duplicateOf).length,
    };
  },

  getReport(reportId, user) {
    const r = reports.find(x => x._id === reportId);
    if (!r) return null;
    if (user.role === 'researcher' && r.reportedBy !== user._id) return null;
    if (user.role === 'ward_rep') { const a = user.wardRepresentativeApplication || {}; if (r.location?.district !== a.district || String(r.location?.ward || '') !== String(a.ward || '')) return null; }
    const duplicates = reports.filter(x => x.duplicateOf === r._id).map(store.publicReport);
    return { ...store.publicReport(r), duplicates };
  },

  // Phone-based lookup for the SMS "STATUS" command â€” no session, so we
  // trust the report id (or its last 6 chars) or fall back to the sender's
  // own most recent report by matching reporterContact/phone.
  getReportForSms(ref, phone) {
    let r = null;
    if (ref) {
      r = reports.find(x => x._id === ref) || reports.find(x => x._id.endsWith(ref));
    }
    if (!r && phone) {
      r = reports
        .filter(x => normalizePhone(x.reporterContact) === phone)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    }
    return r ? store.publicReport(r) : null;
  },

  // Single workflow entrypoint used by analysts/admins to move a report
  // forward: verify -> assign an authority -> (optionally re-estimate the
  // timeline) -> tick complete. Every transition is timestamped and the
  // reporter (plus anyone who confirmed the same issue) gets notified.
  updateReport(reportId, actingUser, action, payload = {}) {
    const r = reports.find(x => x._id === reportId);
    if (!r) return { error: 'Report not found' };
    if (!['admin', 'analyst'].includes(actingUser.role)) return { error: 'Only analysts or admins can manage reports' };

    const confirmers = () => reports.filter(x => x._id === r._id || x.duplicateOf === r._id).map(x => x.reportedBy);
    const notifyReporters = (payload2) => confirmers().forEach(uid => store.createNotification(uid, { ...payload2, link: `/issues/${r._id}`, report: r._id }));

    if (action === 'verify') {
      r.status = 'verified';
      r.timeline.push({ action: 'verified', note: payload.note || 'Confirmed as a genuine issue', by: actingUser._id, at: now() });
      notifyReporters({ type: 'verified', title: 'Your report was verified', message: `"${r.title}" has been confirmed and is being reviewed.` });
    } else if (action === 'assign') {
      if (!payload.assignedDepartment) return { error: 'Choose an authority to assign this to' };
      r.assignedDepartment = payload.assignedDepartment;
      r.assignedContact = payload.assignedContact || '';
      r.assignedBy = actingUser._id;
      r.status = 'assigned';
      r.timeline.push({ action: 'assigned', note: `Handed to ${payload.assignedDepartment}${payload.assignedContact ? ` (${payload.assignedContact})` : ''}`, by: actingUser._id, at: now() });
      notifyReporters({ type: 'assigned', title: 'Your report was assigned', message: `"${r.title}" was assigned to ${payload.assignedDepartment}.` });
    } else if (action === 'set-eta') {
      const days = Number(payload.estimatedDays);
      if (!Number.isFinite(days) || days <= 0) return { error: 'Enter a valid number of days' };
      r.estimatedDays = days;
      r.dueDate = addDays(days);
      r.status = r.status === 'pending' ? 'verified' : r.status;
      r.timeline.push({ action: 'eta-updated', note: `Analyst revised the estimate to ${days} day(s)${payload.note ? ` â€” ${payload.note}` : ''}`, by: actingUser._id, at: now() });
      notifyReporters({ type: 'eta-updated', title: 'Estimated completion updated', message: `"${r.title}" is now expected to be resolved in ${days} day(s).` });
    } else if (action === 'start') {
      r.status = 'in-progress';
      r.timeline.push({ action: 'in-progress', note: payload.note || 'Work has started on site', by: actingUser._id, at: now() });
      notifyReporters({ type: 'eta-updated', title: 'Work has started', message: `Crews have started work on "${r.title}".` });
    } else if (action === 'complete') {
      r.status = 'completed';
      r.completedAt = now();
      r.timeline.push({ action: 'completed', note: payload.note || 'Marked complete by analyst', by: actingUser._id, at: now() });
      notifyReporters({ type: 'completed', title: 'Issue resolved', message: `Good news â€” "${r.title}" has been marked complete.` });
      store.notifyRoles(['admin'], { type: 'completed', title: 'Report closed', message: `${actingUser.name} closed "${r.title}".`, link: `/issues/${r._id}`, report: r._id });
    } else if (action === 'mark-fake') {
      if (!payload.reason) return { error: 'Give a reason so it can be reviewed later' };
      r.isFake = true;
      r.fakeReason = payload.reason;
      r.status = 'rejected';
      r.timeline.push({ action: 'flagged-fake', note: payload.reason, by: actingUser._id, at: now() });
      store.createNotification(r.reportedBy, { type: 'flagged-fake', title: 'Your report was closed', message: `"${r.title}" was reviewed and closed: ${payload.reason}`, link: `/issues/${r._id}`, report: r._id });
    } else if (action === 'mark-duplicate') {
      const target = reports.find(x => x._id === payload.duplicateOf);
      if (!target || target._id === r._id) return { error: 'Pick a valid original report' };
      r.duplicateOf = target._id;
      r.status = 'duplicate';
      target.confirmations += 1;
      r.timeline.push({ action: 'marked-duplicate', note: `Merged into "${target.title}"`, by: actingUser._id, at: now() });
      store.createNotification(r.reportedBy, { type: 'duplicate', title: 'Report merged', message: `Your report was merged with an existing one: "${target.title}", which is already being tracked.`, link: `/issues/${target._id}`, report: target._id });
    } else {
      return { error: 'Unknown action' };
    }
    r.updatedAt = now();
    return { report: store.publicReport(r) };
  },

  // ---- Authorities ----
  listAuthorities({ district = '' } = {}) {
    let result = authorities.slice();
    if (district) { const re = new RegExp(`^${district}$`, 'i'); result = result.filter(a => re.test(a.district || '')); }
    return result.sort((a, b) => b.ratingAvg - a.ratingAvg || a.name.localeCompare(b.name));
  },
  createAuthority(createdBy, { name, department, district, categories, contactEmail, contactPhone }) {
    if (!name) return { error: 'Authority name is required' };
    if (authorities.some(a => a.name === name && (a.district || '') === (district || ''))) {
      return { error: 'That authority already exists for this district' };
    }
    const a = {
      _id: id(), name, department: department || '', district: district || '',
      categories: Array.isArray(categories) ? categories : [],
      contactEmail: contactEmail || '', contactPhone: contactPhone || '',
      source: 'admin', createdBy, ratingAvg: 0, ratingCount: 0, createdAt: now(), updatedAt: now(),
    };
    authorities.push(a);
    return { authority: a };
  },
  // Rule-based "AI" pass: fills in any authority types this district is
  // missing yet (roads, disaster mgmt, water, electricity, urban dev, ward office).
  aiSuggestAuthorities(createdBy, district) {
    if (!district) return { error: 'District is required' };
    const existingNames = new Set(authorities.filter(a => (a.district || '').toLowerCase() === district.toLowerCase()).map(a => a.name));
    const toCreate = fallbackSuggestAuthoritiesForArea(district, existingNames);
    const created = toCreate.map(spec => {
      const a = { _id: id(), ...spec, contactEmail: '', contactPhone: '', createdBy, ratingAvg: 0, ratingCount: 0, createdAt: now(), updatedAt: now() };
      authorities.push(a);
      return a;
    });
    return { created, message: created.length ? `Added ${created.length} authority(ies) for ${district}` : `${district} already has full coverage` };
  },

  // ---- Reviews ----
  listReviews(authorityId) {
    return reviews.filter(r => r.authority === authorityId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(r => ({ ...r, user: store.toPublic(users.find(u => u._id === r.user) || {}) }));
  },
  createReview(userId, authorityId, { rating, comment, report }) {
    const authority = authorities.find(a => a._id === authorityId);
    if (!authority) return { error: 'Authority not found' };
    const num = Number(rating);
    if (!Number.isFinite(num) || num < 1 || num > 5) return { error: 'Rating must be between 1 and 5' };
    const review = { _id: id(), authority: authorityId, report: report || null, user: userId, rating: num, comment: (comment || '').trim(), createdAt: now(), updatedAt: now() };
    reviews.push(review);
    const total = authority.ratingAvg * authority.ratingCount + num;
    authority.ratingCount += 1;
    authority.ratingAvg = Math.round((total / authority.ratingCount) * 10) / 10;
    return { review: { ...review, user: store.toPublic(users.find(u => u._id === userId) || {}) }, authority };
  },

  // ---- Notifications ----
  createNotification(userId, { type, title, message, link = '', report = null }) {
    if (!userId) return null;
    const n = { _id: id(), user: userId, type, title, message, link, read: false, report, createdAt: now() };
    notifications.push(n);
    const target = users.find(u => u._id === userId);
    if (target?.email) sendEmailQuietly({ to: target.email, subject: 'Civicदृष्टि: ' + title, text: message + (link ? '\\n\\nOpen: ' + link : '') });
    return n;
  },
  notifyRoles(roles, payload) {
    users.filter(u => roles.includes(u.role)).forEach(u => store.createNotification(u._id, payload));
  },
  getNotifications(userId, { limit = 50 } = {}) {
    const mine = notifications.filter(n => n.user === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { notifications: mine.slice(0, Number(limit) || 50), unreadCount: mine.filter(n => !n.read).length };
  },
  markNotificationRead(notificationId, userId) {
    const n = notifications.find(x => x._id === notificationId && x.user === userId);
    if (!n) return null;
    n.read = true;
    return n;
  },
  markAllNotificationsRead(userId) {
    notifications.filter(n => n.user === userId).forEach(n => { n.read = true; });
    return true;
  },
};

module.exports = store;