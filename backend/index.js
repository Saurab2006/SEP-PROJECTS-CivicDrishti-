require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { connect, getMode } = require('./db');
const store = require('./memstore');
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const budgetRoutes = require('./routes/budgets');
const departmentRoutes = require('./routes/departments');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const authorityRoutes = require('./routes/authorities');
const noticeRoutes = require('./routes/notices');
const wardRoutes = require('./routes/wards');
const smsRoutes = require('./routes/sms');
const Authority = require('./models/Authority');
const { parseInboundSms, helpText, sendSms, normalizePhone, VALID_CATEGORIES } = require('./utils/sms');
const { code, hashCode, expires, validHash, welcomeEmail, otpEmail, resetEmail } = require('./utils/authEmails');

const JWT_SECRET = process.env.JWT_SECRET || 'govinsight-nepal-jwt-secret';

function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

async function protect(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(h.split(' ')[1], JWT_SECRET);
    const user = store.findUserById(decoded.id);
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'Invalid session' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const SECTOR_COLORS = { 'Roads & Transport': '#2563EB', Health: '#10B981', Education: '#8B5CF6', 'Drinking Water': '#06B6D4', Agriculture: '#F59E0B', Energy: '#EF4444', 'Urban Development': '#EC4899', 'Disaster Management': '#F97316' };
function shortDept(n) { return n.replace(/^(Ministry|Department) of /, '').split(',')[0]; }

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '12mb' }));

function useMongoRoutes(path, router) {
  app.use(path, (req, res, next) => {
    if (getMode() !== 'mongo') return next();
    return router(req, res, next);
  });
}

// Health
app.get('/api/health', (_, res) => res.json({ ok: true, database: getMode() }));

// Use persistent MongoDB routes when MONGODB_URI is reachable. The existing
// memory routes below keep the app usable without a local database.
useMongoRoutes('/api/auth', authRoutes);
useMongoRoutes('/api/analytics', analyticsRoutes);
useMongoRoutes('/api/budgets', budgetRoutes);
useMongoRoutes('/api/departments', departmentRoutes);
useMongoRoutes('/api/users', userRoutes);
useMongoRoutes('/api/reports', reportRoutes);
useMongoRoutes('/api/notifications', notificationRoutes);
useMongoRoutes('/api/authorities', authorityRoutes);
useMongoRoutes('/api/notices', noticeRoutes);
useMongoRoutes('/api/wards', wardRoutes);
useMongoRoutes('/api/sms', smsRoutes);


