'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { post } from '@/lib/api';
import CivicAuthShell from '@/components/CivicAuthShell';
import styles from '@/styles/civicAuth.module.css';
import { Eye, EyeOff, Loader2, LockKeyhole, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ defaultValues: { email: '', password: '', remember: true } });

  const onSubmit = async (values) => {
    setError('');
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
    } catch (err) { setError(err.message); }
  };

  const requestReset = async (event) => {
    event.preventDefault();
    setResetBusy(true);
    try {
      await post('/api/auth/forgot-password', { email: resetEmail });
      setResetSent(true);
      toast.success('Reset code sent if the email exists');
    } catch (err) { toast.error(err.message); }
    setResetBusy(false);
  };

  const confirmReset = async (event) => {
    event.preventDefault();
    setResetBusy(true);
    try {
      await post('/api/auth/reset-password', { email: resetEmail, otp: resetCode, password: newPassword });
      toast.success('Password changed. You can log in now.');
      setMode('login');
      setValue('email', resetEmail);
      setResetCode('');
      setNewPassword('');
    } catch (err) { toast.error(err.message); }
    setResetBusy(false);
  };

  const demoFill = (email, pass) => { setMode('login'); setValue('email', email); setValue('password', pass); };

  return (
    <CivicAuthShell activeTab="login">
      {mode === 'login' ? (
        <>
          <h1 className={styles.pageTitle}>Welcome back</h1>
          <p className={styles.pageSub}>Track reports, ward budgets, and public work from one clean civic dashboard.</p>
          {error && <div className={styles.errorBox}>{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)}>
            <label className={styles.label}>Email <span className={styles.labelNp}>इमेल</span></label>
            <input type="email" placeholder="" className={`${styles.input} ${errors.email ? styles.inputError : ''}`} {...register('email', { required: 'Email is required' })} />
            {errors.email && <span className={styles.errMsg}>{errors.email.message}</span>}
            <label className={styles.label}>Password <span className={styles.labelNp}>पासवर्ड</span></label>
            <div className={styles.inputWrap}>
              <input type={showPw ? 'text' : 'password'} placeholder="" className={`${styles.input} ${errors.password ? styles.inputError : ''}`} style={{ paddingRight: 40 }} {...register('password', { required: 'Password is required' })} />
              <button type="button" onClick={() => setShowPw(v => !v)} className={styles.inputIconBtn} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            {errors.password && <span className={styles.errMsg}>{errors.password.message}</span>}
            <div className={styles.checkboxRow} style={{ justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: 0 }}><input type="checkbox" {...register('remember')} />Keep me signed in</label>
              <button type="button" onClick={() => setMode('reset')} className={styles.metaNote} style={{ textDecoration: 'underline' }}>Forgot password?</button>
            </div>
            <button type="submit" disabled={isSubmitting} className={styles.btn}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}Log in</button>
          </form>
          <div className={styles.divider}>Quick demo access</div>
          <div className={styles.demoGrid}>{[['Admin','admin@govinsight.np','admin123'],['Officer','analyst@govinsight.np','analyst123'],['Citizen','researcher@govinsight.np','researcher123']].map(([label,email,pass]) => <button key={label} type="button" onClick={() => demoFill(email, pass)} className={styles.demoChip}>{label}</button>)}</div>
          <div className={styles.footNote}>No account? <Link href="/signup">Join Civicदृष्टि</Link></div>
        </>
      ) : (
        <>
          <h1 className={styles.pageTitle}>Reset password</h1>
          <p className={styles.pageSub}>Enter your email, receive a secure code, then choose a new password.</p>
          <form onSubmit={resetSent ? confirmReset : requestReset}>
            <label className={styles.label}>Email <span className={styles.labelNp}>इमेल</span></label>
            <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" className={styles.input} />
            {resetSent && <>
              <label className={styles.label}>Reset code</label>
              <input value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="6-digit code" className={styles.input} />
              <label className={styles.label}>New password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" className={styles.input} />
            </>}
            <button type="submit" disabled={resetBusy || !resetEmail || (resetSent && (resetCode.length < 6 || newPassword.length < 6))} className={styles.btn}>{resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}{resetSent ? 'Change password' : 'Send reset code'}</button>
          </form>
          <div className={styles.footNote}><button type="button" onClick={() => setMode('login')}>Back to login</button></div>
        </>
      )}
    </CivicAuthShell>
  );
}
