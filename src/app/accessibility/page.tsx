import { PolicyPage } from "@/components/policy-page";

export default function AccessibilityPage() {
  return <PolicyPage eyebrow="INCLUSIVE LEARNING" title="Accessibility statement" summary="UCC Growth+ aims to make professional and lifelong learning usable across devices, assistive technologies and different learning needs.">
    <section><h2>Current standard</h2><p>The platform supports keyboard navigation, visible focus, responsive layouts, text alternatives, labelled forms and transcript fields for video. Facilitators must complete an accessibility review before academic publication.</p></section>
    <section><h2>Learning materials</h2><p>Course teams should provide readable documents, meaningful image descriptions, captions or transcripts, clear instructions and reasonable alternatives for activities that depend on a specific sense or device.</p></section>
    <section><h2>Requesting support</h2><p>Learners may record accessibility needs in their private profile or submit a support request. The team will review reasonable adjustments without displaying private support information on certificates or public credential pages.</p></section>
    <section><h2>Known limitations</h2><p>Some third-party videos, documents, virtual laboratories or linked websites may not meet the same standard. Report the course, activity and barrier so an accessible alternative can be arranged.</p></section>
  </PolicyPage>;
}
