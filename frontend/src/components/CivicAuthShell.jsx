'use client';
import Link from 'next/link';
import styles from '@/styles/civicAuth.module.css';
import { CivicLogo } from '@/components/CivicBrand';
import ThemeToggle from '@/components/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';
import { Languages } from 'lucide-react';

export default function CivicAuthShell({ activeTab, children }) {
  const { locale, toggleLocale } = useLanguage();
  return (
    <div className={styles.shell}>
      <div className={`${styles.authShell} ${activeTab === 'login' ? styles.loginShell : ''}`}>
        <section className={styles.sidePanel}>
          <video
            src="/nepal-flag-temple.mp4"
            poster="/civic-temple.png"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className={styles.sideVideo}
          />
          <div className={styles.imageWash} />
          <div className={styles.sidePanelContent}>
            <div className={styles.brandRow}><CivicLogo /></div>
            <div className={styles.sidePanelBottom}>
              <p className={styles.taglineNp}>जनताको आवाज, सरकारको जवाफ</p>
              <h1 className={styles.brandWordmarkLg}>Civic<span>दृष्टि</span></h1>
              <p className={styles.quoteNp}>तपाईंको सरकार, तपाईंको दृष्टिमा</p>
              <p className={styles.quoteEn}>Namaste - welcome to your government, in view.</p>
              <div className={styles.statStrip}>
                <div><strong>753</strong>Local units</div>
                <div><strong>रू 1.86T</strong>Tracked budget</div>
                <div><strong>701</strong>Wards reporting</div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.mobileHero} aria-hidden="true">
          <img src="/civic-temple.png" alt="" className={styles.mobileHeroImage} />
          <div className={styles.mobileHeroWash} />
          <div className={styles.mobileHeroContent}>
            <CivicLogo />
            <p>सुनिने आवाज, दर्ज इतिहास</p>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.formPanelInner}>
            <div className={styles.mobileLogo}><CivicLogo /></div>
            <div className={styles.authTopRow}>
              <p className={styles.eyebrow} style={{ margin: 0 }}>Secure Civic Access</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={toggleLocale}
                  aria-label="Toggle language"
                  data-no-auto-translate
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--gov-border)', background: 'transparent', fontSize: 13, fontWeight: 500, color: 'var(--gov-muted)', cursor: 'pointer' }}
                >
                  <Languages size={15} />
                  <span>{locale === 'en' ? 'नेपाली' : 'English'}</span>
                </button>
                <ThemeToggle />
              </div>
            </div>
            <div className={styles.tierTabs}>
              <Link href="/login" className={`${styles.tierTab} ${activeTab === 'login' ? styles.tierTabActive : ''}`}>Log in</Link>
              <Link href="/signup" className={`${styles.tierTab} ${activeTab === 'signup' ? styles.tierTabActive : ''}`}>Sign up</Link>
            </div>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}