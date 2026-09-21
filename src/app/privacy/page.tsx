import { PolicyPage } from "@/components/policy-page";

export default function PrivacyPage() {
  return <PolicyPage eyebrow="DATA PROTECTION" title="Privacy and identity-data notice" summary="This notice explains how UCC Growth+ handles account, learning, assessment, payment and identity-verification information during the official pilot.">
    <section><h2>Information collected</h2><p>The platform records account details, learner profile information, course enrolment, learning progress, assessment evidence, credential decisions and support requests. When identity verification is required, it also receives an identity document and a current facial image.</p></section>
    <section><h2>Why it is used</h2><p>Information is used to provide learning services, confirm identity, protect academic integrity, process approved payments, issue verifiable credentials, support users, investigate incidents and produce authorised institutional reports.</p></section>
    <section><h2>Access and sharing</h2><p>Access is limited by role. Identity evidence is available only to assigned reviewers and system administrators. Public credential verification shows award information and current status, but does not show identity documents, birth dates, addresses or private learning records.</p></section>
    <section><h2>Retention and deletion</h2><p>Identity images are removed after the approved retention period configured for the service. The verification decision and limited reference details may remain in the academic audit record. Learning and credential records are retained according to UCC academic, legal and records-management requirements.</p></section>
    <section><h2>Your choices</h2><p>You may request access, correction or deletion where applicable. Some information must remain when needed to protect an issued credential, meet academic record duties or resolve a dispute. Requests are verified before action is taken.</p></section>
    <section><h2>Service providers and security</h2><p>Approved hosting, email, payment and learning-technology providers may process limited information to deliver the service. UCC applies access controls, encrypted transport, secure password hashing, staff security codes, audit records and restricted storage. No internet service can guarantee absolute security.</p></section>
  </PolicyPage>;
}
