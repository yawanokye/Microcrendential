import { PolicyPage } from "@/components/policy-page";

export default function TermsPage() {
  return <PolicyPage eyebrow="PLATFORM GOVERNANCE" title="Terms and acceptable use" summary="These pilot terms set the minimum rules for learners, facilitators, partners and administrators using UCC Growth+.">
    <section><h2>Eligibility and accounts</h2><p>UCC student status is not required for learner registration. Users must provide accurate information, protect their credentials and use only their own account. Facilitators require an administrator invitation and may represent UCC or an approved external institution.</p></section>
    <section><h2>Learning and assessment</h2><p>Course completion does not guarantee an award. A credential is issued only when the approved completion, identity and assessment requirements are met. Users must submit their own work and disclose permitted assistance when a course requires it.</p></section>
    <section><h2>Certificates</h2><p>Certificates remain subject to the live verification register. UCC may correct, expire, suspend or revoke a credential when it was issued in error, obtained through misconduct or affected by a later governance decision. The verification record is authoritative.</p></section>
    <section><h2>Content and conduct</h2><p>Users must not upload malware, infringe copyright, impersonate another person, interfere with the service, scrape restricted data or attempt to bypass role controls. Facilitators are responsible for permissions, accessibility and academic accuracy of course materials.</p></section>
    <section><h2>Pilot availability</h2><p>The pilot may have capacity limits and planned maintenance. Features may be corrected or refined during the pilot. Material changes affecting user rights will be communicated through the platform or registered email.</p></section>
  </PolicyPage>;
}
