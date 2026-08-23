'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { initials } from '@/lib/format';
import { post } from '@/lib/api';
import { toast } from 'sonner';
import { Bell, BellOff, Camera, CheckCircle2, Download, FileCheck2, Languages, MailCheck, MapPinned, Megaphone, Send, ShieldCheck, Share, Smartphone, Sun, UploadCloud, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useInstallPrompt } from '@/lib/useInstallPrompt';
import { getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from '@/lib/push';
import SelfieCapture from '@/components/SelfieCapture';
import { loadFaceModels, getFaceDescriptor, compareDescriptors, loadImageFromDataUrl } from '@/lib/faceMatch';

function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the file')); reader.readAsDataURL(file); }); }

const PROVINCE_OPTIONS = ['Koshi Province', 'Madhesh Province', 'Bagmati Province', 'Gandaki Province', 'Lumbini Province', 'Karnali Province', 'Sudurpashchim Province'];

export default function SettingsPage() {
  const { user, verifyEmail, resendEmailOtp, verifyIdentity, updateLocation } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState({ title: '', message: '', priority: 'important', audience: 'all', durationValue: 24, durationUnit: 'hours' });
  const [sending, setSending] = useState(false);
  const [docFile, setDocFile] = useState(null);
  const [docError, setDocError] = useState('');
  const [citizenshipNumber, setCitizenshipNumber] = useState('');
  const [citizenshipNumberError, setCitizenshipNumberError] = useState('');
  const [selfieDataUrl, setSelfieDataUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [faceChecking, setFaceChecking] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [address, setAddress] = useState({ province: user?.civicLocation?.province || '', district: user?.civicLocation?.district || '', municipality: user?.civicLocation?.municipality || '', ward: user?.civicLocation?.ward || '' });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState('');
  if (!user) return null;

  const ADDRESS_COOLDOWN_DAYS = 180;
  const nextAddressChangeAt = user.lastAddressChangeAt ? new Date(new Date(user.lastAddressChangeAt).getTime() + ADDRESS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) : null;
  const addressLocked = !!(nextAddressChangeAt && nextAddressChangeAt.getTime() > Date.now());

  const submitOtp = async (e) => {
    e.preventDefault();
    setVerifying(true);
    try { await verifyEmail(otp); setOtp(''); toast.success(t('settings.emailVerified')); }
    catch (err) { toast.error(err.message); }
    setVerifying(false);
  };

  const handleDocChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/|^application\/pdf$/.test(file.type)) { setDocError('Upload an image or PDF'); return; }
    if (file.size > 8 * 1024 * 1024) { setDocError('File is too large. Max 8MB'); return; }
    setDocError('');
    try { setDocFile({ name: file.name, dataUrl: await fileToDataUrl(file) }); }
    catch { setDocError('Could not read that file. Try again.'); }
  };

  const submitVerification = async () => {
    setFaceError('');
    setCitizenshipNumberError('');
    if (!docFile) { setDocError('Citizenship certificate or national ID is required'); return; }
    if (!citizenshipNumber.trim()) { setCitizenshipNumberError('Citizenship number is required'); return; }
    if (!selfieDataUrl) { setFaceError('Please take a live selfie to verify your identity.'); return; }
    setFaceChecking(true);
    let faceMatchScore = null;
    try {
      await loadFaceModels();
      const idImg = await loadImageFromDataUrl(docFile.dataUrl);
      const selfieImg = await loadImageFromDataUrl(selfieDataUrl);
      const idDescriptor = await getFaceDescriptor(idImg);
      const selfieDescriptor = await getFaceDescriptor(selfieImg);
      if (!idDescriptor) { setFaceError('No face detected on your ID photo. Please upload a clearer photo.'); setFaceChecking(false); return; }
      if (!selfieDescriptor) { setFaceError('No face detected in your selfie. Please try again.'); setFaceChecking(false); return; }
      const distance = compareDescriptors(idDescriptor, selfieDescriptor);
      if (distance > 0.6) { setFaceError("Your live photo doesn't match your ID. Please try again."); setFaceChecking(false); return; }
      faceMatchScore = 1 - distance;
    } catch { setFaceError('Could not verify your face. Please try again.'); setFaceChecking(false); return; }
    try {
      await verifyIdentity({ citizenshipDoc: docFile.dataUrl, citizenshipDocName: docFile.name, citizenshipNumber: citizenshipNumber.trim(), selfiePhoto: selfieDataUrl, faceMatchScore });
      toast.success('Identity verified');
      setDocFile(null); setSelfieDataUrl(null); setCitizenshipNumber('');
    } catch (err) { setCitizenshipNumberError(err.message); }
    setFaceChecking(false);
  };

  const submitAddress = async (e) => {
    e.preventDefault();
    setAddressError('');
    if (!address.district.trim() || !address.municipality.trim() || !address.ward.trim()) { setAddressError('District, municipality and ward are required'); return; }
    setAddressSaving(true);
    try { await updateLocation(address); toast.success('Address updated'); }
    catch (err) { setAddressError(err.message); }
    setAddressSaving(false);
  };

  const resendOtp = async () => {
    try { await resendEmailOtp(); toast.success(t('common.recently')); }
    catch (err) { toast.error(err.message); }
  };

  const sendNotice = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const d = await post('/api/notices', notice);
      toast.success(`${t('settings.sendNoticeButton')}: ${d.emailed || 0}`);
      setNotice({ title: '', message: '', priority: 'important', audience: 'all', durationValue: 24, durationUnit: 'hours' });
    } catch (err) { toast.error(err.message); }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-[980px] space-y-5">
      <div><h1 className="text-2xl font-bold text-[#102a2b]">{t('settings.title')}</h1><p className="mt-1 text-sm text-[#65706c]">{t('settings.subtitle')}</p></div>
      <div className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#0f3d3e] text-lg font-bold text-white">{initials(user.name)}</div>
          <div>
            <p className="text-lg font-bold text-[#102a2b]">{user.name}</p>
            <p className="text-sm text-[#65706c]">{user.email}</p>
            <div className="mt-1 flex flex-wrap gap-2"><span className="rounded-md bg-[#eef6f4] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0f3d3e]">{user.role}</span><span className={user.emailVerified ? 'rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700' : 'rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700'}>{user.emailVerified ? t('settings.emailVerified') : t('settings.emailPending')}</span></div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[{ l: t('settings.fullName'), v: user.name }, { l: t('settings.email'), v: user.email }, { l: t('settings.role'), v: user.role }, { l: t('settings.organization'), v: user.organization || '-' }, { l: t('settings.jobTitle'), v: user.jobTitle || '-' }, { l: t('settings.memberSince'), v: new Date(user.createdAt).toLocaleDateString(locale === 'ne' ? 'ne-NP' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }].map((f, i) => (
            <div key={i}><label className="mb-1 block text-xs font-medium text-[#8c8272]">{f.l}</label><div className="flex h-10 items-center rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm text-[#102a2b]">{f.v}</div></div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm lg:hidden">
        <h2 className="text-sm font-black text-[#102a2b]">{t('settings.preferences')}</h2>
        <p className="mt-1 text-sm text-[#65706c]">{t('settings.preferencesSub')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-white text-[#0f3d3e]"><Languages className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-bold text-[#102a2b]">{t('settings.language')}</p>
                <p className="text-xs text-[#8c8272]">{locale === 'en' ? 'English' : 'नेपाली'}</p>
              </div>
            </div>
            <div className="flex gap-1 rounded-lg border border-[#ded6c8] bg-white p-1">
              <button type="button" onClick={() => setLocale('en')} className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${locale === 'en' ? 'bg-[#0f3d3e] text-white' : 'text-[#65706c] hover:bg-[#fffaf2]'}`}>EN</button>
              <button type="button" onClick={() => setLocale('ne')} className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${locale === 'ne' ? 'bg-[#0f3d3e] text-white' : 'text-[#65706c] hover:bg-[#fffaf2]'}`}>नेपाली</button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-white text-[#0f3d3e]"><Sun className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-bold text-[#102a2b]">{t('settings.appearance')}</p>
                <p className="text-xs text-[#8c8272]">{t('settings.dayNightMode')}</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <AppNotificationsCard t={t} />

      {['researcher', 'ward_rep'].includes(user.role) && <form onSubmit={submitAddress} className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#102a2b]"><MapPinned className="h-4 w-4 text-[#dc143c]" />Your ward / address</h2>
        <p className="mt-1 text-sm text-[#65706c]">Update your civic address so local reports and supports count in the correct ward.</p>
        {addressLocked && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">You can change your address again on {nextAddressChangeAt.toLocaleDateString(locale === 'ne' ? 'ne-NP' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Address changes are limited to once every 6 months.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select disabled={addressLocked} value={address.province} onChange={e => setAddress(a => ({ ...a, province: e.target.value }))} className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:opacity-50">
            <option value="">Select province</option>
            {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input disabled={addressLocked} value={address.district} onChange={e => setAddress(a => ({ ...a, district: e.target.value }))} placeholder="District" className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:opacity-50" />
          <input disabled={addressLocked} value={address.municipality} onChange={e => setAddress(a => ({ ...a, municipality: e.target.value }))} placeholder="Municipality" className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:opacity-50" />
          <input disabled={addressLocked} type="number" min="1" value={address.ward} onChange={e => setAddress(a => ({ ...a, ward: e.target.value }))} placeholder="Ward" className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:opacity-50" />
        </div>
        {addressError && <span className="mt-2 block text-xs text-[#dc143c]">{addressError}</span>}
        <button type="submit" disabled={addressSaving || addressLocked} className="mt-4 h-10 rounded-lg bg-[#0f3d3e] px-4 text-sm font-black text-white disabled:opacity-50">{addressSaving ? 'Saving...' : 'Save address'}</button>
      </form>}

      {['researcher', 'ward_rep'].includes(user.role) && user.verificationStatus !== 'verified' && <div className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#102a2b]"><ShieldCheck className="h-4 w-4 text-[#dc143c]" />Verify your identity</h2>
        <p className="mt-1 text-sm text-[#65706c]">Upload your citizenship certificate or national ID, enter your citizenship number, then take a live selfie.</p>
        <div className="mt-4 grid gap-3">
          <input value={citizenshipNumber} onChange={e => setCitizenshipNumber(e.target.value)} placeholder="Citizenship number" className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm outline-none focus:border-[#0f3d3e]" />
          {citizenshipNumberError && <span className="text-xs text-[#dc143c]">{citizenshipNumberError}</span>}
          {!docFile ? <label className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#ded6c8] bg-[#fffaf2] text-sm text-[#65706c]"><UploadCloud className="h-5 w-5" />Upload image or PDF, max 8MB<input type="file" accept="image/*,application/pdf" onChange={handleDocChange} className="hidden" /></label> : <div className="flex h-10 items-center justify-between rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm"><span className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" />{docFile.name}</span><button type="button" onClick={() => setDocFile(null)}><X className="h-4 w-4" /></button></div>}
          {docError && <span className="text-xs text-[#dc143c]">{docError}</span>}
          {!selfieDataUrl ? <button type="button" onClick={() => setShowCamera(true)} className="flex h-24 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#ded6c8] bg-[#fffaf2] text-sm text-[#65706c]"><Camera className="h-5 w-5" />Click to take a live photo</button> : <div className="flex h-10 items-center justify-between rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#0f3d3e]" />Selfie captured</span><button type="button" onClick={() => setSelfieDataUrl(null)}><X className="h-4 w-4" /></button></div>}
          {faceError && <span className="text-xs text-[#dc143c]">{faceError}</span>}
          {faceChecking && <span className="text-xs text-[#65706c]">Verifying your face, please wait...</span>}
        </div>
        {showCamera && <SelfieCapture onCapture={(dataUrl) => { setSelfieDataUrl(dataUrl); setShowCamera(false); }} onClose={() => setShowCamera(false)} />}
        <button type="button" disabled={faceChecking} onClick={submitVerification} className="mt-4 h-10 rounded-lg bg-[#dc143c] px-4 text-sm font-black text-white disabled:opacity-50">{faceChecking ? 'Verifying...' : 'Verify identity'}</button>
      </div>}


      {!user.emailVerified && <form onSubmit={submitOtp} className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#102a2b]"><MailCheck className="h-4 w-4 text-[#dc143c]" />{t('settings.verifyEmail')}</h2>
        <p className="mt-1 text-sm text-[#65706c]">{t('settings.verifyEmailSub')}</p>
        <div className="mt-4 flex flex-wrap gap-2"><input value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" className="h-10 w-44 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]" /><button disabled={verifying || otp.length < 6} className="h-10 rounded-lg bg-[#dc143c] px-4 text-sm font-black text-white disabled:opacity-50">{t('settings.verify')}</button><button type="button" onClick={resendOtp} className="h-10 rounded-lg border border-[#ded6c8] px-4 text-sm font-black text-[#0f3d3e] hover:bg-[#fffaf2]">{t('settings.resendCode')}</button></div>
      </form>}

      {user.role === 'admin' && <form onSubmit={sendNotice} className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#102a2b]"><Megaphone className="h-4 w-4 text-[#dc143c]" />{t('settings.sendNotice')}</h2>
        <p className="mt-1 text-sm text-[#65706c]">{t('settings.sendNoticeSub')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={notice.title} onChange={e => setNotice(n => ({ ...n, title: e.target.value }))} placeholder={t('settings.noticeTitle')} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] sm:col-span-2" />
          <select value={notice.audience} onChange={e => setNotice(n => ({ ...n, audience: e.target.value }))} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]"><option value="all">{t('settings.allUsers')}</option><option value="researcher">{t('settings.citizens')}</option><option value="municipality head">{t('settings.municipalityHeads')}</option><option value="admin">{t('settings.admins')}</option></select>
          <select value={notice.priority} onChange={e => setNotice(n => ({ ...n, priority: e.target.value }))} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]"><option value="important">{t('settings.important')}</option><option value="urgent">{t('settings.urgent')}</option><option value="normal">{t('settings.normal')}</option></select>
          <textarea value={notice.message} onChange={e => setNotice(n => ({ ...n, message: e.target.value }))} placeholder={t('settings.noticeMessagePlaceholder')} className="min-h-28 rounded-lg border border-[#ded6c8] px-3 py-2 text-sm outline-none focus:border-[#0f3d3e] sm:col-span-2" />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[#8c8272]">{t('settings.noticeStaysVisible')}</label>
            <div className="flex gap-2">
              <input type="number" min="1" value={notice.durationValue} onChange={e => setNotice(n => ({ ...n, durationValue: e.target.value }))} className="h-10 w-24 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]" />
              <select value={notice.durationUnit} onChange={e => setNotice(n => ({ ...n, durationUnit: e.target.value }))} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]"><option value="hours">{t('settings.hours')}</option><option value="days">{t('settings.days')}</option></select>
              <span className="flex items-center text-xs text-[#8c8272]">{t('settings.defaultDuration')}</span>
            </div>
          </div>
        </div>
        <button disabled={sending || !notice.title.trim() || !notice.message.trim()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f3d3e] px-4 text-sm font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />{t('settings.sendNoticeButton')}</button>
      </form>}
    </div>
  );
}

function AppNotificationsCard({ t }) {
  const { canInstall, installed, promptInstall, isIOSSafari } = useInstallPrompt();
  const [push, setPush] = useState({ supported: true, subscribed: false, permission: 'default' });
  const [busy, setBusy] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    getPushSubscriptionState().then(setPush).catch(() => {});
  }, []);

  const install = async () => {
    if (isIOSSafari) { setShowIOSTip((v) => !v); return; }
    const accepted = await promptInstall();
    if (accepted) toast.success(t('settings.installAppInstalled'));
  };

  const togglePush = async () => {
    setBusy(true);
    try {
      if (push.subscribed) {
        await unsubscribeFromPush();
        setPush(s => ({ ...s, subscribed: false }));
        toast.success(t('settings.pushDisable'));
      } else {
        await subscribeToPush();
        setPush(s => ({ ...s, subscribed: true, permission: 'granted' }));
        toast.success(t('settings.pushEnabled'));
      }
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const pushBlocked = push.permission === 'denied';
  const pushUnsupported = !push.supported;

  return (
    <div className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-black text-[#102a2b]"><Smartphone className="h-4 w-4 text-[#dc143c]" />{t('settings.appNotifications')}</h2>
      <p className="mt-1 text-sm text-[#65706c]">{t('settings.appNotificationsSub')}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-[#0f3d3e]"><Download className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-bold text-[#102a2b]">{t('settings.installApp')}</p>
                <p className="text-xs text-[#8c8272]">
                  {installed
                    ? t('settings.installAppInstalled')
                    : canInstall
                      ? t('settings.installAppSub')
                      : isIOSSafari
                        ? t('settings.installAppSub')
                        : t('settings.installAppUnsupported')}
                </p>
              </div>
            </div>
            {!installed && (
              <button
                onClick={install}
                disabled={!canInstall && !isIOSSafari}
                className="shrink-0 rounded-lg bg-[#0f3d3e] px-3 py-1.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isIOSSafari ? t('settings.installButtonIOS') : t('settings.installButton')}
              </button>
            )}
          </div>
          {!installed && isIOSSafari && showIOSTip && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-[#ded6c8] bg-white px-3 py-2">
              <Share className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0f3d3e]" />
              <p className="text-xs text-[#65706c]">{t('settings.installAppIOS')}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-[#0f3d3e]">{push.subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}</div>
            <div>
              <p className="text-sm font-bold text-[#102a2b]">{t('settings.pushNotifications')}</p>
              <p className="text-xs text-[#8c8272]">
                {pushUnsupported ? t('settings.pushUnsupported') : pushBlocked ? t('settings.pushBlocked') : push.subscribed ? t('settings.pushEnabled') : t('settings.pushNotificationsSub')}
              </p>
            </div>
          </div>
          <button onClick={togglePush} disabled={busy || pushUnsupported || pushBlocked} className="shrink-0 rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-black text-[#0f3d3e] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
            {push.subscribed ? t('settings.pushDisable') : t('settings.pushEnable')}
          </button>
        </div>
      </div>
    </div>
  );
}