import { PolicyPage } from "@/components/policy-page";

export default function RefundPolicyPage() {
  return <PolicyPage eyebrow="FEES AND CANCELLATION" title="Pilot payment and refund policy" summary="Online payment is disabled for the official pilot until UCC approves the live Paystack account, reconciliation process and course-specific refund terms.">
    <section><h2>Official pilot</h2><p>Pilot courses must be configured as free or invitation-based unless UCC Finance has separately approved collection. The platform will not start an online payment while the payment control is disabled.</p></section>
    <section><h2>Before paid enrolment opens</h2><p>Each paid course must show the fee, what it covers, start date, cancellation deadline and refund conditions before payment. Learners must receive a payment reference and receipt.</p></section>
    <section><h2>Payment disputes</h2><p>Do not make a second payment when a transaction is pending. Submit the transaction reference through Support so Finance can reconcile it. Refund approval and timing follow the published course terms and UCC financial procedures.</p></section>
  </PolicyPage>;
}
