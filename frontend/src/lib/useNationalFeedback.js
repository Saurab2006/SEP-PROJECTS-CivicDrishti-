'use client';
import { useEffect, useMemo, useState } from 'react';
import { get } from '@/lib/api';
import { DEMO_NATIONAL_FEEDBACK, PROVINCES } from '@/lib/nationalFeedbackDemoData';

// Real budget locations are free-typed at signup ("Koshi", "Koshi Province",
// "koshi pradesh"...), so incoming province strings are normalized against
// the fixed 7-province list wherever possible. This keeps a citizen's real
// feedback filterable/groupable alongside the demo rows instead of silently
// sitting in an "unmatched" bucket.
export function normalizeProvince(raw) {
  const cleaned = String(raw || '').replace(/\s*(province|pradesh)\s*$/i, '').trim();
  const match = PROVINCES.find(p => p.toLowerCase() === cleaned.toLowerCase());
  return match || cleaned;
}
export function normalizeWard(raw) {
  return String(raw || '').replace(/^ward\s+/i, '').trim().replace(/^0+(?=\d)/, '');
}

// Location comes from the project the feedback was left on (the API already
// falls back to the citizen's own registered location only when the project
// itself has none on file), so a real submission is always discoverable
// under the exact Province -> District -> Municipality -> Ward it was filed
// against, even for accounts that never filled in a home ward.
function normalizeLiveRow(r) {
  const registeredWard = normalizeWard(r.user?.ward);
  return {
    id: r._id,
    citizenName: r.user?.name || '',
    isAnonymous: !r.user?.name,
    province: normalizeProvince(r.province) || 'Unspecified',
    district: r.district || 'Unspecified',
    municipality: r.municipality || 'Unspecified',
    ward: normalizeWard(r.ward),
    registeredWard,
    project: r.project || 'Public budget project',
    sector: r.sector || 'Other',
    fiscalYear: r.fiscalYear || '',
    feedbackType: r.verdict,
    comment: r.comment || '',
    date: r.createdAt,
    hasPhoto: !!r.photo,
    photoUrl: r.photo || '',
    photoColor: '',
    verificationStatus: r.moderationStatus === 'approved' ? 'Verified' : r.moderationStatus === 'pending' ? 'Pending Review' : 'Unverified',
    isDemo: false,
  };
}

// Fetches every citizen's real community feedback and merges it with the
// illustrative demo dataset. Used by both the Public Budget page (full board
// + leaderboard) and the Authorities page (leaderboard only), so a new
// submission anywhere shows up in both places the next time either loads -
// there is exactly one place this data is fetched and normalized.
export function useNationalFeedback() {
  const [liveRows, setLiveRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get('/api/budgets/feedback/all')
      .then(r => { if (!cancelled) setLiveRows((r.feedback || []).map(normalizeLiveRow)); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Real, citizen-submitted feedback is shown first, then the illustrative
  // demo rows fill out coverage across all 7 provinces.
  const rows = useMemo(() => [...liveRows, ...DEMO_NATIONAL_FEEDBACK], [liveRows]);

  return { rows, loading, error };
}