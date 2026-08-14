const SEVERITY_SCORE = { low: 8, medium: 18, high: 34, critical: 55 };
const CATEGORY_URGENCY = { electrical: 12, flood: 10, landslide: 10, 'bridge-damage': 9, 'water-supply': 7, drainage: 6, 'road-damage': 5, 'tunnel-blockage': 5, other: 3 };

function priorityLevel(score) {
  if (score >= 75) return 'critical';
  if (score >= 52) return 'high';
  if (score >= 28) return 'medium';
  return 'low';
}

function calculateIssuePriority(report, supportCount = 0, wardCitizenCount = 0) {
  const created = new Date(report.createdAt || Date.now()).getTime();
  const ageHours = Math.max(0, (Date.now() - created) / 36e5);
  const wardShare = wardCitizenCount > 0 ? Math.min(25, Math.round((supportCount / wardCitizenCount) * 100)) : 0;
  const score = Math.min(100, Math.round((SEVERITY_SCORE[report.severity] || 18) + (CATEGORY_URGENCY[report.category] || 3) + Math.min(22, supportCount * 4) + wardShare + Math.min(8, ageHours / 24)));
  return {
    score,
    level: priorityLevel(score),
    reason: supportCount + ' ward support' + (supportCount === 1 ? '' : 's') + ', ' + (report.severity || 'medium') + ' severity, ' + (report.category || 'general') + ' category',
    escalated: score >= 52 || supportCount >= 5 || (wardCitizenCount > 0 && supportCount / wardCitizenCount >= 0.05),
  };
}

module.exports = { calculateIssuePriority };
