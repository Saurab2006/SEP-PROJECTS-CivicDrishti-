import LegalPageShell, { LegalSection } from '@/components/LegalPageShell';

export const metadata = { title: 'Reporting Guidelines - Civicदृष्टि' };

export default function ReportingGuidelinesPage() {
  return (
    <LegalPageShell title="Reporting Guidelines" updated="August 2026">
      <p>
        A good civic report gets resolved faster. These guidelines help you file a report that
        is clear, actionable, and easy for an authority to act on.
      </p>

      <LegalSection title="1. Choose the right location">
        <p>
          Set the province, district, municipality, and ward as precisely as possible. Reports
          routed to the wrong ward take longer to reach the right authority.
        </p>
      </LegalSection>

      <LegalSection title="2. Add a photo when you can">
        <p>
          A clear photo of the problem — a pothole, broken streetlight, uncollected waste, and so
          on — helps officials assess severity without a site visit.
        </p>
      </LegalSection>

      <LegalSection title="3. Describe the problem plainly">
        <p>
          State what is wrong, where exactly it is (a landmark or street name helps), and how
          long it has been a problem. Avoid vague titles like "bad road" — describe the specific
          issue instead.
        </p>
      </LegalSection>

      <LegalSection title="4. Check for an existing report first">
        <p>
          If someone has already reported the same issue nearby, add your support to that report
          instead of creating a duplicate. More support on one report raises its priority.
        </p>
      </LegalSection>

      <LegalSection title="5. Follow up respectfully">
        <p>
          You can track your report's status from Planned through Ongoing to Completed. If a
          report has stalled, you can raise it again through the platform rather than filing
          repeat reports.
        </p>
      </LegalSection>

      <LegalSection title="6. Emergencies">
        <p>
          Civicदृष्टि is for tracking public service and infrastructure issues, not for reporting
          emergencies in progress. For an emergency, contact local emergency services directly.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}