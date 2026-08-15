const express = require('express');
const Authority = require('../models/Authority');
const Review = require('../models/Review');
const IncidentReport = require('../models/IncidentReport');
const { protect } = require('../middleware/auth');
const { suggestAuthoritiesForArea } = require('../utils/authorityAI');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const { district = '' } = req.query;
    const filter = {};
    if (district) filter.district = new RegExp(`^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const authorities = await Authority.find(filter).sort({ ratingAvg: -1, name: 1 });
    res.json({ authorities });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can add authorities' });
    const { name, department, district, categories, contactEmail, contactPhone } = req.body;
    if (!name) return res.status(422).json({ error: 'Authority name is required' });
    const authority = await Authority.create({
      name, department: department || '', district: district || '',
      categories: Array.isArray(categories) ? categories : [],
      contactEmail: contactEmail || '', contactPhone: contactPhone || '',
      source: 'admin', createdBy: req.user._id,
    });
    res.status(201).json({ authority });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'That authority already exists for this district' });
    res.status(500).json({ error: err.message });
  }
});

// Rule-based "AI" pass: fills in any authority types this district is
// missing (roads, disaster mgmt, water, electricity, urban dev, ward office).
router.post('/ai-suggest', protect, async (req, res) => {
  try {
    if (!['admin', 'analyst'].includes(req.user.role)) return res.status(403).json({ error: 'Only admins or analysts can run area suggestions' });
    const { district } = req.body;
    if (!district) return res.status(422).json({ error: 'District is required' });
    const existing = await Authority.find({ district: new RegExp(`^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('name');
    const toCreate = await suggestAuthoritiesForArea(district, new Set(existing.map(a => a.name)));
    const created = toCreate.length ? await Authority.insertMany(toCreate.map(a => ({ ...a, createdBy: req.user._id }))) : [];
    res.status(201).json({ created, message: created.length ? `Added ${created.length} authority(ies) for ${district}` : `${district} already has full coverage` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ranks authorities by rating, completion rate, and average resolution time.
// "Assigned" reports are those handed to an authority (assigned/in-progress/
// completed) — pending/verified reports haven't reached an authority yet, so
// they're excluded from completion-rate math.
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const authorities = await Authority.find().lean();

    const stats = await IncidentReport.aggregate([
      { $match: { assignedDepartment: { $ne: '' }, status: { $in: ['assigned', 'in-progress', 'completed'] } } },
      {
        $group: {
          _id: '$assignedDepartment',
          totalAssigned: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          avgResolutionMs: {
            $avg: {
              $cond: [
                { $and: [{ $eq: ['$status', 'completed'] }, { $ne: ['$completedAt', null] }] },
                { $subtract: ['$completedAt', '$createdAt'] },
                null,
              ],
            },
          },
        },
      },
    ]);

    const statsByName = Object.fromEntries(stats.map(s => [s._id, s]));

    const leaderboard = authorities.map(a => {
      const s = statsByName[a.name];
      const totalAssigned = s?.totalAssigned || 0;
      const completed = s?.completed || 0;
      const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : null;
      const resolutionDays = s?.avgResolutionMs ? Math.round((s.avgResolutionMs / (1000 * 60 * 60 * 24)) * 10) / 10 : null;
      return {
        _id: a._id, name: a.name, department: a.department, district: a.district,
        ratingAvg: a.ratingAvg || 0, ratingCount: a.ratingCount || 0,
        totalAssigned, completed, completionRate, resolutionDays,
      };
    });

    // Rank by completion rate first, then rating, as tiebreaker
    leaderboard.sort((a, b) => {
      const cr = (b.completionRate ?? -1) - (a.completionRate ?? -1);
      if (cr !== 0) return cr;
      return (b.ratingAvg || 0) - (a.ratingAvg || 0);
    });

    res.json({ leaderboard });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/reviews', protect, async (req, res) => {
  try {
    const reviews = await Review.find({ authority: req.params.id }).sort({ createdAt: -1 }).populate('user', 'name role avatarHue');
    res.json({ reviews });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const authority = await Authority.findById(req.params.id);
    if (!authority) return res.status(404).json({ error: 'Authority not found' });
    const rating = Number(req.body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return res.status(422).json({ error: 'Rating must be between 1 and 5' });
    const comment = (req.body.comment || '').trim();

    // A rating tied to a specific report is a stronger, harder-to-abuse
    // signal than an open review, so when one is provided we verify it's
    // real: it belongs to the reviewer, it's actually been resolved, and
    // this authority is the one that handled it.
    let reportId = null;
    if (req.body.report) {
      const report = await IncidentReport.findById(req.body.report);
      if (!report) return res.status(404).json({ error: 'Report not found' });
      if (String(report.reportedBy) !== String(req.user._id)) return res.status(403).json({ error: 'You can only rate an authority using your own report' });
      if (report.status !== 'completed') return res.status(422).json({ error: 'You can rate an authority once your report is marked complete' });
      if (report.assignedDepartment !== authority.name) return res.status(422).json({ error: 'This report was not handled by this authority' });
      reportId = report._id;
    }

    // One rating per report, editable rather than stackable — resubmitting
    // updates your existing review instead of inflating the count.
    const existing = reportId ? await Review.findOne({ authority: authority._id, report: reportId, user: req.user._id }) : null;

    if (existing) {
      const total = authority.ratingAvg * authority.ratingCount - existing.rating + rating;
      authority.ratingAvg = Math.round((total / authority.ratingCount) * 10) / 10;
      existing.rating = rating;
      existing.comment = comment;
      await Promise.all([existing.save(), authority.save()]);
      await existing.populate('user', 'name role avatarHue');
      return res.json({ review: existing, authority, updated: true });
    }

    const review = await Review.create({ authority: authority._id, report: reportId, user: req.user._id, rating, comment });
    const total = authority.ratingAvg * authority.ratingCount + rating;
    authority.ratingCount += 1;
    authority.ratingAvg = Math.round((total / authority.ratingCount) * 10) / 10;
    await authority.save();

    await review.populate('user', 'name role avatarHue');
    res.status(201).json({ review, authority });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;