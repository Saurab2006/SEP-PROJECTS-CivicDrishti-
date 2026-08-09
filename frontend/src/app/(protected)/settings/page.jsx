'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { initials } from '@/lib/format';
import { post } from '@/lib/api';
import { toast } from 'sonner';
import { MailCheck, Megaphone, Send } from 'lucide-react';

export default function SettingsPage() {
  const { user, verifyEmail, resendEmailOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState({ title: '', message: '', priority: 'important', audience: 'all', durationValue: 24, durationUnit: 'hours' });
  const [sending, setSending] = useState(false);
  if (!user) return null;

  const submitOtp = async (e) => {
    e.preventDefault();
    setVerifying(true);
    try { await verifyEmail(otp); setOtp(''); toast.success('Email verified'); }
    catch (err) { toast.error(err.message); }
    setVerifying(false);
  };

  const resendOtp = async () => {
    try { await resendEmailOtp(); toast.success('Verification code sent'); }
    catch (err) { toast.error(err.message); }
  };

  const sendNotice = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const d = await post('/api/notices', notice);
      toast.success(`Notice sent to ${d.emailed || 0} user(s)`);
      setNotice({ title: '', message: '', priority: 'important', audience: 'all', durationValue: 24, durationUnit: 'hours' });
    } catch (err) { toast.error(err.message); }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-[980px] space-y-5">
      <div><h1 className="text-2xl font-bold text-[#102a2b]">Settings</h1><p className="mt-1 text-sm text-[#65706c]">Profile, email verification, and admin notices</p></div>
      <div className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#0f3d3e] text-lg font-bold text-white">{initials(user.name)}</div>
          <div>
            <p className="text-lg font-bold text-[#102a2b]">{user.name}</p>
            <p className="text-sm text-[#65706c]">{user.email}</p>
            <div className="mt-1 flex flex-wrap gap-2"><span className="rounded-md bg-[#eef6f4] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0f3d3e]">{user.role}</span><span className={user.emailVerified ? 'rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700' : 'rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700'}>{user.emailVerified ? 'Email verified' : 'Email pending'}</span></div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[{ l: 'Full Name', v: user.name }, { l: 'Email', v: user.email }, { l: 'Role', v: user.role }, { l: 'Organization', v: user.organization || '-' }, { l: 'Job Title', v: user.jobTitle || '-' }, { l: 'Member Since', v: new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }].map((f, i) => (
            <div key={i}><label className="mb-1 block text-xs font-medium text-[#8c8272]">{f.l}</label><div className="flex h-10 items-center rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 text-sm text-[#102a2b]">{f.v}</div></div>
          ))}
        </div>
      </div>

      {!user.emailVerified && <form onSubmit={submitOtp} className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#102a2b]"><MailCheck className="h-4 w-4 text-[#dc143c]" />Verify email</h2>
        <p className="mt-1 text-sm text-[#65706c]">Enter the 6-digit code sent to your email.</p>
        <div className="mt-4 flex flex-wrap gap-2"><input value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" className="h-10 w-44 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]" /><button disabled={verifying || otp.length < 6} className="h-10 rounded-lg bg-[#dc143c] px-4 text-sm font-black text-white disabled:opacity-50">Verify</button><button type="button" onClick={resendOtp} className="h-10 rounded-lg border border-[#ded6c8] px-4 text-sm font-black text-[#0f3d3e] hover:bg-[#fffaf2]">Resend code</button></div>
      </form>}

      {user.role === 'admin' && <form onSubmit={sendNotice} className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#102a2b]"><Megaphone className="h-4 w-4 text-[#dc143c]" />Send important notice</h2>
        <p className="mt-1 text-sm text-[#65706c]">Shows at the top of the app and sends an email to the selected audience.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={notice.title} onChange={e => setNotice(n => ({ ...n, title: e.target.value }))} placeholder="Notice title" className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] sm:col-span-2" />
          <select value={notice.audience} onChange={e => setNotice(n => ({ ...n, audience: e.target.value }))} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]"><option value="all">All users</option><option value="researcher">Citizens</option><option value="analyst">Analysts</option><option value="admin">Admins</option></select>
          <select value={notice.priority} onChange={e => setNotice(n => ({ ...n, priority: e.target.value }))} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]"><option value="important">Important</option><option value="urgent">Urgent</option><option value="normal">Normal</option></select>
          <textarea value={notice.message} onChange={e => setNotice(n => ({ ...n, message: e.target.value }))} placeholder="Write the notice people must see" className="min-h-28 rounded-lg border border-[#ded6c8] px-3 py-2 text-sm outline-none focus:border-[#0f3d3e] sm:col-span-2" />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[#8c8272]">Notice stays visible for</label>
            <div className="flex gap-2">
              <input type="number" min="1" value={notice.durationValue} onChange={e => setNotice(n => ({ ...n, durationValue: e.target.value }))} className="h-10 w-24 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]" />
              <select value={notice.durationUnit} onChange={e => setNotice(n => ({ ...n, durationUnit: e.target.value }))} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]"><option value="hours">Hours</option><option value="days">Days</option></select>
              <span className="flex items-center text-xs text-[#8c8272]">Default: 24 hours</span>
            </div>
          </div>
        </div>
        <button disabled={sending || !notice.title.trim() || !notice.message.trim()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f3d3e] px-4 text-sm font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />Send notice + email</button>
      </form>}
    </div>
  );
}