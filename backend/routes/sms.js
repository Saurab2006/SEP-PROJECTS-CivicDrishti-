const express = require('express');
const User = require('../models/User');
const IncidentReport = require('../models/IncidentReport');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { parseInboundSms, helpText, sendSms, normalizePhone, VALID_CATEGORIES } = require('../utils/sms');
const { classifyFreeText, embedText, looksNepali } = require('../utils/civicAI');

const router = express.Router();

function estimateDays(category, severity) {
  const base = { flood: 3, 'road-damage': 7, 'tunnel-blockage': 2, 'bridge-damage': 10, landslide: 5, drainage: 4, electrical: 1, 'water-supply': 3, other: 5 }[category] || 5;
  const factor = { critical: 0.5, high: 0.75, medium: 1, low: 1.3 }[severity] ?? 1;
  return Math.max(1, Math.round(base * factor));
}
function addDays(days) { const d = new Date(); d.setDate(d.getDate() + Number(days || 0)); return d; }

async function findOrCreateSmsUser(phone) {
  let user = await User.findOne({ phone });
  if (user) return user;
  user = await User.create({
    name: `SMS Reporter ${phone.slice(-4)}`,
    email: `sms-${phone}@no-reply.govinsight.local`,
    password: Math.random().toString(36).slice(2) + Date.now(), // unusable random password; account logs in only via phone match
    role: 'researcher',
    organization: 'SMS Reporter',
    jobTitle: 'Citizen Reporter',
    phone,
    verificationStatus: 'n/a',
  });
  return user;
}

// Inbound webhook — no JWT auth, matches phone number to identity instead.
router.post('/inbound', async (req, res) => {
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
      let report = null;
      if (cmd.ref) {
        report = (await IncidentReport.findById(cmd.ref).catch(() => null))
          || (await IncidentReport.findOne({ _id: { $regex: `${cmd.ref}$` } }).catch(() => null));
      }
      if (!report) {
        report = await IncidentReport.findOne({ reporterContact: phone }).sort({ createdAt: -1 });
      }
      reply = report
        ? `Report "${report.title}" — status: ${report.status}${report.assignedDepartment ? ` (${report.assignedDepartment})` : ''}. ID: ${String(report._id).slice(-6)}`
        : 'No matching report found. Text your report ID, or REPORT to file a new one.';
    } else if (cmd.type === 'report') {
      let category = cmd.category;
      let aiNote = '';
      if (!category && cmd.description) {
        // No recognized category keyword — ask Gemini to classify the free
        // text instead of immediately rejecting the report.
        const guess = await classifyFreeText(cmd.description);
        if (guess.category) { category = guess.category; aiNote = ' (AI-classified from your message)'; }
      }
      if (!category) {
        reply = `Category not recognized. Valid categories: ${VALID_CATEGORIES.join(', ')}`;
      } else {
        const smsUser = await findOrCreateSmsUser(phone);
        const title = (cmd.description || category).slice(0, 80);
        const description = cmd.description || category;
        const days = estimateDays(category, 'medium');
        const [translation, embedding] = await Promise.all([
          looksNepali(description) ? classifyFreeText(description) : null,
          embedText(`${cmd.district || ''} — ${description}`),
        ]);
        const report = await IncidentReport.create({
          title, category, description, severity: 'medium',
          location: { address: cmd.district || 'Unspecified (via SMS)', district: cmd.district || '' },
          reporterContact: phone,
          reportedBy: smsUser._id,
          status: 'pending',
          estimatedDays: days,
          dueDate: addDays(days),
          embedding: embedding || undefined,
          language: translation?.language || (looksNepali(description) ? 'ne' : 'en'),
          translatedDescription: translation?.translatedText || '',
          viaSms: true,
          timeline: [{ action: 'reported', note: 'Submitted via SMS' + aiNote, by: smsUser._id }],
        });
        await Promise.all((await User.find({ role: { $in: ['admin', 'analyst'] } }).select('_id')).map(u =>
          Notification.create({ user: u._id, type: 'new-report', title: 'New community report (SMS)', message: `${title} — ${cmd.district || 'location unspecified'}`, link: `/issues/${report._id}`, report: report._id })
        ));
        reply = `Report received${aiNote}. ID: ${String(report._id).slice(-6)}. Text STATUS ${String(report._id).slice(-6)} to check progress.`;
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

// Admin-only test send, e.g. to verify Twilio config from Settings.
router.post('/send-test', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can send test SMS' });
    const { to, message } = req.body || {};
    if (!to || !message) return res.status(422).json({ error: 'to and message are required' });
    const result = await sendSms(to, message);
    if (!result.ok) return res.status(502).json({ error: result.error || 'SMS send failed' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;