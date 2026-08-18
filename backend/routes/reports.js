const express = require('express');
const IncidentReport = require('../models/IncidentReport');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Authority = require('../models/Authority');
const IssueSupport = require('../models/IssueSupport');
const { protect } = require('../middleware/auth');
const { embedText, bestSemanticMatch, classifyFreeText, looksNepali, CROSS_CATEGORY_DUPLICATE_THRESHOLD } = require('../utils/civicAI');
const { sendSms } = require('../utils/sms');
const { sendPushToUser } = require('../utils/push');
const { calculateIssuePriority } = require('../utils/issuePriority');
const { notifyWardCitizens, notifyWardRepresentative, notifyMunicipalityHead, sameWardCitizenQuery } = require('../utils/issueNotifications');

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

// Citizens can reopen a "completed" report within this many days if it
// wasn't actually fixed — long enough to notice, short enough that the
// work item doesn't stay contestable forever.
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

// Two reports are "the same problem" when they share a category, sit in the
// same district, and were filed recently. Within that pool, prefer a
// semantic match (Gemini embeddings on address+description) when both sides
// have one computed; fall back to plain word-overlap on the address for any
// candidate that predates AI enrichment (or when Gemini isn't configured),
// so dedup keeps working exactly as before either way.
async function findDuplicateCandidate(category, location, description, newEmbedding) {
  const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const districtMatch = new RegExp(`^${(location.district || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  const candidates = await IncidentReport.find({
    category, duplicateOf: null, status: { $nin: ['completed', 'rejected'] },
    'location.district': districtMatch,
    createdAt: { $gt: cutoff },
  });

  const withEmbedding = candidates.filter(c => Array.isArray(c.embedding) && c.embedding.length);
  const semanticMatch = newEmbedding ? bestSemanticMatch(newEmbedding, withEmbedding) : null;
  if (semanticMatch) return semanticMatch;

  // Fall back to word-overlap, but only against candidates that couldn't be
  // compared semantically (either side missing an embedding).
  const remaining = candidates.filter(c => !withEmbedding.includes(c));
  const wordMatch = remaining.find(r => textOverlap(r.location.address, location.address) >= 0.4);
  if (wordMatch) return wordMatch;

  // A citizen describing the same problem often files it under a different
  // category than the next person ("Other" vs "Flood / Waterlogging" for the
  // same waterlogged road). If nothing matched within this category, widen
  // the search to the whole district and require stronger semantic evidence
  // before merging across categories, so we don't wrongly conflate two
  // genuinely different issues that just happen to sit near each other.
  if (newEmbedding) {
    const crossCategoryCandidates = await IncidentReport.find({
      category: { $ne: category }, duplicateOf: null, status: { $nin: ['completed', 'rejected'] },
      'location.district': districtMatch,
      createdAt: { $gt: cutoff },
      embedding: { $exists: true, $ne: [] },
    });
    const crossMatch = bestSemanticMatch(newEmbedding, crossCategoryCandidates, CROSS_CATEGORY_DUPLICATE_THRESHOLD);
    if (crossMatch) return crossMatch;
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

// Texts every reporter linked to this issue (the original filer plus anyone
// whose duplicate report got merged into it) at the phone number they gave
// when reporting. For citizens without a smartphone or reliable data, this
// closing-the-loop text matters more than an in-app notification they may
// never see. sendSms() already no-ops to a console log when Twilio isn't
// configured, so this is always safe to call.
async function notifyReportersSms(report, message) {
  const linked = await IncidentReport.find({ $or: [{ _id: report._id }, { duplicateOf: report._id }] }).select('reporterContact');
  const numbers = [...new Set(linked.map(r => r.reporterContact).filter(Boolean))];
  await Promise.all(numbers.map(phone => sendSms(phone, message).catch(() => null)));
}

// Push notification counterpart to notifyReportersSms() - reserved for the
// same milestone events (verified / assigned / resolved) rather than every
// timeline action, so an opted-in citizen isn't buzzed for every minor
// update. Delivered even when the app/browser tab is closed, since the
// service worker's own "push" event handles display. Citizens who haven't
// opted in simply have zero subscriptions, so this is a no-op for them.
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
      IncidentReport.countDocuments({ ...filter, status: 'completed' }),
      IncidentReport.countDocuments({ ...filter, isFake: true }),
      IncidentReport.countDocuments({ ...filter, duplicateOf: { $ne: null } }),
      IncidentReport.countDocuments({ ...filter, status: { $nin: ['completed', 'rejected', 'duplicate'] } }),
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

router.post('/', protect, async (req, res) => {
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

    // AI enrichment, best-effort: translate a Nepali description to English
    // for staff, and embed the address+description so future reports can be
    // matched to this one semantically, not just by shared words.
    const cleanDescription = description.trim();
    const [translation, embedding] = await Promise.all([
      looksNepali(cleanDescription) ? classifyFreeText(cleanDescription) : null,
      embedText(`${location.address} — ${cleanDescription}`),
    ]);

    const dup = await findDuplicateCandidate(category, location, cleanDescription, embedding);
    const days = estimateDays(category, severity);
    const report = await IncidentReport.create({
      title: title.trim(), category, description: cleanDescription, severity: severity || 'medium', location, reporterContact,
      photo: photo || '', photoName: photoName || '', upvotes: [req.user._id], comments: [], reportedBy: req.user._id,
      embedding: embedding || undefined,
      language: translation?.language || (looksNepali(cleanDescription) ? 'ne' : 'en'),
      translatedDescription: translation?.translatedText || '',
      status: dup ? 'duplicate' : 'pending', estimatedDays: dup ? dup.estimatedDays : days, dueDate: dup ? dup.dueDate : addDays(days),
      assignedDepartment: dup ? dup.assignedDepartment : '', assignedContact: dup ? dup.assignedContact : '', duplicateOf: dup ? dup._id : null,
      timeline: [{ action: dup ? 'reported (matched to existing issue)' : 'reported', note: dup ? `Linked to an existing report: "${dup.title}"` : `AI-suggested resolution window: ${days} day(s)`, by: req.user._id }],
    });

    if (dup) {
      dup.confirmations += 1;
      dup.timeline.push({ action: 'duplicate-confirmed', note: `Another citizen reported the same issue (${dup.confirmations} reports total)`, by: req.user._id });
      await dup.save();
      if (dup.assignedBy) await Notification.create({ user: dup.assignedBy, type: 'duplicate', title: 'Another report on an active issue', message: `"${dup.title}" now has ${dup.confirmations} citizen reports.`, link: `/issues/${dup._id}`, report: dup._id });
    } else {
      await notifyRoles(['admin', 'municipality_head'], { type: 'new-report', title: 'New community report', message: `${title} - ${location.address}${location.district ? ', ' + location.district : ''}`, link: `/issues/${report._id}`, report: report._id });
    }
    const wardCitizens = await User.countDocuments(sameWardCitizenQuery(report));
    const priority = calculateIssuePriority(report, report.supportCount || 1, wardCitizens);
    report.priorityScore = priority.score;
    report.priorityLevel = priority.level;
    report.priorityReason = priority.reason;
    await report.save();
    if (!dup) {
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

router.post('/:id/comments', protect, async (req, res) => {
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

// Lets the original reporter — or staff, on their behalf — reopen a report
// that was marked complete but the underlying problem wasn't actually
// fixed. Limited to a short window after completion so old, genuinely
// resolved work can't be reopened indefinitely.
router.post('/:id/reopen', protect, async (req, res) => {
  try {
    const report = await IncidentReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isOwner = String(report.reportedBy) === String(req.user._id);
    const isStaff = ['admin', 'municipality_head', 'ward_rep'].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Only the reporter or staff can reopen this report' });
    if (report.status !== 'completed') return res.status(422).json({ error: 'Only a completed report can be reopened' });

    const deadline = report.completedAt ? new Date(report.completedAt.getTime() + REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000) : null;
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

router.get('/:id', protect, async (req, res) => {
  try {
    const report = await IncidentReport.findById(req.params.id)
      .populate('reportedBy', 'name email role organization avatarHue verificationStatus')
      .populate('timeline.by', 'name email role avatarHue')
      .populate('comments.user', 'name role avatarHue');
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

    if (action === 'verify') {
      report.status = 'verified';
      report.timeline.push({ action: 'verified', note: payload.note || 'Confirmed as a genuine issue', by: req.user._id });
      await notifyReporters(report, { type: 'verified', title: 'Your report was verified', message: `"${report.title}" has been confirmed and is being reviewed.` });
      await notifyReportersSms(report, `Civicदृष्टि: Your report "${report.title.slice(0, 60)}" was verified and is being reviewed.`);
      await notifyReportersPush(report, { title: '🔔 Civicदृष्टि Update', message: `Your report "${report.title}" has been verified.` });
    } else if (action === 'assign') {
      if (!payload.assignedDepartment) return res.status(422).json({ error: 'Choose an authority to assign this to' });
      report.assignedDepartment = payload.assignedDepartment;
      report.assignedContact = payload.assignedContact || '';
      report.assignedBy = req.user._id;
      report.status = 'assigned';
      report.timeline.push({ action: 'assigned', note: `Handed to ${payload.assignedDepartment}${payload.assignedContact ? ` (${payload.assignedContact})` : ''}`, by: req.user._id });
      await notifyReporters(report, { type: 'assigned', title: 'Your report was assigned', message: `"${report.title}" was assigned to ${payload.assignedDepartment}.` });
      await notifyReportersSms(report, `Civicदृष्टि: Your report "${report.title.slice(0, 60)}" was assigned to ${payload.assignedDepartment}.`);
      await notifyReportersPush(report, { title: '🔔 Report Assigned', message: `Your report has been assigned to ${payload.assignedDepartment}.` });
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
      await notifyReporters(report, { type: 'completed', title: 'Issue resolved', message: `Good news - "${report.title}" has been marked complete.` });
      await notifyReportersSms(report, `Civicदृष्टि: Good news! Your report "${report.title.slice(0, 60)}" has been marked complete.`);
      await notifyReportersPush(report, { title: '✅ Issue Resolved', message: `The reported issue "${report.title}" has been marked as resolved.` });
      await notifyRoles(['admin'], { type: 'completed', title: 'Report closed', message: `${req.user.name} closed "${report.title}".`, link: `/issues/${report._id}`, report: report._id });
    } else if (action === 'mark-fake') {
      if (!payload.reason) return res.status(422).json({ error: 'Give a reason so it can be reviewed later' });
      report.isFake = true;
      report.fakeReason = payload.reason;
      report.status = 'rejected';
      report.timeline.push({ action: 'flagged-fake', note: payload.reason, by: req.user._id });
      await Notification.create({ user: report.reportedBy, type: 'flagged-fake', title: 'Your report was closed', message: `"${report.title}" was reviewed and closed: ${payload.reason}`, link: `/issues/${report._id}`, report: report._id });
    } else if (action === 'mark-duplicate') {
      const target = await IncidentReport.findById(payload.duplicateOf);
      if (!target || String(target._id) === String(report._id)) return res.status(422).json({ error: 'Pick a valid original report' });
      report.duplicateOf = target._id;
      report.status = 'duplicate';
      target.confirmations += 1;
      await target.save();
      report.timeline.push({ action: 'marked-duplicate', note: `Merged into "${target.title}"`, by: req.user._id });
      await Notification.create({ user: report.reportedBy, type: 'duplicate', title: 'Report merged', message: `Your report was merged with an existing one: "${target.title}", which is already being tracked.`, link: `/issues/${target._id}`, report: target._id });
    } else {
      return res.status(422).json({ error: 'Unknown action' });
    }

    await report.save();
    res.json({ report: serializeReport(report, req.user._id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;