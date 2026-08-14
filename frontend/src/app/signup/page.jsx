'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import CivicAuthShell from '@/components/CivicAuthShell';
import styles from '@/styles/civicAuth.module.css';
import { Eye, EyeOff, FileCheck2, Loader2, MapPinned, ShieldCheck, UploadCloud, UserRoundCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import SelfieCapture from '@/components/SelfieCapture';
import { loadFaceModels, getFaceDescriptor, compareDescriptors, loadImageFromDataUrl } from '@/lib/faceMatch';
import { Camera, CheckCircle2 } from 'lucide-react';

const ROLE_CARDS = [
  { value: 'researcher', title: 'Citizen', copy: 'Report ward issues and follow budget work until it is closed.' },
  { value: 'ward_rep', title: 'Ward Representative', copy: 'Request approval to manage and view only your assigned ward.' },
];
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the file')); reader.readAsDataURL(file); }); }

export default function SignupPage() {
  const { signup } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docError, setDocError] = useState('');
  const [selfieDataUrl, setSelfieDataUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [faceChecking, setFaceChecking] = useState(false);
  const [faceError, setFaceError] = useState('');
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({ defaultValues: { name: '', email: '', password: '', confirmPassword: '', role: 'researcher', province: '', district: '', municipality: '', ward: '', applicationDetails: '' } });
  const role = watch('role');

  const handleDocChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/|^application\/pdf$/.test(file.type)) { setDocError('Upload an image or PDF'); return; }
    if (file.size > 8 * 1024 * 1024) { setDocError('File is too large. Max 8MB'); return; }
    setDocError('');
    try { setDocFile({ name: file.name, dataUrl: await fileToDataUrl(file) }); }
    catch { setDocError('Could not read that file. Try again.'); }
  };

  const onSubmit = async (values) => {
    setError('');
    setFaceError('');
    if (['researcher', 'ward_rep'].includes(values.role) && !docFile) { setDocError('Citizenship certificate or national ID is required for citizen reporting.'); return; }
    if (['researcher', 'ward_rep'].includes(values.role) && !selfieDataUrl) { setFaceError('Please take a live selfie to verify your identity.'); return; }

    // If a selfie was captured, run the face match before creating the account.
    if (selfieDataUrl && docFile?.dataUrl) {
      setFaceChecking(true);
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
      } catch (err) {
        setFaceError('Could not verify your face. Please try again.');
        setFaceChecking(false);
        return;
      }
      setFaceChecking(false);
    }

    const organization = [values.municipality, values.ward ? `Ward ${values.ward}` : '', values.district].filter(Boolean).join(', ') || 'Civicदृष्टि';
    try { await signup({ ...values, organization, citizenshipDoc: docFile?.dataUrl || '', citizenshipDocName: docFile?.name || '', selfiePhoto: selfieDataUrl || '' }); toast.success(values.role === 'ward_rep' ? 'Ward Representative request sent. Wait for admin approval before logging in.' : 'Account created. Welcome to Civicदृष्टि.'); }
    catch (err) { setError(err.message); }
  };

  return (
    <CivicAuthShell activeTab="signup">
      <h1 className={styles.pageTitle}>Create your account</h1>
      <p className={styles.pageSub}>Join as a citizen or ward representative to report issues and follow public budgets.</p>
      {error && <div className={styles.errorBox}>{error}</div>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.rowTwo}>
          <div><label className={styles.label}>Full name <span className={styles.labelNp}>पुरा नाम</span></label><input className={`${styles.input} ${errors.name ? styles.inputError : ''}`} placeholder="" {...register('name', { required: 'Name is required' })} />{errors.name && <span className={styles.errMsg}>{errors.name.message}</span>}</div>
          <div><label className={styles.label}>Email <span className={styles.labelNp}>इमेल</span></label><input type="email" className={`${styles.input} ${errors.email ? styles.inputError : ''}`} placeholder="" {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} />{errors.email && <span className={styles.errMsg}>{errors.email.message}</span>}</div>
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
        <div><label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '14px 0 6px' }}><ShieldCheck className="h-4 w-4" style={{ color: 'var(--sindoor)' }} />Citizenship certificate / national ID</label>{!docFile ? <label className={styles.uploadBox}><UploadCloud className="h-5 w-5" style={{ color: 'var(--ink-soft)' }} /><span className={styles.uploadBoxText}>Upload image or PDF, max 8MB</span><input type="file" accept="image/*,application/pdf" onChange={handleDocChange} style={{ display: 'none' }} /></label> : <div className={styles.uploadedRow}><span className={styles.uploadedName}><FileCheck2 className="h-4 w-4" style={{ flexShrink: 0 }} /><span>{docFile.name}</span></span><button type="button" onClick={() => setDocFile(null)} className={styles.uploadedRemoveBtn}><X className="h-4 w-4" /></button></div>}{docError && <span className={styles.errMsg}>{docError}</span>}</div>
        <div style={{ margin: '14px 0 6px' }}>
          <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 6px' }}><Camera className="h-4 w-4" style={{ color: 'var(--sindoor)' }} />Live selfie verification</label>
          {!selfieDataUrl ? (
            <button type="button" onClick={() => setShowCamera(true)} className={styles.uploadBox} style={{ width: '100%' }}>
              <Camera className="h-5 w-5" style={{ color: 'var(--ink-soft)' }} />
              <span className={styles.uploadBoxText}>Click to take a live photo</span>
            </button>
          ) : (
            <div className={styles.uploadedRow}>
              <span className={styles.uploadedName}><CheckCircle2 className="h-4 w-4" style={{ flexShrink: 0, color: '#0f3d3e' }} /><span>Selfie captured</span></span>
              <button type="button" onClick={() => setSelfieDataUrl(null)} className={styles.uploadedRemoveBtn}><X className="h-4 w-4" /></button>
            </div>
          )}
          {faceError && <span className={styles.errMsg}>{faceError}</span>}
          {faceChecking && <span className={styles.errMsg} style={{ color: 'var(--ink-soft)' }}>Verifying your face, please wait…</span>}
        </div>

        {showCamera && (
          <SelfieCapture
            onCapture={(dataUrl) => { setSelfieDataUrl(dataUrl); setShowCamera(false); }}
            onClose={() => setShowCamera(false)}
          />
        )}
        <button type="submit" disabled={isSubmitting} className={styles.btn}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Create account</button>
      </form>
      <div className={styles.footNote}>Already have an account? <Link href="/login">Log in</Link></div>
    </CivicAuthShell>
  );
}

