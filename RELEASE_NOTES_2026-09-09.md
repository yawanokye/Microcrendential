# UCC Microcredential Platform — enrolment and certificate release

## Included

- Signed-in learners can browse administrator-published courses, open full course details and enrol from the learner portal.
- Course details show purpose, facilitator, workload, delivery, audience, prerequisites, objectives, measurable outcomes, syllabus and separate fee disclosures.
- All new courses default to free enrolment and a free UCC certificate.
- Facilitators must explicitly enable an enrolment fee or certificate fee in Course Studio.
- Paid enrolment uses Paystack initialization, callback verification and signed webhooks.
- Academic completion is stored independently from certificate payment.
- A certificate fee, when enabled, is requested only after verified identity and all academic requirements are complete.
- Free certificates are generated without a payment step.
- Payment records include purpose, reference, amount, currency, status and a limited verification receipt.
- The facilitator can upload a readable learning manual and generate a fully editable course draft containing objectives, outcomes, skills, sections, learning blocks and starter assessment items.
- Manual-derived courses remain drafts and must pass the existing facilitator checks and UCC academic approval workflow.

## Production configuration

Set `NEXT_PUBLIC_APP_URL` to the public HTTPS origin. Set `PAYSTACK_SECRET_KEY` only if at least one published course charges an enrolment or certificate fee. Configure Paystack to send webhooks to:

`https://ucc-microcredential-platform.onrender.com/api/payments/webhook`

Do not expose the Paystack secret in client-side code or commit a real key to GitHub.

## Verification completed

- Next.js 16.2.6 production build passed.
- TypeScript checks passed.
- ESLint reported no errors (existing advisory warnings remain).
- Fresh SQLite initialization created the fee and payment tables/columns.
- A local payment-settlement fixture validated reference, email, currency and amount, then created the paid enrolment.