app.get('/api/notices/public-active', (req, res) => {
  const notice = store.activeNotice({ role: 'all' });
  res.json({ notice: notice && notice.audience === 'all' ? notice : null });
});
// ---- AUTH ----
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, organization, citizenshipDoc, citizenshipDocName, province, district, municipality, ward, applicationDetails } = req.body;
    if (!name || !email || !password) return res.status(422).json({ error: 'Name, email and password are required' });
    if (password.length < 6) return res.status(422).json({ error: 'Password must be at least 6 characters' });
    const exists = await store.findUserByEmail(email.toLowerCase().trim());
    if (exists) return res.status(409).json({ error: 'An account with this email already exists' });
    // Public signup only ever creates the first account as admin, or a normal
    // (researcher/viewer) account after that. Analyst access is granted only
    // by an existing admin from User Management â€” never through signup.
    const isFirst = store.userCount() === 0;
    const finalRole = role === 'ward_rep' ? 'ward_rep' : (isFirst ? 'admin' : 'researcher');

    // Citizens must verify identity with a citizenship document so
    // admins/analysts can trace a report back to a real person if flagged fake.
    if (['researcher', 'ward_rep'].includes(finalRole) && !citizenshipDoc) {
      return res.status(422).json({ error: 'Please upload your citizenship certificate or national ID to verify your identity' });
    }

    const user = await store.createUser({ name: name.trim(), email, password, role: finalRole, organization, citizenshipDoc, citizenshipDocName, province, district, municipality, ward, applicationDetails });
    const otp = store.setEmailOtp(user);
    welcomeEmail(user);
    otpEmail(user, otp);
    const token = signToken(user);
    store.seedForUser(user._id);
    if (finalRole === 'ward_rep') return res.status(202).json({ user: store.toPublic(user), pending: true, message: 'Ward Representative request submitted for admin approval' });
    res.status(201).json({ user: store.toPublic(user), token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(422).json({ error: 'Email and password are required' });
    let user = await store.findUserByEmail(email.toLowerCase().trim());
    // Auto-provision demo accounts
    if (!user && email.endsWith('@govinsight.np')) {
      const roleMap = { 'admin@govinsight.np': 'admin', 'analyst@govinsight.np': 'analyst', 'researcher@govinsight.np': 'researcher' };
      const names = { 'admin@govinsight.np': 'Saurabh', 'analyst@govinsight.np': 'Raja', 'researcher@govinsight.np': 'Anup' };
      const demoRole = roleMap[email] || 'analyst';
      user = await store.createUser({ name: names[email] || 'Demo User', email, password: password, role: demoRole, organization: 'Civicदृष्टि' });
      store.seedForUser(user._id);
    }
    if (!user) return res.status(401).json({ error: 'Incorrect email or password' });
    const valid = await store.comparePassword(user, password);
    if (!valid) return res.status(401).json({ error: 'Incorrect email or password' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Account suspended' });
    const token = signToken(user);
    store.seedForUser(user._id);
    res.json({ user: store.toPublic(user), token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/auth/verify-email', protect, (req, res) => {
  const otp = String(req.body?.otp || '').trim();
  if (req.user.emailVerified) return res.json({ user: store.toPublic(req.user) });
  if (!store.verifyEmailOtp(req.user, otp)) return res.status(422).json({ error: 'Invalid or expired verification code' });
  res.json({ user: store.toPublic(req.user) });
});

app.post('/api/auth/resend-email-otp', protect, (req, res) => {
  if (req.user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  const otp = store.setEmailOtp(req.user);
  otpEmail(req.user, otp);
  res.json({ ok: true });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const user = email ? await store.findUserByEmail(email) : null;
    if (user) {
      const otp = store.setResetOtp(user);
      await resetEmail(user, otp).catch(() => null);
    }
    res.json({ ok: true, message: 'If that email exists, a reset code has been sent.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const otp = String(req.body?.otp || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !otp || !password) return res.status(422).json({ error: 'Email, code and new password are required' });
    if (password.length < 6) return res.status(422).json({ error: 'Password must be at least 6 characters' });
    const user = await store.findUserByEmail(email);
    if (!user || !validHash(user.resetPasswordHash, otp, user.resetPasswordExpires)) return res.status(422).json({ error: 'Invalid or expired reset code' });
    await store.setPassword(user, password);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/auth/me', protect, (req, res) => {
  res.json({ user: store.toPublic(req.user) });
});

// ---- ANALYTICS ----
app.get('/api/analytics', protect, (req, res) => {
  const wardScope = req.user.role === 'ward_rep' ? req.user.wardRepresentativeApplication || {} : null;
  const docs = wardScope ? store.getDocuments().filter(d => d.district === wardScope.district) : store.getDocuments();
  const budgets = wardScope ? store.getBudgets().filter(b => b.district === wardScope.district && String(b.ward || '') === String(wardScope.ward || '')) : store.getBudgets();
  const projs = wardScope ? store.getProjects().filter(p => p.district === wardScope.district && String(p.ward || '') === String(wardScope.ward || '')) : store.getProjects();
  const acts = store.getActivities();

  const totalBudget = docs.reduce((a, d) => a + (d.totalBudget || 0), 0);
  const deptSet = new Set(budgets.map(b => b.department));
  const fys = [...new Set(docs.map(d => d.fiscalYear))].sort();

  const sectorMap = {}; budgets.forEach(b => { sectorMap[b.sector] = (sectorMap[b.sector] || 0) + b.amount; });
  const sectorBreakdown = Object.entries(sectorMap).map(([key, value]) => ({ key, value, color: SECTOR_COLORS[key] || '#2563EB' })).sort((a, b) => b.value - a.value).slice(0, 8);

  const fyMap = {}; budgets.forEach(b => { fyMap[b.fiscalYear] = (fyMap[b.fiscalYear] || 0) + b.amount; });
  const budgetTrend = Object.entries(fyMap).map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key));

  const deptMap = {}; budgets.forEach(b => { const k = shortDept(b.department); deptMap[k] = (deptMap[k] || 0) + b.amount; });
  const topDepartments = Object.entries(deptMap).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const distMap = {}; budgets.filter(b => b.district).forEach(b => { distMap[b.district] = (distMap[b.district] || 0) + b.amount; });
  const districts = Object.entries(distMap).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const utilMap = {};
  projs.forEach(p => { const e = utilMap[p.sector] || { key: p.sector, total: 0, utilized: 0 }; e.total += p.budget; if (p.status === 'completed' || p.status === 'ongoing') e.utilized += p.budget; utilMap[p.sector] = e; });
  const utilization = Object.values(utilMap).filter(u => u.total > 0).map(u => ({ ...u, percent: Math.round((u.utilized / u.total) * 100), color: SECTOR_COLORS[u.key] || '#2563EB' })).sort((a, b) => b.total - a.total).slice(0, 6);

  const recentDocuments = docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  res.json({
    kpis: { documents: docs.length, totalBudget, departments: deptSet.size, projects: projs.length, latestFy: fys[fys.length - 1] || 'â€”' },
    sectorBreakdown, budgetTrend, topDepartments, districts, utilization, recentDocuments,
    activity: acts.map(a => ({ _id: a._id, type: a.type, message: a.message, createdAt: a.createdAt })),
  });
});

// ---- BUDGETS ----
app.get('/api/budgets/tracking', protect, (req, res) => {
  res.json(store.getBudgetTrackingForUser(req.user));
});
app.get('/api/budgets', protect, (req, res) => {
  const budgetQuery = { ...req.query };
  if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; budgetQuery.district = a.district || '__none__'; budgetQuery.ward = String(a.ward || '__none__'); }
  const items = store.filterBudgets(budgetQuery);
  res.json({ items });
});

app.get('/api/budgets/changes', protect, (req, res) => {
  res.json({ changes: store.getBudgetChanges(req.user, req.query) });
});

app.post('/api/budgets/:id/changes', protect, (req, res) => {
  if (!['analyst', 'ward_rep'].includes(req.user.role)) return res.status(403).json({ error: 'Only analysts or ward representatives can propose data changes' });

  const allowed = ['title', 'department', 'sector', 'amount', 'fiscalYear', 'district', 'ward'];
  const proposed = {};
  allowed.forEach(key => {
    if (req.body[key] !== undefined && req.body[key] !== '') proposed[key] = req.body[key];
  });

  if (proposed.amount !== undefined) {
    proposed.amount = Number(proposed.amount);
    if (!Number.isFinite(proposed.amount) || proposed.amount < 0) {
      return res.status(422).json({ error: 'Amount must be a valid positive number' });
    }
  }

  if (Object.keys(proposed).length === 0) return res.status(422).json({ error: 'Add at least one proposed change' });

  if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; proposed.district = a.district || proposed.district; proposed.municipality = a.municipality || proposed.municipality; proposed.ward = a.ward || proposed.ward; }
  const change = store.createBudgetChange(req.params.id, req.user._id, proposed, req.body.reason, req.user);
  if (!change) return res.status(404).json({ error: 'Budget item not found' });
  res.status(201).json({ change });
});

// Propose a brand-new budget record (not an edit to an existing line) â€” e.g.
// data for a municipality or fiscal year that isn't in the system yet.
app.post('/api/budgets/changes', protect, (req, res) => {
  if (!['analyst', 'ward_rep'].includes(req.user.role)) return res.status(403).json({ error: 'Only analysts or ward representatives can propose new records' });

  let { title, department, sector, amount, fiscalYear, district, municipality, ward, reason } = req.body;
  if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; district = a.district || district; municipality = a.municipality || municipality; ward = a.ward || ward; }
  if (!title || !department || !sector || !fiscalYear) {
    return res.status(422).json({ error: 'Title, department, sector, and fiscal year are required' });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    return res.status(422).json({ error: 'Amount must be a valid positive number' });
  }

  const change = store.createBudgetChangeNew(req.user._id, { title, department, sector, amount: amountNum, fiscalYear, district: district || '', municipality: municipality || '', ward: ward || '' }, reason);
  res.status(201).json({ change });
});

app.patch('/api/budgets/changes/:id', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can approve or reject changes' });
  if (!['approved', 'rejected'].includes(req.body.status)) return res.status(422).json({ error: 'Status must be approved or rejected' });
  const change = store.reviewBudgetChange(req.params.id, req.user._id, req.body.status);
  if (!change) return res.status(404).json({ error: 'Pending change request not found' });
  res.json({ change });
});

// Corruption / misuse flagging channel â€” any signed-in user can flag a
// budget line as suspicious; only admins can clear the flag after review.
app.post('/api/budgets/:id/flag', protect, (req, res) => {
  const result = store.flagBudgetItem(req.params.id, req.user._id, req.body?.reason);
  if (result.error) return res.status(422).json({ error: result.error });
  res.status(201).json(result);
});
app.delete('/api/budgets/:id/flag', protect, (req, res) => {
  const result = store.unflagBudgetItem(req.params.id, req.user);
  if (result.error) return res.status(403).json({ error: result.error });
  res.json(result);
});

// ---- DEPARTMENTS ----
app.get('/api/departments', protect, (req, res) => {
  const budgets = store.getBudgets();
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
    const list = Object.values(map).map(e => ({ name: e.name, total: e.total, count: e.count, topSector: Object.entries(e.sectors).sort((a, b) => b[1] - a[1])[0]?.[0] || 'â€”', districts: e.districts.size })).sort((a, b) => b.total - a.total);
    return res.json({ departments: list });
  }

  const entry = map[name];
  if (!entry) return res.json({ department: null });
  const lines = budgets.filter(b => shortDept(b.department) === name).sort((a, b) => b.amount - a.amount).slice(0, 60).map(b => ({ _id: b._id, title: b.title, sector: b.sector, amount: b.amount, fiscalYear: b.fiscalYear, district: b.district, page: b.page, documentId: b.document }));
  res.json({ department: { name, total: entry.total, count: entry.count, districts: entry.districts.size, topSector: Object.entries(entry.sectors).sort((a, b) => b[1] - a[1])[0]?.[0] || 'â€”', sectors: Object.entries(entry.sectors).map(([key, value]) => ({ key, value, color: SECTOR_COLORS[key] || '#2563EB' })).sort((a, b) => b.value - a.value), trend: Object.entries(entry.byYear).map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key)), lines } });
});

