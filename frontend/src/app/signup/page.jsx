'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import CivicAuthShell from '@/components/CivicAuthShell';
import styles from '@/styles/civicAuth.module.css';
import { Eye, EyeOff, Loader2, MapPinned, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const ROLE_CARDS = [
  { value: 'researcher', title: 'Citizen', copy: 'Report ward issues and follow budget work until it is closed.' },
  { value: 'ward_rep', title: 'Ward Representative', copy: 'Request approval to manage and view only your assigned ward.' },
];

export default function SignupPage() {
  const { signup } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({ defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'researcher', province: '', district: '', municipality: '', ward: '', applicationDetails: '' } });
  const role = watch('role');

  const onSubmit = async (values) => {
    setError('');
    const organization = [values.municipality, values.ward ? `Ward ${values.ward}` : '', values.district].filter(Boolean).join(', ') || 'Civicदृष्टि';
    try { await signup({ ...values, organization }); toast.success(values.role === 'ward_rep' ? 'Ward Representative request sent. Wait for admin approval before logging in.' : 'Account created. Welcome to Civicदृष्टि.'); }
    catch (err) { setError(err.message); }
  };

  return (
    <CivicAuthShell activeTab="signup">
      <h1 className={styles.pageTitle}>Create your account</h1>
      <p className={styles.pageSub}></p>
      {error && <div className={styles.errorBox}>{error}</div>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.rowTwo}>
          <div><label className={styles.label}>Full name <span className={styles.labelNp}>पुरा नाम</span></label><input className={`${styles.input} ${errors.name ? styles.inputError : ''}`} placeholder="" {...register('name', { required: 'Name is required' })} />{errors.name && <span className={styles.errMsg}>{errors.name.message}</span>}</div>
          <div><label className={styles.label}>Email <span className={styles.labelNp}>इमेल</span></label><input type="email" className={`${styles.input} ${errors.email ? styles.inputError : ''}`} placeholder="" {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} />{errors.email && <span className={styles.errMsg}>{errors.email.message}</span>}</div>
        </div>
        <div>
          <label className={styles.label}>Phone number <span className={styles.labelNp}>फोन नम्बर</span></label>
          <input
            type="tel"
            className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
            placeholder=""
            {...register('phone', {
              required: 'Phone number is required',
              pattern: { value: /^9\d{9}$/, message: 'Enter a valid 10-digit Nepal mobile number' }
            })}
          />
          {errors.phone && <span className={styles.errMsg}>{errors.phone.message}</span>}
        </div>
        <div>
          <label className={styles.label}>I am signing up as <span className={styles.labelNp}>म को रूपमा दर्ता गर्दैछु</span></label>
          <div className={styles.roleSelect}>{ROLE_CARDS.map(card => <button key={card.value} type="button" onClick={() => setValue('role', card.value)} className={`${styles.roleCard} ${role === card.value ? styles.roleCardActive : ''}`}><span className={styles.roleCardTitle}><UserRoundCheck className="h-4 w-4" style={{ color: 'var(--sindoor)' }} />{card.title}</span><span className={styles.roleCardCopy}>{card.copy}</span></button>)}</div>
          <input type="hidden" {...register('role')} />
        </div>
        <div className={styles.jurisdictionBox}><p className={styles.jurisdictionTitle}><MapPinned className="h-4 w-4" style={{ color: 'var(--sindoor)' }} />Jurisdiction {role === 'ward_rep' ? '(required for Ward Representative)' : ''}</p><div className={styles.rowFour}><input className={styles.input} placeholder="Province" {...register('province', { required: role === 'ward_rep' ? 'Province is required' : false })} /><input className={styles.input} placeholder="District" {...register('district', { required: role === 'ward_rep' ? 'District is required' : false })} /><input className={styles.input} placeholder="Municipality" {...register('municipality')} /><input className={styles.input} placeholder="Ward" {...register('ward', { required: role === 'ward_rep' ? 'Ward is required' : false })} /></div>{role === 'ward_rep' && <textarea className={styles.input} style={{ minHeight: 92, marginTop: 10, paddingTop: 10 }} placeholder="Why should the main admin approve you as this ward representative?" {...register('applicationDetails', { required: 'Application details are required for ward representatives' })} />}</div>
        <div className={styles.rowTwo}>
          <div><label className={styles.label}>Password <span className={styles.labelNp}>पासवर्ड</span></label><div className={styles.inputWrap}><input type={showPw ? 'text' : 'password'} className={`${styles.input} ${errors.password ? styles.inputError : ''}`} style={{ paddingRight: 40 }} placeholder="Min 6 characters" {...register('password', { required: 'Required', minLength: { value: 6, message: 'Min 6 characters' } })} /><button type="button" onClick={() => setShowPw(v => !v)} className={styles.inputIconBtn}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{errors.password && <span className={styles.errMsg}>{errors.password.message}</span>}</div>
          <div><label className={styles.label}>Confirm password <span className={styles.labelNp}>पासवर्ड पुष्टि</span></label><input type="password" className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`} placeholder="Re-enter password" {...register('confirmPassword', { validate: v => v === watch('password') || "Passwords don't match" })} />{errors.confirmPassword && <span className={styles.errMsg}>{errors.confirmPassword.message}</span>}</div>
        </div>
        <p className={styles.pageSub} style={{ marginTop: 4 }}>You can verify your identity with your citizenship certificate and a live photo later, from Settings, once you need to report an issue.</p>
        <button type="submit" disabled={isSubmitting} className={styles.btn}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Create account</button>
      </form>
      <div className={styles.footNote}>Already have an account? <Link href="/login">Log in</Link></div>
    </CivicAuthShell>
  );
}