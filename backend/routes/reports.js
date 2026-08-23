const express = require('express');
const IncidentReport = require('../models/IncidentReport');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Authority = require('../models/Authority');
const IssueSupport = require('../models/IssueSupport');
const { protect, requireVerified } = require('../middleware/auth');
const { embedText, bestSemanticMatch, bestSemanticMatchWithScore, classifyFreeText, looksNepali, CROSS_CATEGORY_DUPLICATE_THRESHOLD, SEMANTIC_DUPLICATE_THRESHOLD, POSSIBLE_DUPLICATE_THRESHOLD } = require('../utils/civicAI');
const { sendSms } = require('../utils/sms');
const { sendPushToUser } = require('../utils/push');
const { calculateIssuePriority } = require('../utils/issuePriority');
const { notifyWardCitizens, notifyWardRepresentative, notifyMunicipalityHead, sameWardCitizenQuery } = require('../utils/issueNotifications');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();

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
  'Department of Roads', 'Municipal Ward Office', 'Disaster Management Authority',
  'Water Supply & Sewerage Corporation', 'Urban Development Dept', 'Electricity Authority',
];

const REOPEN_WINDOW_DAYS = 7;

function estimateDays(category, severity) {
  const spec = REPORT_CATEGORIES.find(c => c.value === category) || REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1];
  const factor = { critical: 0.5, high: 0.75, medium: 1, low: 1.3 }[severity] ?? 1;
  return Math.max(1, Math.round(spec.baseDays * factor));
}
function addDays(days) { const d = new Date(); d.setDate(d.getDate() + Number(days || 0)); return d; }
function normalizeText(s) { return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean); }
function textOverlap(a, b) {
  const wa = new Set(normalizeText(a)), wb = new Set(normalizeText(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0; wa.forEach(w => { if (wb.has(w)) shared++; });
  return shared / Math.min(wa.size, wb.size);
}
function pct(score) { return score == null ? null : Math.round(score * 1000) / 10; }
function serializeReport(report, viewerId) {
  const obj = typeof report.toObject === "function" ? report.toObject() : report;
  const upvotes = (obj.upvotes || []).map(String);
  const supportCount = Number(obj.supportCount || upvotes.length || 0);
  const hasSupported = viewerId ? upvotes.includes(String(viewerId)) : false;
  return { ...obj, supportCount, hasSupported, upvoteCount: supportCount, hasUpvoted: hasSupported };
}
function wardRepScope(user) {
  const a = user.wardRepresentativeApplication || {};
  return { district: a.district || "__none__", municipality: a.municipality || "__none__", ward: String(a.ward || "__none__") };
}
function municipalityHeadScope(user) {
  const a = user.municipalityHeadProfile || {};
  return { district: a.district || "__none__", municipality: a.municipality || "__none__" };
}
function applyRoleScope(filter, user) {
  if (user.role === "researcher") filter.reportedBy = user._id;
  if (user.role === "ward_rep") { const a = wardRepScope(user); filter["location.district"] = a.district; filter["location.municipality"] = a.municipality; filter["location.ward"] = a.ward; }
  if (user.role === "municipality_head") { const a = municipalityHeadScope(user); filter["location.district"] = a.district; filter["location.municipality"] = a.municipality; }
  return filter;
}

// Looks for the closest match to a new report among recent, unresolved
// reports in the same district. A strong match (>= SEMANTIC_DUPLICATE_THRESHOLD,
// or address word-overlap, or a very strong cross-category match) auto-links
// as before. A weaker match (>= POSSIBLE_DUPLICATE_THRESHOLD) is NOT linked —
// it's surfaced as a suggestion for an officer to confirm or dismiss.
// Returns { report, similarity, strong } or null.
async function findDuplicateCandidate(category, location, description, newEmbedding) {
  const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const districtMatch = new RegExp(`^${(location.district || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  const candidates = await IncidentReport.find({
    category, duplicateOf: null, status: { $nin: ['completed', 'closed', 'rejected'] },
    'location.district': districtMatch,
    createdAt: { $gt: cutoff },
  });

  const withEmbedding = candidates.filter(c => Array.isArray(c.embedding) && c.embedding.length);
  const semanticResult = newEmbedding ? bestSemanticMatchWithScore(newEmbedding, withEmbedding) : null;
  if (semanticResult && semanticResult.score >= SEMANTIC_DUPLICATE_THRESHOLD) {
    return { report: semanticResult.candidate, similarity: semanticResult.score, strong: true };
  }

  const remaining = candidates.filter(c => !withEmbedding.includes(c));
  const wordMatch = remaining.find(r => textOverlap(r.location.address, location.address) >= 0.4);
  if (wordMatch) return { report: wordMatch, similarity: null, strong: true };

  if (newEmbedding) {
    const crossCategoryCandidates = await IncidentReport.find({
      category: { $ne: category }, duplicateOf: null, status: { $nin: ['completed', 'closed', 'rejected'] },
      'location.district': districtMatch,
      createdAt: { $gt: cutoff },
      embedding: { $exists: true, $ne: [] },
    });
    const crossResult = bestSemanticMatchWithScore(newEmbedding, crossCategoryCandidates);
    if (crossResult && crossResult.score >= CROSS_CATEGORY_DUPLICATE_THRESHOLD) {
      return { report: crossResult.candidate, similarity: crossResult.score, strong: true };
    }
  }

  if (semanticResult && semanticResult.score >= POSSIBLE_DUPLICATE_THRESHOLD) {
    return { report: semanticResult.candidate, similarity: semanticResult.score, strong: false };
  }

  return null;
}
async function notifyRoles(roles, payload) {
  const recipients = await User.find({ role: { $in: roles } }).select('_id');
  if (recipients.length) await Notification.insertMany(recipients.map(u => ({ user: u._id, ...payload })));
}
async function notifyReporters(report, payload) {
  const linked = await IncidentReport.find({ $or: [{ _id: report._id }, { duplicateOf: report._id }] }).select('reportedBy');
  if (linked.length) await Notification.insertMany(linked.map(r => ({ user: r.reportedBy, ...payload, report: report._id, link: payload.link || `/issues/${report._id}` })));
}

async function notifyReportersSms(report, message) {
  const linked = await IncidentReport.find({ $or: [{ _id: report._id }, { duplicateOf: report._id }] }).select('reporterContact');
  const numbers = [...new Set(linked.map(r => r.reporterContact).filter(Boolean))];
  await Promise.all(numbers.map(phone => sendSms(phone, message).catch(() => null)));
}

async function notifyReportersPush(report, { title, message, link }) {
  const linked = await IncidentReport.find({ $or: [{ _id: report._id }, { duplicateOf: report._id }] }).select('reportedBy');
  const userIds = [...new Set(linked.map(r => String(r.reportedBy)).filter(Boolean))];
  const url = link || `/issues/${report._id}`;
  await Promise.all(userIds.map(uid => sendPushToUser(uid, { title, body: message, url }).catch(() => null)));
}

router.get('/meta', protect, async (req, res) => {
  try {
    const dbAuthorities = await Authority.find().sort({ name: 1 }).select('name');
    const names = dbAuthorities.length ? dbAuthorities.map(a => a.name) : REPORT_AUTHORITIES;
    res.json({ categories: REPORT_CATEGORIES, authorities: names });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'researcher' ? { reportedBy: req.user._id } : {};
    if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; filter['location.district'] = a.district || '__none__'; filter['location.ward'] = String(a.ward || '__none__'); }
    const [total, pending, completed, flagged, duplicates, active] = await Promise.all([
      IncidentReport.countDocuments(filter),
      IncidentReport.countDocuments({ ...filter, status: 'pending' }),
      IncidentReport.countDocuments({ ...filter, status: { $in: ['completed', 'closed'] } }),
      IncidentReport.countDocuments({ ...filter, isFake: true }),
      IncidentReport.countDocuments({ ...filter, duplicateOf: { $ne: null } }),
      IncidentReport.countDocuments({ ...filter, status: { $nin: ['completed', 'closed', 'rejected', 'duplicate'] } }),
    ]);
    res.json({ total, pending, completed, flagged, duplicates, active });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', protect, async (req, res) => {
  try {
    const { status = 'all', category = 'all', district = '', mine, flagged } = req.query;
    const filter = {};
    if (req.user.role === 'researcher' || mine === 'true') filter.reportedBy = req.user._id;
    if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; filter['location.district'] = a.district || '__none__'; filter['location.ward'] = String(a.ward || '__none__'); }
    if (status !== 'all') filter.status = status;
    if (category !== 'all') filter.category = category;
    if (district) filter['location.district'] = new RegExp(district, 'i');
    if (flagged === 'true') filter.isFake = true;
    const items = await IncidentReport.find(filter).sort({ createdAt: -1 }).limit(200)
      .populate('reportedBy', 'name email role organization avatarHue verificationStatus')
      .populate('timeline.by', 'name email role avatarHue')
      .populate('comments.user', 'name role avatarHue');
    res.json({ reports: items.map(r => serializeReport(r, req.user._id)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', protect, requireVerified, async (req, res) => {
  try {
    if (req.user.role !== 'researcher') return res.status(403).json({ error: 'Only researchers can submit a community report' });
    const { title, category, description, severity, location: inputLocation, reporterContact, photo, photoName } = req.body;
    const citizenLocation = req.user.civicLocation || {};
    const location = { ...(inputLocation || {}) };
    ["province", "district", "municipality", "ward"].forEach(key => { if (citizenLocation[key]) location[key] = String(citizenLocation[key]); });
    const spec = REPORT_CATEGORIES.find(c => c.value === category);
    if (!spec) return res.status(422).json({ error: 'Unknown category' });
    if (!title || !description || !location?.address) return res.status(422).json({ error: 'Title, description and address are required' });
    if (!reporterContact || !reporterContact.trim()) return res.status(422).json({ error: 'A contact number is required so authorities can reach you about this report' });
    if (location?.lat == null || location?.lng == null) return res.status(422).json({ error: 'Please pin your live location - it is required to submit a report' });
    if (photo && photo.length > 7 * 1024 * 1024) return res.status(422).json({ error: 'Photo is too large - max 5MB' });

    const cleanDescription = description.trim();
    const [translation, embedding] = await Promise.all([
      looksNepali(cleanDescription) ? classifyFreeText(cleanDescription) : null,
      embedText(`${location.address} - ${cleanDescription}`),
    ]);

    const dup = await findDuplicateCandidate(category, location, cleanDescription, embedding);
    const isStrongDup = Boolean(dup && dup.strong);
    const isPossibleDup = Boolean(dup && !dup.strong);
    const days = estimateDays(category, severity);

    const report = await IncidentReport.create({
      title: title.trim(), category, description: cleanDescription, severity: severity || 'medium', location, reporterContact,
      photo: photo || '', photoName: photoName || '', upvotes: [req.user._id], comments: [], reportedBy: req.user._id,
      embedding: embedding || undefined,
      language: translation?.language || (looksNepali(cleanDescription) ? 'ne' : 'en'),
      translatedDescription: translation?.translatedText || '',
      status: isStrongDup ? 'duplicate' : 'pending',
      estimatedDays: isStrongDup ? dup.report.estimatedDays : days,
      dueDate: isStrongDup ? dup.report.dueDate : addDays(days),
      assignedDepartment: isStrongDup ? dup.report.assignedDepartment : '',
      assignedContact: isStrongDup ? dup.report.assignedContact : '',
      duplicateOf: isStrongDup ? dup.report._id : null,
      duplicateSimilarity: isStrongDup ? pct(dup.similarity) : null,
      possibleDuplicateOf: isPossibleDup ? dup.report._id : null,
      possibleDuplicateSimilarity: isPossibleDup ? pct(dup.similarity) : null,
      timeline: [{
        action: isStrongDup ? 'reported (matched to existing issue)' : 'reported',
        note: isStrongDup ? `Linked to an existing report: "${dup.report.title}"` : `AI-suggested resolution window: ${days} day(s)`,
        by: req.user._id,
      }],
    });

    if (isStrongDup) {
      dup.report.confirmations += 1;
      dup.report.timeline.push({ action: 'duplicate-confirmed', note: `Another citizen reported the same issue (${dup.report.confirmations} reports total)`, by: req.user._id });
      await dup.report.save();
      if (dup.report.assignedBy) await Notification.create({ user: dup.report.assignedBy, type: 'duplicate', title: 'Another report on an active issue', message: `"${dup.report.title}" now has ${dup.report.confirmations} citizen reports.`, link: `/issues/${dup.report._id}`, report: dup.report._id });
      logAudit(req, {
        action: 'AUTO_DUPLICATE_LINK', targetType: 'IncidentReport', targetId: report._id, targetLabel: report.title,
        previousValue: null, newValue: { duplicateOf: dup.report._id, duplicateOfTitle: dup.report.title, similarity: pct(dup.similarity) },
        district: location.district || '', municipality: location.municipality || '', ward: String(location.ward || ''),
      });
    } else {
      await notifyRoles(['admin', 'municipality_head'], { type: 'new-report', title: 'New community report', message: `${title} - ${location.address}${location.district ? ', ' + location.district : ''}`, link: `/issues/${report._id}`, report: report._id });
    }
    const wardCitizens = await User.countDocuments(sameWardCitizenQuery(report));
    const priority = calculateIssuePriority(report, report.supportCount || 1, wardCitizens);
    report.priorityScore = priority.score;
    report.priorityLevel = priority.level;
    report.priorityReason = priority.reason;
    await report.save();
    if (!isStrongDup) {
      await notifyWardCitizens(report, req.user._id);
      await notifyWardRepresentative(report);
      if (priority.escalated) await notifyMunicipalityHead(report, { type: "priority-escalated", title: "Priority issue in municipality", message: "\"" + report.title + "\" has been marked " + priority.level + " priority." });
    }
    res.status(201).json({ report: serializeReport(report, req.user._id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function supportIssue(req, res) {
  try {
    if (req.user.role !== "researcher") return res.status(403).json({ error: "Only verified citizens can support a ward issue" });
    if (req.user.status !== "active" || req.user.verificationStatus !== "verified") return res.status(403).json({ error: "Your identity must be verified before supporting a public issue" });
    const report = await IncidentReport.findById(req.params.id).populate("comments.user", "name role avatarHue");
    if (!report) return res.status(404).json({ error: "Report not found" });
    const userLoc = req.user.civicLocation || {};
    const issueLoc = report.location || {};
    const sameWard = String(userLoc.district || "") === String(issueLoc.district || "") && String(userLoc.municipality || "") === String(issueLoc.municipality || "") && String(userLoc.ward || "") === String(issueLoc.ward || "");
    if (!sameWard) return res.status(403).json({ error: "You can support only issues from your own municipality and ward" });
    const existing = await IssueSupport.findOne({ issue: report._id, citizen: req.user._id });
    if (existing) {
      await existing.deleteOne();
      report.upvotes = (report.upvotes || []).filter(id => String(id) !== String(req.user._id));
    } else {
      await IssueSupport.create({ issue: report._id, citizen: req.user._id, province: issueLoc.province || "", district: issueLoc.district || "", municipality: issueLoc.municipality || "", ward: String(issueLoc.ward || "") });
      if (!(report.upvotes || []).some(id => String(id) === String(req.user._id))) report.upvotes.push(req.user._id);
      await notifyWardRepresentative(report, { type: "issue-supported", title: "Citizen support added", message: "\"" + report.title + "\" received support from another verified ward citizen." });
    }
    report.supportCount = await IssueSupport.countDocuments({ issue: report._id });
    const wardCitizens = await User.countDocuments(sameWardCitizenQuery(report));
    const before = report.escalationState;
    const priority = calculateIssuePriority(report, report.supportCount, wardCitizens);
    report.priorityScore = priority.score; report.priorityLevel = priority.level; report.priorityReason = priority.reason;
    if (priority.escalated && before !== "municipality-notified") {
      report.escalationState = "municipality-notified";
      report.supportThresholdReachedAt = report.supportThresholdReachedAt || new Date();
      report.timeline.push({ action: "priority-escalated", note: priority.reason, by: req.user._id });
      await notifyMunicipalityHead(report, { type: "priority-escalated", title: "Issue escalated by citizen support", message: "\"" + report.title + "\" reached priority threshold: " + priority.reason });
    }
    await report.save();
    res.json({ report: serializeReport(report, req.user._id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
router.post("/:id/support", protect, supportIssue);
router.post("/:id/upvote", protect, supportIssue);

router.post('/:id/comments', protect, requireVerified, async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    if (!text) return res.status(422).json({ error: 'Comment cannot be empty' });
    const report = await IncidentReport.findById(req.params.id).populate('reportedBy', 'name email role organization avatarHue verificationStatus').populate('comments.user', 'name role avatarHue');
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.comments.push({ user: req.user._id, text });
    await report.save();
    await report.populate('comments.user', 'name role avatarHue');
    const reporterId = String(report.reportedBy?._id || report.reportedBy);
    if (reporterId !== String(req.user._id)) {
      await Notification.create({ user: reporterId, type: 'comment', title: 'New comment on your report', message: `Someone commented on "${report.title}"`, link: `/issues/${report._id}`, report: report._id });
    }
    res.status(201).json({ report: serializeReport(report, req.user._id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/reopen', protect, async (req, res) => {
  try {
    const report = await IncidentReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isOwner = String(report.reportedBy) === String(req.user._id);
    const isStaff = ['admin', 'municipality_head', 'ward_rep'].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Only the reporter or staff can reopen this report' });
    if (!['completed', 'closed'].includes(report.status)) return res.status(422).json({ error: 'Only a completed or closed report can be reopened' });

    const anchor = report.citizenConfirmedAt || report.completedAt;
    const deadline = anchor ? new Date(anchor.getTime() + REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000) : null;
    if (deadline && Date.now() > deadline.getTime()) {
      return res.status(422).json({ error: `The ${REOPEN_WINDOW_DAYS}-day window to reopen this report has passed` });
    }

    const reason = (req.body?.reason || '').trim();
    if (!reason) return res.status(422).json({ error: 'Tell us what still needs fixing' });

    report.status = 'pending';
    report.reopenCount = (report.reopenCount || 0) + 1;
    report.reopenedAt = new Date();
    report.timeline.push({ action: 'reopened', note: reason, by: req.user._id });
    await report.save();

    await notifyRoles(['admin', 'municipality_head'], {
      type: 'reopened', title: 'A resolved report was reopened',
      message: `"${report.title}" was reopened: ${reason}`, link: `/issues/${report._id}`, report: report._id,
    });
    res.json({ report: serializeReport(report, req.user._id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/confirm', protect, async (req, res) => {
  try {
    const report = await IncidentReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isOwner = String(report.reportedBy) === String(req.user._id);
    if (!isOwner) return res.status(403).json({ error: 'Only the original reporter can confirm this report as resolved' });
    if (report.status !== 'completed') return res.status(422).json({ error: 'Only a completed report can be confirmed' });

    report.status = 'closed';
    report.citizenConfirmedAt = new Date();
    report.timeline.push({ action: 'closed', note: 'Citizen confirmed the issue was actually fixed', by: req.user._id });
    await report.save();

    await notifyRoles(['admin', 'municipality_head'], {
      type: 'closed', title: 'Citizen confirmed resolution', message: `"${report.title}" was confirmed fixed by the reporter and is now closed.`,
      link: `/issues/${report._id}`, report: report._id,
    });

    res.json({ report: serializeReport(report, req.user._id) });

    logAudit(req, {
      action: 'CITIZEN_CONFIRM_CLOSED', targetType: 'IncidentReport', targetId: report._id, targetLabel: report.title,
      previousValue: { status: 'completed' }, newValue: { status: 'closed' },
      district: report.location?.district || '', municipality: report.location?.municipality || '', ward: String(report.location?.ward || ''),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const report = await IncidentReport.findById(req.params.id)
      .populate('reportedBy', 'name email role organization avatarHue verificationStatus')
      .populate('timeline.by', 'name email role avatarHue')
      .populate('comments.user', 'name role avatarHue')
      .populate('duplicateOf', 'title status')
      .populate('possibleDuplicateOf', 'title status');
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (req.user.role === 'researcher' && String(report.reportedBy._id) !== String(req.user._id)) return res.status(404).json({ error: 'Report not found' });
    if (req.user.role === 'ward_rep') { const a = req.user.wardRepresentativeApplication || {}; if (report.location?.district !== a.district || String(report.location?.ward || '') !== String(a.ward || '')) return res.status(404).json({ error: 'Report not found' }); }
    const duplicates = await IncidentReport.find({ duplicateOf: report._id }).populate('reportedBy', 'name email role avatarHue');
    res.json({ report: { ...serializeReport(report, req.user._id), duplicates: duplicates.map(d => serializeReport(d, req.user._id)) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    if (!['admin', 'municipality_head', 'ward_rep'].includes(req.user.role)) return res.status(403).json({ error: 'Only admins, municipality heads, or ward representatives can manage reports' });
    const report = await IncidentReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const { action, ...payload } = req.body;
    const previousStatus = report.status;
    const loc = report.location || {};

    if (action === 'verify') {
      report.status = 'verified';
      report.timeline.push({ action: 'verified', note: payload.note || 'Confirmed as a genuine issue', by: req.user._id });
      await notifyReporters(report, { type: 'verified', title: 'Your report was verified', message: `"${report.title}" has been confirmed and is being reviewed.` });
      await notifyReportersSms(report, `Civicदृष्टि: Your report "${report.title.slice(0, 60)}" was verified and is being reviewed.`);
      await notifyReportersPush(report, { title: 'Civicदृष्टि Update', message: `Your report "${report.title}" has been verified.` });
    } else if (action === 'assign') {
      if (!payload.assignedDepartment) return res.status(422).json({ error: 'Choose an authority to assign this to' });
      report.assignedDepartment = payload.assignedDepartment;
      report.assignedContact = payload.assignedContact || '';
      report.assignedBy = req.user._id;
      report.status = 'assigned';
      report.timeline.push({ action: 'assigned', note: `Handed to ${payload.assignedDepartment}${payload.assignedContact ? ` (${payload.assignedContact})` : ''}`, by: req.user._id });
      await notifyReporters(report, { type: 'assigned', title: 'Your report was assigned', message: `"${report.title}" was assigned to ${payload.assignedDepartment}.` });
      await notifyReportersSms(report, `Civicदृष्टि: Your report "${report.title.slice(0, 60)}" was assigned to ${payload.assignedDepartment}.`);
      await notifyReportersPush(report, { title: 'Report Assigned', message: `Your report has been assigned to ${payload.assignedDepartment}.` });
    } else if (action === 'transfer') {
      if (!payload.assignedDepartment) return res.status(422).json({ error: 'Choose a destination authority to transfer this to' });
      if (!payload.reason) return res.status(422).json({ error: 'A reason is required to transfer this report' });
      const fromDept = report.assignedDepartment || 'unassigned';
      report.assignedDepartment = payload.assignedDepartment;
      report.assignedContact = payload.assignedContact || '';
      report.assignedBy = req.user._id;
      if (!['in-progress'].includes(report.status)) report.status = 'assigned';
      report.timeline.push({ action: 'transferred', note: `Transferred from ${fromDept} to ${payload.assignedDepartment}: ${payload.reason}`, by: req.user._id });
      await notifyReporters(report, { type: 'transferred', title: 'Your report was transferred', message: `"${report.title}" was transferred to ${payload.assignedDepartment}.` });
      await notifyReportersPush(report, { title: 'Report Transferred', message: `Your report has been transferred to ${payload.assignedDepartment}.` });
    } else if (action === 'escalate') {
      report.escalated = true;
      report.escalatedAt = new Date();
      report.escalationReason = payload.reason || '';
      report.escalatedBy = req.user._id;
      report.timeline.push({ action: 'escalated', note: payload.reason || 'Marked urgent for priority attention', by: req.user._id });
      await notifyRoles(['admin', 'municipality_head'], { type: 'escalated', title: 'Report escalated', message: `"${report.title}" was escalated by ${req.user.name}.`, link: `/issues/${report._id}`, report: report._id });
    } else if (action === 'set-eta') {
      const days = Number(payload.estimatedDays);
      if (!Number.isFinite(days) || days <= 0) return res.status(422).json({ error: 'Enter a valid number of days' });
      report.estimatedDays = days;
      report.dueDate = addDays(days);
      if (report.status === 'pending') report.status = 'verified';
      report.timeline.push({ action: 'eta-updated', note: `Official revised the estimate to ${days} day(s)${payload.note ? ` - ${payload.note}` : ''}`, by: req.user._id });
      await notifyReporters(report, { type: 'eta-updated', title: 'Estimated completion updated', message: `"${report.title}" is now expected to be resolved in ${days} day(s).` });
    } else if (action === 'start') {
      report.status = 'in-progress';
      report.timeline.push({ action: 'in-progress', note: payload.note || 'Work has started on site', by: req.user._id });
      await notifyReporters(report, { type: 'eta-updated', title: 'Work has started', message: `Crews have started work on "${report.title}".` });
    } else if (action === 'complete') {
      if (payload.resolutionPhoto && payload.resolutionPhoto.length > 7 * 1024 * 1024) return res.status(422).json({ error: 'Proof photo is too large - max 5MB' });
      report.status = 'completed';
      report.completedAt = new Date();
      if (payload.resolutionPhoto) { report.resolutionPhoto = payload.resolutionPhoto; report.resolutionPhotoName = payload.resolutionPhotoName || ''; }
      report.timeline.push({ action: 'completed', note: payload.note || 'Marked complete by official', by: req.user._id });
      await notifyReporters(report, { type: 'completed', title: 'Issue resolved - please confirm', message: `Good news - "${report.title}" has been marked complete. Please confirm it was actually fixed.` });
      await notifyReportersSms(report, `Civicदृष्टि: Good news! Your report "${report.title.slice(0, 60)}" has been marked complete. Please confirm in the app.`);
      await notifyReportersPush(report, { title: 'Issue Resolved', message: `The reported issue "${report.title}" has been marked as resolved. Please confirm.` });
      await notifyRoles(['admin'], { type: 'completed', title: 'Report marked complete', message: `${req.user.name} marked "${report.title}" complete.`, link: `/issues/${report._id}`, report: report._id });
    } else if (action === 'reject') {
      if (!payload.reason) return res.status(422).json({ error: 'A reason is required to reject this report' });
      report.status = 'rejected';
      report.rejectionReason = payload.reason;
      report.timeline.push({ action: 'rejected', note: payload.reason, by: req.user._id });
      await Notification.create({ user: report.reportedBy, type: 'rejected', title: 'Your report was rejected', message: `"${report.title}" was reviewed and rejected: ${payload.reason}`, link: `/issues/${report._id}`, report: report._id });
    } else if (action === 'mark-fake') {
      if (!payload.reason) return res.status(422).json({ error: 'Give a reason so it can be reviewed later' });
      report.isFake = true;
      report.fakeReason = payload.reason;
      report.status = 'rejected';
      report.timeline.push({ action: 'flagged-fake', note: payload.reason, by: req.user._id });
      await Notification.create({ user: report.reportedBy, type: 'flagged-fake', title: 'Your report was closed', message: `"${report.title}" was reviewed and closed: ${payload.reason}`, link: `/issues/${report._id}`, report: report._id });
    } else if (action === 'mark-duplicate') {
      const targetId = payload.duplicateOf || report.possibleDuplicateOf;
      if (!targetId) return res.status(422).json({ error: 'Pick a valid original report' });
      const target = await IncidentReport.findById(targetId);
      if (!target || String(target._id) === String(report._id)) return res.status(422).json({ error: 'Pick a valid original report' });
      const carriedSimilarity = report.possibleDuplicateOf && String(report.possibleDuplicateOf) === String(target._id) ? report.possibleDuplicateSimilarity : null;
      report.duplicateOf = target._id;
      report.duplicateSimilarity = carriedSimilarity;
      report.possibleDuplicateOf = null;
      report.possibleDuplicateSimilarity = null;
      report.duplicateReviewedAt = new Date();
      report.duplicateReviewedBy = req.user._id;
      report.status = 'duplicate';
      target.confirmations += 1;
      await target.save();
      report.timeline.push({ action: 'marked-duplicate', note: `Merged into "${target.title}"${carriedSimilarity ? ` (${carriedSimilarity}% similarity)` : ''}`, by: req.user._id });
      await Notification.create({ user: report.reportedBy, type: 'duplicate', title: 'Report merged', message: `Your report was merged with an existing one: "${target.title}", which is already being tracked.`, link: `/issues/${target._id}`, report: target._id });
    } else if (action === 'dismiss-duplicate') {
      if (report.duplicateOf) {
        const target = await IncidentReport.findById(report.duplicateOf);
        if (target) { target.confirmations = Math.max(1, (target.confirmations || 1) - 1); await target.save(); }
        report.duplicateOf = null;
        report.duplicateSimilarity = null;
        report.status = 'pending';
        report.timeline.push({ action: 'unmarked-duplicate', note: payload.reason || 'Confirmed as a separate, genuine issue', by: req.user._id });
        await Notification.create({ user: report.reportedBy, type: 'not-duplicate', title: 'Your report is being handled separately', message: `"${report.title}" was reviewed and is not a duplicate - it is back in the queue.`, link: `/issues/${report._id}`, report: report._id });
      } else if (report.possibleDuplicateOf) {
        report.timeline.push({ action: 'dismissed-duplicate-suggestion', note: payload.reason || 'Reviewed - not the same issue', by: req.user._id });
        report.possibleDuplicateOf = null;
        report.possibleDuplicateSimilarity = null;
      } else {
        return res.status(422).json({ error: 'This report has no duplicate link to dismiss' });
      }
      report.duplicateReviewedAt = new Date();
      report.duplicateReviewedBy = req.user._id;
    } else {
      return res.status(422).json({ error: 'Unknown action' });
    }

    await report.save();
    res.json({ report: serializeReport(report, req.user._id) });

    const AUDIT_ACTION_MAP = {
      assign: 'ASSIGN_AUTHORITY', transfer: 'TRANSFER_REPORT', escalate: 'ESCALATE_REPORT',
      'mark-fake': 'MARK_FAKE', reject: 'REJECT_REPORT', 'mark-duplicate': 'MARK_DUPLICATE',
      'dismiss-duplicate': 'DISMISS_DUPLICATE',
    };
    logAudit(req, {
      action: AUDIT_ACTION_MAP[action] || 'CHANGE_REPORT_STATUS',
      targetType: 'IncidentReport',
      targetId: report._id,
      targetLabel: report.title,
      previousValue: { status: previousStatus },
      newValue: { status: report.status, action, ...payload },
      district: loc.district || '', municipality: loc.municipality || '', ward: String(loc.ward || ''),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;