// ---- USERS (admin) ----
app.get('/api/users', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json({ users: store.getAllUsers() });
});

app.patch('/api/users/:id', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const updated = store.updateUser(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({ user: updated });
});

app.get('/api/users/:id/citizenship-doc', protect, (req, res) => {
  if (!['admin', 'analyst'].includes(req.user.role)) return res.status(403).json({ error: 'Admin or analyst only' });
  const doc = store.getCitizenshipDoc(req.params.id);
  if (!doc || !doc.citizenshipDoc) return res.status(404).json({ error: 'No citizenship document on file' });
  res.json(doc);
});

// ---- COMMUNITY REPORTS (flood / road damage / tunnel blockage etc.) ----
app.get('/api/reports/meta', protect, (req, res) => {
  res.json(store.reportMeta());
});

app.get('/api/reports/stats', protect, (req, res) => {
  res.json(store.reportStats(req.user));
});

app.get('/api/reports', protect, (req, res) => {
  res.json({ reports: store.listReports(req.user, req.query) });
});

app.post('/api/reports', protect, (req, res) => {
  if (req.user.role !== 'researcher') return res.status(403).json({ error: 'Only researchers can submit a community report' });
  const result = store.createReport(req.user._id, req.body || {});
  if (result.error) return res.status(422).json({ error: result.error });
  res.status(201).json(result);
});

