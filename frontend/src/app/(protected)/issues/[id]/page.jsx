'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, post, patch } from '@/lib/api';
import { relativeTime, cn, initials, formatNPR } from '@/lib/format';
import { toast } from 'sonner';
import {
  ArrowLeft, MapPin, Clock, Copy, ShieldAlert, CheckCircle2, UserCheck,
  PlayCircle, Loader2, Star, Map as MapIcon, Radio, Plus, ShieldCheck, ShieldQuestion, ThumbsUp, MessageCircle, Send,
   Camera, RotateCcw, Languages, XCircle, ArrowRightLeft, Siren, ThumbsDown, Building2, Link2, Unlink,
} from 'lucide-react';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

const REOPEN_WINDOW_DAYS = 7;

const REPORTER_VERIFICATION_STYLE = {
  verified: { label: 'ID verified', icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  pending: { label: 'ID pending review', icon: ShieldQuestion, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  rejected: { label: 'ID rejected', icon: ShieldAlert, cls: 'bg-red-50 text-red-700 border-red-100' },
};
import { useAuth } from '@/context/AuthContext';

const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  verified: 'bg-blue-50 text-blue-700 border-blue-100',
  assigned: 'bg-violet-50 text-violet-700 border-violet-100',
  'in-progress': 'bg-cyan-50 text-cyan-700 border-cyan-100',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  closed: 'bg-teal-50 text-teal-700 border-teal-100',
  rejected: 'bg-gray-100 text-gray-500 border-gray-200',
  duplicate: 'bg-gray-100 text-gray-500 border-gray-200',
};

const LIVE_STEPS = ['pending', 'verified', 'assigned', 'in-progress', 'completed', 'closed'];

export default function ReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'municipality_head' || user?.role === 'ward_rep';

  const [report, setReport] = useState(null);
  const [meta, setMeta] = useState({ categories: [], authorities: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [etaDays, setEtaDays] = useState('');
  const [assignDept, setAssignDept] = useState('');
  const [assignContact, setAssignContact] = useState('');
  const [fakeReason, setFakeReason] = useState('');
  const [showFakeBox, setShowFakeBox] = useState(false);

  const [showCompleteBox, setShowCompleteBox] = useState(false);
  const [completeNote, setCompleteNote] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState('');
  const [resolutionPhotoName, setResolutionPhotoName] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  const [showReopenBox, setShowReopenBox] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenBusy, setReopenBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [showTransferBox, setShowTransferBox] = useState(false);
  const [transferDept, setTransferDept] = useState('');
  const [transferContact, setTransferContact] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const [showEscalateBox, setShowEscalateBox] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  const [showDismissDupBox, setShowDismissDupBox] = useState(false);
  const [dismissDupReason, setDismissDupReason] = useState('');
  
  const [projectDetail, setProjectDetail] = useState(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [projectQuery, setProjectQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectBusy, setProjectBusy] = useState(false);

  const [authority, setAuthority] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [showIdDoc, setShowIdDoc] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [communityBusy, setCommunityBusy] = useState(false);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([get(`/api/reports/${id}`), get('/api/reports/meta')])
      .then(([r, m]) => {
        setReport(r.report); setMeta(m); setEtaDays(String(r.report.estimatedDays));
        setAssignDept(r.report.assignedDepartment || m.authorities[0]); setAssignContact(r.report.assignedContact || '');
        setTransferDept(m.authorities.find(a => a !== r.report.assignedDepartment) || m.authorities[0]);
      })
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  
  useEffect(() => {
    if (!report?.project?._id) { setProjectDetail(null); return; }
    get(`/api/budgets/projects/${report.project._id}`).then(({ project }) => setProjectDetail(project)).catch(() => {});
  }, [report?.project?._id]);

  useEffect(() => {
    if (!report?.assignedDepartment) { setAuthority(null); setReviews([]); return; }
    get('/api/authorities').then(({ authorities }) => {
      const match = authorities.find(a => a.name === report.assignedDepartment) || null;
      setAuthority(match);
      if (match) get(`/api/authorities/${match._id}/reviews`).then(({ reviews }) => setReviews(reviews)).catch(() => {});
    }).catch(() => {});
    // eslint-disable-next-line
  }, [report?.assignedDepartment]);

  const refreshReviews = () => {
    if (!authority) return;
    get('/api/authorities').then(({ authorities }) => setAuthority(authorities.find(a => a._id === authority._id) || authority)).catch(() => {});
    get(`/api/authorities/${authority._id}/reviews`).then(({ reviews }) => setReviews(reviews)).catch(() => {});
  };

  const act = async (action, payload, successMsg) => {
    setBusy(true);
    try {
      const { report: updated } = await patch(`/api/reports/${id}`, { action, ...payload });
      setReport(prev => ({ ...updated, duplicates: prev.duplicates }));
      toast.success(successMsg);
      load();
    } catch (err) { toast.error(err.message); }
    setBusy(false);
  };

  const toggleSupport = async () => {
    if (user?.verificationStatus !== 'verified') { setShowVerifyPrompt(true); return; }
    setCommunityBusy(true);
    try {
      const { report: updated } = await post(`/api/reports/${id}/support`, {});
      setReport(prev => ({ ...updated, duplicates: prev?.duplicates || [] }));
    } catch (err) { toast.error(err.message); }
    setCommunityBusy(false);
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!commentText.trim()) return;
    if (user?.verificationStatus !== 'verified') { setShowVerifyPrompt(true); return; }
    setCommunityBusy(true);
    try {
      const { report: updated } = await post(`/api/reports/${id}/comments`, { text: commentText.trim() });
      setReport(prev => ({ ...updated, duplicates: prev?.duplicates || [] }));
      setCommentText('');
      toast.success('Comment added');
    } catch (err) { toast.error(err.message); }
    setCommunityBusy(false);
  };

  const handleResolutionPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setResolutionPhoto(dataUrl);
      setResolutionPhotoName(file.name);
    } catch (err) { toast.error(err.message); }
    setPhotoBusy(false);
  };

  const confirmComplete = async () => {
    await act('complete', { note: completeNote, resolutionPhoto, resolutionPhotoName }, 'Marked complete - reporters notified');
    setShowCompleteBox(false); setCompleteNote(''); setResolutionPhoto(''); setResolutionPhotoName('');
  };

  const doReopen = async () => {
    if (!reopenReason.trim()) { toast.error('Tell us what still needs fixing'); return; }
    setReopenBusy(true);
    try {
      const { report: updated } = await post(`/api/reports/${id}/reopen`, { reason: reopenReason.trim() });
      setReport(prev => ({ ...updated, duplicates: prev?.duplicates || [] }));
      toast.success('Report reopened');
      setShowReopenBox(false);
      setReopenReason('');
    } catch (err) { toast.error(err.message); }
    setReopenBusy(false);
  };

  const doConfirm = async () => {
    setConfirmBusy(true);
    try {
      const { report: updated } = await post(`/api/reports/${id}/confirm`, {});
      setReport(prev => ({ ...updated, duplicates: prev?.duplicates || [] }));
      toast.success('Thanks for confirming - issue closed');
    } catch (err) { toast.error(err.message); }
    setConfirmBusy(false);
  };

  const doReject = async () => {
    if (!rejectReason.trim()) { toast.error('A reason is required to reject this report'); return; }
    await act('reject', { reason: rejectReason.trim() }, 'Report rejected');
    setShowRejectBox(false); setRejectReason('');
  };

  const doTransfer = async () => {
    if (!transferDept) { toast.error('Choose a destination authority'); return; }
    if (!transferReason.trim()) { toast.error('A reason is required to transfer this report'); return; }
    await act('transfer', { assignedDepartment: transferDept, assignedContact: transferContact, reason: transferReason.trim() }, 'Report transferred');
    setShowTransferBox(false); setTransferReason(''); setTransferContact('');
  };

  const doEscalate = async () => {
    await act('escalate', { reason: escalateReason.trim() }, 'Report escalated');
    setShowEscalateBox(false); setEscalateReason('');
  };

  const doMergeDuplicate = async () => {
    await act('mark-duplicate', {}, 'Merged as duplicate');
  };

  const doDismissDuplicate = async () => {
    await act('dismiss-duplicate', { reason: dismissDupReason.trim() }, report.duplicateOf ? 'Marked as a separate issue' : 'Dismissed duplicate suggestion');
    setShowDismissDupBox(false); setDismissDupReason('');
  };
  
  const loadProjectOptions = () => {
    const params = new URLSearchParams();
    if (report.location?.district) params.set('district', report.location.district);
    if (report.location?.municipality) params.set('municipality', report.location.municipality);
    if (report.location?.ward) params.set('ward', report.location.ward);
    if (projectQuery.trim()) params.set('q', projectQuery.trim());
    get(`/api/budgets/projects?${params.toString()}`).then(({ projects }) => setProjectOptions(projects || [])).catch(() => toast.error('Could not load projects'));
  };

  const doLinkProject = async () => {
    if (!selectedProjectId) { toast.error('Choose a project first'); return; }
    setProjectBusy(true);
    await act('link-project', { projectId: selectedProjectId }, 'Linked to project');
    setProjectBusy(false);
    setShowProjectPicker(false); setSelectedProjectId('');
  };

  const doUnlinkProject = async () => {
    setProjectBusy(true);
    await act('unlink-project', {}, 'Project link removed');
    setProjectBusy(false);
  };

  if (loading) return <div className="max-w-[900px] mx-auto space-y-4"><div className="shimmer h-8 w-40 rounded-lg" /><div className="shimmer h-64 rounded-2xl" /></div>;
  if (!report) return <div className="max-w-[900px] mx-auto text-center py-16 text-gray-400">Report not found.</div>;

  const categoryLabel = meta.categories.find(c => c.value === report.category)?.label || report.category;
  const isOwner = report.reportedBy && user && String(report.reportedBy._id) === String(user._id);

  const canConfirm = report.status === 'completed' && isOwner;
  const reopenAnchor = report.citizenConfirmedAt || report.completedAt;
  const reopenDeadline = reopenAnchor ? new Date(new Date(reopenAnchor).getTime() + REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000) : null;
  const canReopen = ['completed', 'closed'].includes(report.status) && (isOwner || isStaff) && (!reopenDeadline || Date.now() < reopenDeadline.getTime());

  const canManage = isStaff && !['completed', 'closed', 'rejected'].includes(report.status);

  return (
    <>
    {showVerifyPrompt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-center gap-2 text-gray-900"><ShieldCheck className="h-5 w-5 text-brand-500" /><h3 className="text-base font-bold">Verify yourself first</h3></div>
          <p className="mt-2 text-sm text-gray-500">You need to verify your identity before you can comment or support a report. Head to Settings to upload your citizenship certificate and take a live selfie.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setShowVerifyPrompt(false)} className="h-9 rounded-lg px-3 text-sm font-semibold text-gray-500 hover:bg-gray-100">Cancel</button>
            <button onClick={() => router.push('/settings')} className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">Go to Settings</button>
          </div>
        </div>
      </div>
    )}
    <div className="max-w-[900px] mx-auto space-y-5">
      <button onClick={() => router.push('/issues')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft className="w-4 h-4" />Back to Community Reports</button>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border', STATUS_STYLE[report.status])}>{report.status.replace('-', ' ')}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md bg-gray-100 text-gray-600">{report.severity}</span>
              {report.isFake && <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md bg-red-50 text-red-700 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Flagged fake</span>}
              {report.escalated && <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md bg-orange-50 text-orange-700 flex items-center gap-1"><Siren className="w-3 h-3" />Escalated</span>}
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-2">{report.title}</h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{report.location.address}{report.location.district ? `, ${report.location.district}` : ''}{report.location.ward ? `, Ward ${report.location.ward}` : ''}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{categoryLabel}</p>
            <p className="text-xs text-gray-400 mt-1">Reported {relativeTime(report.createdAt)}</p>
          </div>
        </div>

        {report.status === 'rejected' && report.rejectionReason && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1"><XCircle className="w-3 h-3" />Rejected</p>
            <p className="text-sm text-gray-700 mt-1">{report.rejectionReason}</p>
          </div>
        )}

        {report.escalated && report.escalationReason && (
          <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700 flex items-center gap-1"><Siren className="w-3 h-3" />Escalation reason</p>
            <p className="text-sm text-orange-900 mt-1">{report.escalationReason}</p>
          </div>
        )}

        <p className="text-sm text-gray-700 leading-relaxed">{report.description}</p>
        {report.translatedDescription && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 flex items-center gap-1"><Languages className="w-3 h-3" />Translated (AI)</p>
            <p className="text-sm text-blue-900 mt-1">{report.translatedDescription}</p>
          </div>
        )}

        {(report.photo || report.resolutionPhoto) && (
          <div className={cn('grid gap-3 mt-3', report.photo && report.resolutionPhoto ? 'sm:grid-cols-2' : '')}>
            {report.photo && (
              <div>
                {report.resolutionPhoto && <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Reported</p>}
                <img src={report.photo} alt="Report evidence" className="max-h-[360px] w-full rounded-xl border border-gray-100 object-cover" />
              </div>
            )}
            {report.resolutionPhoto && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Proof of resolution</p>
                <img src={report.resolutionPhoto} alt="Resolution evidence" className="max-h-[360px] w-full rounded-xl border border-emerald-100 object-cover" />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <InfoPill icon={Clock} label={['completed', 'closed'].includes(report.status) ? `Resolved ${relativeTime(report.completedAt)}` : `AI estimate: ${report.estimatedDays} day(s) - due ${new Date(report.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} />
          {report.confirmations > 1 && <InfoPill icon={Copy} label={`${report.confirmations} citizens reported this issue`} />}
          {report.assignedDepartment && <InfoPill icon={UserCheck} label={`Assigned to ${report.assignedDepartment}${report.assignedContact ? ` - ${report.assignedContact}` : ''}`} />}
        </div>

        {report.reportedBy && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-50 flex-wrap">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: `linear-gradient(135deg, hsl(${report.reportedBy.avatarHue} 65% 52%), hsl(${(report.reportedBy.avatarHue + 40) % 360} 60% 45%))` }}>{initials(report.reportedBy.name)}</div>
            <p className="text-xs text-gray-500">Reported by <span className="font-medium text-gray-700">{report.reportedBy.name}</span>{report.reporterContact ? ` - ${report.reporterContact}` : ''}</p>
            {isStaff && report.reportedBy.verificationStatus && REPORTER_VERIFICATION_STYLE[report.reportedBy.verificationStatus] && (() => {
              const v = REPORTER_VERIFICATION_STYLE[report.reportedBy.verificationStatus];
              return (
                <button type="button" onClick={() => setShowIdDoc(true)} className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border hover:opacity-80', v.cls)}>
                  <v.icon className="w-3 h-3" />{v.label}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {isStaff && (report.possibleDuplicateOf || (report.duplicateOf && report.status === 'duplicate')) && (
        <DuplicateReviewCard report={report} onMerge={doMergeDuplicate} onDismiss={doDismissDuplicate} busy={busy} showDismissBox={showDismissDupBox} setShowDismissBox={setShowDismissDupBox} dismissReason={dismissDupReason} setDismissReason={setDismissDupReason} />
      )}
      <LinkedProjectCard
        report={report} projectDetail={projectDetail} isStaff={isStaff}
        showPicker={showProjectPicker} setShowPicker={setShowProjectPicker}
        projectOptions={projectOptions} loadOptions={loadProjectOptions}
        projectQuery={projectQuery} setProjectQuery={setProjectQuery}
        selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId}
        onLink={doLinkProject} onUnlink={doUnlinkProject} busy={projectBusy}
      />
      {!['rejected', 'duplicate'].includes(report.status) && <LiveTrackingCard report={report} />}

      <CommunityCard report={report} commentText={commentText} setCommentText={setCommentText} busy={communityBusy} onSupport={toggleSupport} onComment={submitComment} />

      <MapCard location={report.location} />

      {canManage && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-gray-900">Manage this report</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Assign to authority</p>
              <div className="flex gap-2">
                <select value={assignDept} onChange={e => setAssignDept(e.target.value)} className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500">
                  {meta.authorities.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <input value={assignContact} onChange={e => setAssignContact(e.target.value)} placeholder="Contact person (optional)" className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500" />
              <button disabled={busy} onClick={() => act('assign', { assignedDepartment: assignDept, assignedContact: assignContact }, 'Assigned')} className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-60">Assign</button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">AI-suggested completion (editable)</p>
              <div className="flex gap-2">
                <input type="number" min="1" value={etaDays} onChange={e => setEtaDays(e.target.value)} className="w-24 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500" />
                <span className="text-xs text-gray-500 self-center">day(s)</span>
                <button disabled={busy} onClick={() => act('set-eta', { estimatedDays: etaDays }, 'Estimate updated')} className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-60">Save</button>
              </div>
              <div className="flex gap-1.5">
                {[1, 3, 7].map(extra => (
                  <button key={extra} type="button" disabled={busy} onClick={() => setEtaDays(String((Number(etaDays) || 0) + extra))} className="h-7 px-2 rounded-md border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                    <Plus className="w-3 h-3" />{extra}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
            {report.status === 'pending' && <ActionButton icon={CheckCircle2} label="Verify" onClick={() => act('verify', {}, 'Marked verified')} busy={busy} />}
            {['assigned', 'verified'].includes(report.status) && <ActionButton icon={PlayCircle} label="Start work" onClick={() => act('start', {}, 'Work started')} busy={busy} />}
            <ActionButton icon={CheckCircle2} label="Mark completed" tone="success" onClick={() => setShowCompleteBox(s => !s)} busy={busy} />
            <ActionButton icon={ArrowRightLeft} label="Transfer" onClick={() => setShowTransferBox(s => !s)} busy={busy} />
            {!report.escalated && <ActionButton icon={Siren} label="Escalate" onClick={() => setShowEscalateBox(s => !s)} busy={busy} />}
            <ActionButton icon={XCircle} label="Reject" tone="danger" onClick={() => setShowRejectBox(s => !s)} busy={busy} />
            <ActionButton icon={ShieldAlert} label="Flag as fake" tone="danger" onClick={() => setShowFakeBox(s => !s)} busy={busy} />
          </div>

          {showCompleteBox && (
            <div className="space-y-2 pt-1">
              <input value={completeNote} onChange={e => setCompleteNote(e.target.value)} placeholder="Optional note about how it was resolved" className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500" />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />{photoBusy ? 'Reading photo...' : resolutionPhotoName || 'Attach proof photo (optional)'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleResolutionPhoto} disabled={photoBusy} />
                </label>
                {resolutionPhoto && <button type="button" onClick={() => { setResolutionPhoto(''); setResolutionPhotoName(''); }} className="text-xs text-gray-400 hover:text-gray-600">Remove</button>}
              </div>
              {resolutionPhoto && <img src={resolutionPhoto} alt="Proof preview" className="max-h-40 rounded-lg border border-gray-100 object-cover" />}
              <button disabled={busy || photoBusy} onClick={confirmComplete} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60">Confirm complete</button>
            </div>
          )}

          {showTransferBox && (
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <select value={transferDept} onChange={e => setTransferDept(e.target.value)} className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500">
                  {meta.authorities.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input value={transferContact} onChange={e => setTransferContact(e.target.value)} placeholder="Contact (optional)" className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500" />
              </div>
              <input value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Why is this being transferred?" className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500" />
              <button disabled={busy || !transferReason.trim()} onClick={doTransfer} className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-60">Confirm transfer</button>
            </div>
          )}

          {showEscalateBox && (
            <div className="flex gap-2 pt-1">
              <input value={escalateReason} onChange={e => setEscalateReason(e.target.value)} placeholder="Why does this need urgent attention? (optional)" className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-orange-400" />
              <button disabled={busy} onClick={doEscalate} className="h-9 px-3 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 disabled:opacity-60">Confirm escalate</button>
            </div>
          )}

          {showRejectBox && (
            <div className="flex gap-2 pt-1">
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why is this being rejected?" className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-red-400" />
              <button disabled={busy || !rejectReason.trim()} onClick={doReject} className="h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60">Confirm reject</button>
            </div>
          )}

          {showFakeBox && (
            <div className="flex gap-2 pt-1">
              <input value={fakeReason} onChange={e => setFakeReason(e.target.value)} placeholder="Why is this report fake or invalid?" className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-red-400" />
              <button disabled={busy || !fakeReason.trim()} onClick={() => act('mark-fake', { reason: fakeReason }, 'Report closed as fake').then(() => setShowFakeBox(false))} className="h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60">Confirm</button>
            </div>
          )}
        </div>
      )}

      {canConfirm && (
        <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />Was this actually fixed?</h3>
            <p className="mt-1 text-xs text-gray-500">An official marked this complete. Please confirm so we can close it out - or tell us it's still not fixed.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={confirmBusy} onClick={doConfirm} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {confirmBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}Yes, it's fixed
            </button>
            {!showReopenBox && <ActionButton icon={ThumbsDown} label="No, still broken" onClick={() => setShowReopenBox(true)} busy={reopenBusy} />}
          </div>
          {showReopenBox && (
            <div className="flex gap-2">
              <input value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="What still needs fixing?" className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-amber-400" />
              <button disabled={reopenBusy || !reopenReason.trim()} onClick={doReopen} className="h-9 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-60">
                {reopenBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Reopen'}
              </button>
            </div>
          )}
        </div>
      )}

      {!canConfirm && canReopen && (
        <div className="bg-white rounded-2xl border border-amber-100 p-6 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><RotateCcw className="w-4 h-4 text-amber-600" />Not actually fixed?</h3>
              <p className="mt-1 text-xs text-gray-500">
                {isOwner ? 'You can reopen this within ' : 'The reporter (or staff) can reopen this within '}
                {reopenDeadline ? `${Math.max(0, Math.ceil((reopenDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} day(s)` : `${REOPEN_WINDOW_DAYS} days`} of it being marked complete.
              </p>
            </div>
            {!showReopenBox && <ActionButton icon={RotateCcw} label="Reopen report" onClick={() => setShowReopenBox(true)} busy={reopenBusy} />}
          </div>
          {showReopenBox && (
            <div className="flex gap-2">
              <input value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="What still needs fixing?" className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-amber-400" />
              <button disabled={reopenBusy || !reopenReason.trim()} onClick={doReopen} className="h-9 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-60">
                {reopenBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Reopen'}
              </button>
            </div>
          )}
        </div>
      )}

      {report.duplicates?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Copy className="w-4 h-4 text-gray-400" />Other reports of the same issue ({report.duplicates.length})</h3>
          <div className="space-y-2">
            {report.duplicates.map(d => (
              <div key={d._id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-600">{d.reportedBy?.name || 'Citizen'} - {relativeTime(d.createdAt)}</span>
                <span className="text-gray-400">{d.location.address}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Timeline</h3>
        <div className="space-y-4">
          {report.timeline.slice().reverse().map((t, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-brand-500" /></div>
              <div>
                <p className="text-xs font-semibold text-gray-800 capitalize">{t.action.replace(/-/g, ' ')}{t.by ? ` - ${t.by.name}` : ''}</p>
                {t.note && <p className="text-xs text-gray-500 mt-0.5">{t.note}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">{relativeTime(t.at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {report.assignedDepartment && (
        <ReviewsCard authority={authority} authorityName={report.assignedDepartment} reportId={report._id} reviews={reviews} onChanged={refreshReviews} canRate={['completed', 'closed'].includes(report.status)} currentUserId={user?._id} />
      )}
    </div>
    {showIdDoc && isStaff && report.reportedBy && (
      <IdDocModal userId={report.reportedBy._id} userName={report.reportedBy.name} onClose={() => setShowIdDoc(false)} />
    )}
    </>
  );
}

function IdDocModal({ userId, userName, onClose }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get(`/api/users/${userId}/citizenship-doc`).then(d => { setDoc(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  }, [userId]);

  const isPdf = doc?.citizenshipDoc?.startsWith('data:application/pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-sm font-semibold text-gray-900">Identity document - {userName}</h3>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : error ? (
            <p className="text-sm text-gray-500">{error}</p>
          ) : isPdf ? (
            <a href={doc.citizenshipDoc} target="_blank" rel="noreferrer" className="text-sm text-brand-600 font-medium underline">Open PDF - {doc.citizenshipDocName}</a>
          ) : (
            <img src={doc.citizenshipDoc} alt="Citizenship document" className="w-full rounded-xl border border-gray-100" />
          )}
        </div>
      </div>
    </div>
  );
}

function DuplicateReviewCard({ report, onMerge, onDismiss, busy, showDismissBox, setShowDismissBox, dismissReason, setDismissReason }) {
  const isConfirmed = Boolean(report.duplicateOf);
  const target = isConfirmed ? report.duplicateOf : report.possibleDuplicateOf;
  const similarity = isConfirmed ? report.duplicateSimilarity : report.possibleDuplicateSimilarity;
  if (!target) return null;

  return (
    <div className="bg-white rounded-2xl border border-violet-100 p-6 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Copy className="w-4 h-4 text-violet-600" />
            {isConfirmed ? 'Merged as duplicate' : 'Possible duplicate'}
            {similarity != null && <span className="text-xs font-medium text-violet-600">- {similarity}% similarity</span>}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {isConfirmed ? 'This report is currently linked to: ' : 'AI detected a similar existing report: '}
            <span className="font-medium text-gray-700">{target.title}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isConfirmed && <ActionButton icon={Copy} label="Merge" tone="success" onClick={onMerge} busy={busy} />}
          {!showDismissBox && <ActionButton icon={XCircle} label={isConfirmed ? 'Keep Separate' : 'Not Duplicate'} onClick={() => setShowDismissBox(true)} busy={busy} />}
        </div>
      </div>
      {showDismissBox && (
        <div className="flex gap-2">
          <input value={dismissReason} onChange={e => setDismissReason(e.target.value)} placeholder="Why is this a separate issue? (optional)" className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-gray-400" />
          <button disabled={busy} onClick={onDismiss} className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-60">Confirm</button>
        </div>
      )}
    </div>
  );
}
function LinkedProjectCard({ report, projectDetail, isStaff, showPicker, setShowPicker, projectOptions, loadOptions, projectQuery, setProjectQuery, selectedProjectId, setSelectedProjectId, onLink, onUnlink, busy }) {
  const hasProject = Boolean(report.project);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-brand-500" />Linked Project</h3>
        {isStaff && hasProject && <ActionButton icon={Unlink} label="Unlink" onClick={onUnlink} busy={busy} />}
        {isStaff && !hasProject && !showPicker && <ActionButton icon={Link2} label="Link to a project" onClick={() => { setShowPicker(true); loadOptions(); }} busy={busy} />}
      </div>

      {hasProject ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{report.location.ward ? `Ward ${report.location.ward}` : 'Ward'}</span>
            <span>-</span>
            <span className="font-medium text-gray-700">{report.project.name}</span>
          </div>
          <p className="text-xs text-gray-400">{report.project.sector} - <span className="capitalize">{report.project.status}</span></p>
          {projectDetail ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-50">
              <MiniStat label="Approved Budget" value={formatNPR(projectDetail.approvedBudget)} />
              <MiniStat label="Revised Budget" value={projectDetail.revisedBudget != null ? formatNPR(projectDetail.revisedBudget) : 'Not revised'} />
              <MiniStat label="Expenditure" value={formatNPR(projectDetail.expenditure)} />
              <MiniStat label="Remaining" value={formatNPR(projectDetail.remaining)} />
              <div className="col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Physical Progress</p>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, projectDetail.physicalProgress)}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{projectDetail.physicalProgress}% complete</p>
              </div>
            </div>
          ) : (
            <div className="shimmer h-16 rounded-lg" />
          )}
        </div>
      ) : showPicker ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={projectQuery} onChange={e => setProjectQuery(e.target.value)} placeholder="Search projects..." className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500" />
            <button onClick={loadOptions} className="h-9 px-3 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200">Search</button>
          </div>
          <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500">
            <option value="">Select a project...</option>
            {projectOptions.map(p => <option key={p._id} value={p._id}>{p.name} ({p.sector} - {p.status})</option>)}
          </select>
          {projectOptions.length === 0 && <p className="text-xs text-gray-400">No projects found for this ward yet.</p>}
          <div className="flex gap-2">
            <button disabled={busy || !selectedProjectId} onClick={onLink} className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-60">Link project</button>
            <button onClick={() => setShowPicker(false)} className="h-9 px-3 rounded-lg text-gray-500 text-xs font-semibold hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">{isStaff ? 'Not yet linked to a project.' : 'This issue is not yet linked to a government project.'}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p></div>;
}
function LiveTrackingCard({ report }) {
  const stepIndex = LIVE_STEPS.indexOf(report.status);
  const dueDate = report.dueDate ? new Date(report.dueDate) : null;
  const overdue = dueDate && !['completed', 'closed'].includes(report.status) && dueDate.getTime() < Date.now();
  const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Radio className="w-4 h-4 text-brand-500" />Live tracking</h3>
        {!['completed', 'closed'].includes(report.status) && (
          <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md', overdue ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600')}>
            {overdue ? `${Math.abs(daysLeft)} day(s) overdue` : daysLeft != null ? `${daysLeft} day(s) left` : ''}
          </span>
        )}
      </div>
      <div className="flex items-center">
        {LIVE_STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-1 last:flex-initial">
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border-2',
              i <= stepIndex ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-gray-200 text-gray-300')}>
              {i <= stepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < LIVE_STEPS.length - 1 && <div className={cn('h-0.5 flex-1 mx-1', i < stepIndex ? 'bg-brand-500' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-medium text-gray-400 uppercase tracking-wide -mt-2">
        {LIVE_STEPS.map(step => <span key={step} className="flex-1 text-center first:text-left last:text-right">{step.replace('-', ' ')}</span>)}
      </div>
    </div>
  );
}

function CommunityCard({ report, commentText, setCommentText, busy, onSupport, onComment }) {
  const comments = report.comments || [];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-brand-500" />Community signal</h3>
          <p className="mt-1 text-xs text-gray-500">Citizens can support the report and add public context.</p>
        </div>
        <button disabled={busy} onClick={onSupport} className={cn('inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-60', report.hasSupported ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-brand-50 text-brand-700 hover:bg-brand-100')}>
          <ThumbsUp className="w-4 h-4" />{report.hasSupported ? 'Supported' : 'Support'} - {report.supportCount || 0}
        </button>
      </div>

      <form onSubmit={onComment} className="flex gap-2">
        <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a short public update or context" className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand-500" />
        <button disabled={busy || !commentText.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"><Send className="w-3.5 h-3.5" />Post</button>
      </form>

      <div className="space-y-3 border-t border-gray-50 pt-3">
        {comments.length === 0 ? <p className="text-xs text-gray-400">No public comments yet.</p> : comments.slice().reverse().map(comment => (
          <div key={comment._id || comment.createdAt} className="flex gap-3 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">{initials(comment.user?.name || 'Citizen')}</div>
            <div>
              <p className="font-semibold text-gray-800">{comment.user?.name || 'Citizen'} <span className="font-normal text-gray-400">- {relativeTime(comment.createdAt)}</span></p>
              <p className="mt-0.5 text-gray-600">{comment.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapCard({ location }) {
  const hasCoords = Number.isFinite(location?.lat) && Number.isFinite(location?.lng);
  const lat = location?.lat;
  const lng = location?.lng;
  const bbox = hasCoords ? `${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}` : '';
  const mapSrc = hasCoords ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}` : '';
  const mapLink = hasCoords ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}` : '';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><MapIcon className="w-4 h-4 text-gray-400" />Location</h3>
      {hasCoords ? (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          <iframe title="Report location" className="w-full h-64" src={mapSrc} />
          <a className="block text-center text-xs text-brand-600 hover:underline py-2 bg-gray-50" href={mapLink} target="_blank" rel="noreferrer">
            Open larger map
          </a>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
          No GPS coordinates were pinned for this report - only the written address is available.
        </div>
      )}
    </div>
  );
}

function ReviewsCard({ authority, authorityName, reportId, reviews, onChanged, canRate, currentUserId }) {
  const myReview = currentUserId ? reviews.find(r => r.user?._id === currentUserId) : null;
  const [rating, setRating] = useState(myReview?.rating || 5);
  const [comment, setComment] = useState(myReview?.comment || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (myReview) { setRating(myReview.rating); setComment(myReview.comment || ''); }
    // eslint-disable-next-line
  }, [myReview?._id]);

  const submitReview = async () => {
    if (!authority) { toast.error("This authority isn't registered yet - ask an admin to add it"); return; }
    setSubmitting(true);
    try {
      await post(`/api/authorities/${authority._id}/reviews`, { rating, comment, report: reportId });
      toast.success(myReview ? 'Review updated' : 'Review submitted');
      onChanged();
    } catch (err) { toast.error(err.message); }
    setSubmitting(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Reviews - {authorityName}</h3>
        {authority && (
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{authority.ratingAvg?.toFixed(1) || '0.0'}
            <span className="text-gray-400 font-normal">({authority.ratingCount || 0})</span>
          </span>
        )}
      </div>

      {canRate ? (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)}>
                <Star className={cn('w-5 h-5', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200')} />
              </button>
            ))}
          </div>
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="How is this authority handling it?" className="flex-1 min-w-[180px] h-9 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-brand-500" />
          <button disabled={submitting} onClick={submitReview} className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-60">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : myReview ? 'Update review' : 'Submit review'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">You'll be able to rate {authorityName} once this report is marked complete.</p>
      )}

      <div className="space-y-3 pt-2 border-t border-gray-50">
        {reviews.length === 0 ? (
          <p className="text-xs text-gray-400">No reviews yet - be the first to rate this authority.</p>
        ) : reviews.map(r => (
          <div key={r._id} className="flex items-start justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => <Star key={n} className={cn('w-3 h-3', n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200')} />)}
                <span className="font-medium text-gray-700 ml-1">{r.user?.name || 'User'}{r.user?._id === currentUserId ? ' (you)' : ''}</span>
              </div>
              {r.comment && <p className="text-gray-500 mt-0.5">{r.comment}</p>}
            </div>
            <span className="text-[10px] text-gray-400 shrink-0">{relativeTime(r.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoPill({ icon: Icon, label }) {
  return <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5"><Icon className="w-3.5 h-3.5 text-gray-400" />{label}</span>;
}

function ActionButton({ icon: Icon, label, onClick, busy, tone }) {
  const toneClass = tone === 'danger' ? 'bg-red-50 text-red-700 hover:bg-red-100' : tone === 'success' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  return (
    <button disabled={busy} onClick={onClick} className={cn('h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60', toneClass)}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}{label}
    </button>
  );
}