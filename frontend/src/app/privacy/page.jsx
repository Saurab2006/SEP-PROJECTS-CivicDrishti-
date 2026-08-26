import LegalPageShell, { LegalSection } from '@/components/LegalPageShell';

export const metadata = { title: 'Privacy Policy - Civicदृष्टि' };

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="August 2026">
      <p>
        This Privacy Policy explains what information Civicदृष्टि collects, how it is used, and
        the choices you have as a citizen, ward representative, municipality head, or
        administrator using the platform.
      </p>

      <LegalSection title="1. Information we collect">
        <p>
          When you create an account, we collect your name, email address, phone number, and
          jurisdiction (province, district, municipality, ward). When you submit a civic issue,
          we collect the details, photos, and location you provide. We also keep a record of
          budget proposals and approvals for audit purposes.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use your information">
        <p>
          Your information is used to route civic reports to the correct ward and authority,
          display public budget and issue data, notify you about updates to reports you filed
          or follow, and maintain an audit trail for budget change approvals.
        </p>
      </LegalSection>

      <LegalSection title="3. What is public">
        <p>
          Civic issue reports, budget records, and project status are shown publicly as part of
          the platform's transparency mission. Your account email and phone number are not shown
          publicly; your name may appear alongside a report you submit.
        </p>
      </LegalSection>

      <LegalSection title="4. Data sharing">
        <p>
          We do not sell personal data. Information may be shared with the relevant municipal or
          ward authority responsible for acting on a report, and with administrators for
          moderation and audit purposes.
        </p>
      </LegalSection>

      <LegalSection title="5. Data retention">
        <p>
          Account and report data is retained for as long as your account is active and for a
          reasonable period afterward to preserve the public record and audit trail.
        </p>
      </LegalSection>

      <LegalSection title="6. Your choices">
        <p>
          You can update your profile information from Settings at any time. To request account
          deletion, contact support using the details below.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Privacy questions or requests can be sent to{' '}
          <a href="mailto:support@civicdrishti.gov.np" className="font-semibold text-[#cf1f3b] hover:underline">
            support@civicdrishti.gov.np
          </a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}