app.get('/api/reports/:id', protect, (req, res) => {
  const report = store.getReport(req.params.id, req.user);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({ report });
});

// Single endpoint for the analyst/admin workflow: verify, assign to an
// authority, revise the AI-suggested ETA, start work, mark complete, or
// flag as fake/duplicate. `action` selects the transition.
app.patch('/api/reports/:id', protect, (req, res) => {
  const { action, ...payload } = req.body || {};
  const result = store.updateReport(req.params.id, req.user, action, payload);
  if (result.error) return res.status(422).json({ error: result.error });
  res.json(result);
});

// ---- SMS REPORTING FALLBACK ----
// Inbound webhook a carrier (Twilio or equivalent) calls when a citizen
// texts in. No JWT auth here by design â€” SMS senders aren't logged into
// the web app; the phone number itself is the identity. Point your
// carrier's inbound-SMS webhook at POST /api/sms/inbound.
app.post('/api/sms/inbound', async (req, res) => {
  try {
    const fromRaw = req.body.From || req.body.from || req.body.sender || '';
    const body = req.body.Body || req.body.body || req.body.text || '';
    const phone = normalizePhone(fromRaw);
    if (!phone) return res.status(422).json({ error: 'Missing sender phone number' });

    const cmd = parseInboundSms(body);
    let reply;

    if (cmd.type === 'help') {
      reply = helpText();
    } else if (cmd.type === 'status') {
      const report = store.getReportForSms(cmd.ref, phone);
      reply = report
        ? `Report "${report.title}" â€” status: ${report.status}${report.assignedDepartment ? ` (${report.assignedDepartment})` : ''}. ID: ${report._id.slice(-6)}`
        : "No matching report found. Text your report ID, or REPORT to file a new one.";
    } else if (cmd.type === 'report') {
      if (!cmd.category) {
        reply = `Category not recognized. Valid categories: ${VALID_CATEGORIES.join(', ')}`;
      } else {
        let smsUser = store.findUserByPhone(phone);
        if (!smsUser) {
          // Auto-create a lightweight, phone-verified citizen account so the
          // report has an owner and the sender can check status later. No
          // password/email â€” this account can only be used via SMS.
          smsUser = store.createSmsUser(phone);
        }
        const result = store.createReport(smsUser._id, {
          title: cmd.description.slice(0, 80) || `${cmd.category} report`,
          category: cmd.category,
          description: cmd.description || cmd.category,
          severity: 'medium',
          location: { address: cmd.district || 'Unspecified (via SMS)', district: cmd.district || '' },
          reporterContact: phone,
          viaSms: true,
        });
        reply = result.error
          ? `Could not file report: ${result.error}`
          : `Report received. ID: ${result.report._id.slice(-6)}. Text STATUS ${result.report._id.slice(-6)} to check progress.`;
      }
    } else {
      reply = `Unrecognized message. Text HELP for commands.\n${helpText()}`;
    }

    await sendSms(fromRaw, reply);
    res.json({ ok: true, reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-only: send a manual/test SMS (used to verify carrier config from Settings).
app.post('/api/sms/send-test', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can send test SMS' });
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(422).json({ error: 'to and message are required' });
  const result = await sendSms(to, message);
  if (!result.ok) return res.status(502).json({ error: result.error || 'SMS send failed' });
  res.json(result);
});

// ---- AUTHORITIES (admin adds, or the AI area-suggester fills in coverage) ----
app.get('/api/authorities', protect, (req, res) => {
  res.json({ authorities: store.listAuthorities(req.query) });
});

app.post('/api/authorities', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can add authorities' });
  const result = store.createAuthority(req.user._id, req.body || {});
  if (result.error) return res.status(422).json({ error: result.error });
  res.status(201).json(result);
});

app.post('/api/authorities/ai-suggest', protect, (req, res) => {
  if (!['admin', 'analyst'].includes(req.user.role)) return res.status(403).json({ error: 'Only admins or analysts can run area suggestions' });
  const result = store.aiSuggestAuthorities(req.user._id, (req.body || {}).district);
  if (result.error) return res.status(422).json({ error: result.error });
  res.status(201).json(result);
});

app.get('/api/authorities/:id/reviews', protect, (req, res) => {
  res.json({ reviews: store.listReviews(req.params.id) });
});

app.post('/api/authorities/:id/reviews', protect, (req, res) => {
  const result = store.createReview(req.user._id, req.params.id, req.body || {});
  if (result.error) return res.status(422).json({ error: result.error });
  res.status(201).json(result);
});



// ---- WARD STRUCTURE ----
app.get('/api/wards', protect, (req, res) => res.json({ wards: store.listWardUnits(req.user) }));
app.post('/api/wards', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const result = store.upsertWardUnit(req.user._id, req.body || {});
  if (result.error) return res.status(422).json({ error: result.error });
  res.status(201).json(result);
});
app.patch('/api/wards/:id', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const ward = store.updateWardUnit(req.params.id, req.body || {});
  if (!ward) return res.status(404).json({ error: 'Ward not found' });
  res.json({ ward });
});
app.get('/api/wards/representatives/applications', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json({ applications: store.wardApplications() });
});
// ---- IMPORTANT NOTICES ----
app.get('/api/notices/active', protect, (req, res) => {
  res.json({ notice: store.activeNotice(req.user) });
});
app.get('/api/notices', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json({ notices: store.listNotices() });
});
app.post('/api/notices', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const result = store.createNotice(req.user._id, req.body || {});
  if (result.error) return res.status(422).json({ error: result.error });
  res.status(201).json(result);
});
app.patch('/api/notices/:id', protect, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const notice = store.setNoticeActive(req.params.id, req.body?.active);
  if (!notice) return res.status(404).json({ error: 'Notice not found' });
  res.json({ notice });
});
// ---- NOTIFICATIONS ----
app.get('/api/notifications', protect, (req, res) => {
  res.json(store.getNotifications(req.user._id, req.query));
});

app.patch('/api/notifications/:id', protect, (req, res) => {
  const n = store.markNotificationRead(req.params.id, req.user._id);
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification: n });
});

app.patch('/api/notifications', protect, (req, res) => {
  store.markAllNotificationsRead(req.user._id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 5000;

const BASE_AUTHORITIES = [
  'Department of Roads', 'Municipal Ward Office', 'Disaster Management Authority',
  'Water Supply & Sewerage Corporation', 'Urban Development Dept', 'Electricity Authority',
];

async function start() {
  await connect();
  if (getMode() === 'mongo') {
    const count = await Authority.countDocuments();
    if (count === 0) {
      await Authority.insertMany(BASE_AUTHORITIES.map(name => ({ name, department: name, district: '', source: 'seed' })));
    }
  }
  app.listen(PORT, () => console.log(`✓ Express API on :${PORT} (${getMode()} mode)`));
}

start();