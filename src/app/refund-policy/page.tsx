import { PolicyPage } from "@/components/policy-page";

export default function RefundPolicyPage() {
  return <PolicyPage eyebrow="FEES AND CANCELLATION" title="Payment and refund policy" summary="Published course terms show the course fee, certificate fee and refund request window before enrolment. UCC receives learner payments and decides refund requests.">
    <section><h2>Payment availability</h2><p>Online collection opens when UCC enables its verified payment account. Free courses remain available while payment collection is disabled. Anovlad platform usage charges are separate from learner course and certificate fees.</p></section>
    <section><h2>Before paid enrolment opens</h2><p>Each paid course must show the fee, what it covers, start date, cancellation deadline and refund conditions before payment. Learners must receive a payment reference and receipt.</p></section>
    <section><h2>Payment disputes</h2><p>Do not make a second payment when a transaction is pending. Submit the transaction reference through Support so Finance can reconcile it. Refund approval and timing follow the published course terms and UCC financial procedures.</p></section>
    <section><h2>Receipts and requests</h2><p>Your payment history records provider-verified payments and downloadable receipts. Submit a refund request using the paid reference and explain the reason. UCC records its decision; a refund is completed only after Finance records the payment-provider refund reference.</p></section>
  </PolicyPage>;
}
