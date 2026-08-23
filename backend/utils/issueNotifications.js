const Notification = require('../models/Notification');
const User = require('../models/User');

function wardLocation(report) { return report.location || {}; }
function sameWardCitizenQuery(report) {
  const l = wardLocation(report);
  return {
    role: 'researcher', status: 'active', verificationStatus: 'verified',
    'civicLocation.province': l.province || '',
    'civicLocation.district': l.district || '',
    'civicLocation.municipality': l.municipality || '',
    'civicLocation.ward': String(l.ward || ''),
  };
}

async function notifyWardCitizens(report, excludeUserId) {
  const citizens = await User.find(sameWardCitizenQuery(report)).select('_id');
  const rows = citizens.filter(u => String(u._id) !== String(excludeUserId || '')).map(u => ({
    user: u._id, type: 'ward-issue', title: 'New issue in your ward',
    message: 'A citizen reported   + report.title +   in your ward. Open it to verify or support if it affects you.',
    link: '/issues/' + report._id, report: report._id,
  }));
  if (rows.length) await Notification.insertMany(rows, { ordered: false }).catch(() => null);
}

async function notifyWardRepresentative(report, payload = {}) {
  const l = wardLocation(report);
  const reps = await User.find({ role: 'ward_rep', status: 'active', 'wardRepresentativeApplication.status': 'approved', 'wardRepresentativeApplication.district': l.district || '', 'wardRepresentativeApplication.municipality': l.municipality || '', 'wardRepresentativeApplication.ward': String(l.ward || '') }).select('_id');
  if (reps.length) await Notification.insertMany(reps.map(u => ({ user: u._id, type: payload.type || 'ward-community-issue', title: payload.title || 'Ward issue needs review', message: payload.message || ('  + report.title +   is inside your assigned ward.'), link: '/issues/' + report._id, report: report._id })), { ordered: false }).catch(() => null);
}

async function notifyMunicipalityHead(report, payload = {}) {
  const l = wardLocation(report);
  const heads = await User.find({ role: 'municipality_head', status: 'active', 'municipalityHeadProfile.district': l.district || '', 'municipalityHeadProfile.municipality': l.municipality || '' }).select('_id');
  if (heads.length) await Notification.insertMany(heads.map(u => ({ user: u._id, type: payload.type || 'municipality-escalation', title: payload.title || 'Municipality issue escalation', message: payload.message || ('  + report.title +   needs municipality attention.'), link: '/issues/' + report._id, report: report._id })), { ordered: false }).catch(() => null);
}

module.exports = { notifyWardCitizens, notifyWardRepresentative, notifyMunicipalityHead, sameWardCitizenQuery };
