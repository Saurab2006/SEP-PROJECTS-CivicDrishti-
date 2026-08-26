import LegalPageShell, { LegalSection } from '@/components/LegalPageShell';

export const metadata = { title: 'Community Guidelines - Civicदृष्टि' };

export default function CommunityGuidelinesPage() {
  return (
    <LegalPageShell title="Community Guidelines" updated="August 2026">
      <p>
        Civicदृष्टि works because citizens, ward representatives, and officials engage with it in
        good faith. These guidelines describe the behavior expected from everyone on the
        platform.
      </p>

      <LegalSection title="1. Be honest">
        <p>
          Report real problems with accurate details. Do not exaggerate severity, submit
          duplicate reports to inflate a count, or impersonate someone else's report.
        </p>
      </LegalSection>

      <LegalSection title="2. Be respectful">
        <p>
          Disagreements about budget priorities or project delays are welcome, but comments and
          feedback should stay focused on the issue, not personal attacks on other citizens or
          officials.
        </p>
      </LegalSection>

      <LegalSection title="3. Keep it relevant">
        <p>
          Reports should describe a specific, actionable civic issue tied to a location and
          ward. General complaints unrelated to public services or infrastructure may be removed.
        </p>
      </LegalSection>

      <LegalSection title="4. Respect privacy">
        <p>
          Do not include another private individual's personal information in a report or
          comment unless it is directly relevant to a public service issue.
        </p>
      </LegalSection>

      <LegalSection title="5. Consequences">
        <p>
          Reports or accounts that violate these guidelines may be flagged, hidden, or suspended
          by an administrator. Repeated violations can result in a permanent ban.
        </p>
      </LegalSection>

      <LegalSection title="Report a concern">
        <p>
          If you see content that violates these guidelines, use the reporting option on the
          issue itself, or contact{' '}
          <a href="mailto:support@civicdrishti.gov.np" className="font-semibold text-[#cf1f3b] hover:underline">
            support@civicdrishti.gov.np
          </a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}