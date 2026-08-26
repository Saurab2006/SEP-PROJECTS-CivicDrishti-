import LegalPageShell, { LegalSection } from '@/components/LegalPageShell';

export const metadata = { title: 'Terms of Use - Civicदृष्टि' };

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Use" updated="August 2026">
      <p>
        These Terms of Use govern access to and use of Civicदृष्टि, a civic transparency and
        accountability platform connecting citizens, ward representatives, municipality heads,
        and administrators. By creating an account or using the platform, you agree to these
        terms.
      </p>

      <LegalSection title="1. Who can use Civicदृष्टि">
        <p>
          The platform is intended for citizens of Nepal and public officials involved in local
          governance. Ward Representative and Municipality Head accounts are provisioned by an
          administrator or an existing Municipality Head and are not available through open
          signup.
        </p>
      </LegalSection>

      <LegalSection title="2. Accurate reporting">
        <p>
          When you submit a civic issue, budget proposal, or feedback, you agree to provide
          accurate, good-faith information tied to your real location and identity. Deliberately
          false or misleading reports may result in account suspension.
        </p>
      </LegalSection>

      <LegalSection title="3. Budget data">
        <p>
          Budget figures displayed on the platform are drawn from records submitted by
          authorized officials and reviewed through an approval workflow. While we work to keep
          this data accurate and current, Civicदृष्टि does not guarantee that every figure
          reflects the most recent official ledger at every moment.
        </p>
      </LegalSection>

      <LegalSection title="4. Account responsibility">
        <p>
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activity that occurs under your account.
        </p>
      </LegalSection>

      <LegalSection title="5. Prohibited use">
        <p>
          You may not use the platform to harass other users, submit spam or duplicate reports
          in bad faith, misrepresent your role or jurisdiction, or attempt to interfere with the
          platform's normal operation.
        </p>
      </LegalSection>

      <LegalSection title="6. Changes to these terms">
        <p>
          We may update these terms from time to time. Continued use of the platform after a
          change is posted constitutes acceptance of the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms can be sent to{' '}
          <a href="mailto:support@civicdrishti.gov.np" className="font-semibold text-[#cf1f3b] hover:underline">
            support@civicdrishti.gov.np
          </a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}