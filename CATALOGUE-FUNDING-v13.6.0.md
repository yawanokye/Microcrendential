# UCC Growth+ v13.6.0: catalogue, organisation training and fixed fees

This is a complete source upgrade from v13.5.0. It retains microcredentials, CPD, full certificate/diploma and degree delivery, semester results, transcripts, programme certificates, Python labs, native interactive activities, optional corporate assurance and the existing H5P/LTI configuration. The new controls are optional. Existing offerings remain public and existing fee agreements are retained until an administrator changes future terms.

## Public and private learning

The main page advertises four routes: microcredentials and short courses, continuing professional development, full certificates/diplomas, and degrees. Route cards remain visible even when no public offering is available in that route. Only active approved public offerings are listed. Programme-only modules are advertised through their parent qualification rather than separately on the public page. CPD follows the configured CPD award, rather than assuming that every professional course is CPD.

A partnership, joint award or sponsor logo is separate from access. A partnership course can be public or private. Private training is omitted from anonymous catalogue results and from signed-in users who lack an approved current group. Filtering happens before pagination. A saved URL or an employer name entered in a profile does not grant access.

An administrator creates an organisation, creates an access group and records approved employee account emails with a roster reference and optional UTC expiry. Emails can be provisioned before the employee registers; the employee must sign in with the matching verified account. The administrator can revoke or restore individual memberships. Optional authoring access lets an assigned facilitator select that group for the facilitator’s own courses/programmes; it does not grant marking access to other facilitators’ courses.

In **Organisations and fees**, select a saved offering and set its audience. Facilitators use **Catalogue audience**. Preview the change, including the number of existing learners who would lose current training access, then confirm and apply. Making previously private training public requires an administrator. Changes use version checks and are audited. A private parent curriculum cannot reference a component inaccessible to its intended groups. New course intakes inherit the source offering’s audience and fixed fees.

Leaving an organisation or reaching an access expiry blocks new enrolment, programme registration, lesson access and assessment submissions. Employees retain their own earned credentials, transcripts and personal academic records. Public verification of private training exposes credential status only. A private course certificate PDF requires the holder or authorised staff to sign in; other employees cannot download it merely by sharing a group.

## Who pays and who sets the amount

Only administrators set fixed tuition/enrolment and certificate fees. Each purpose has its own payer: **individual** or **organisation**. A course may have organisation-paid tuition and an individual-paid certificate, or the reverse. Zero means waived. These controls apply to public or private courses and full programmes.

Facilitators develop the learning and award requirements. Course draft edits, AI changes and curriculum revisions do not grant them authority to change fixed fees. Legacy course fees remain the default until explicitly changed by an administrator. Historic programme admissions without a billing snapshot retain their former zero programme-level fee; their existing course-level fees and recorded tuition clearance continue to apply.

New course enrolments and programme admissions retain a financial snapshot. Existing payment orders retain their agreed amount and fee schedule even if an administrator changes the price while checkout is pending. Later fee changes apply to future enrolments, not to already agreed participant charges. Academic marks, GPA and transcript eligibility remain separate from financial clearance.

Full programme tuition can optionally include constituent course enrolment fees. Course certificate fees are separate. Historic manual programme tuition clearance remains supported for unmanaged legacy course fees; it cannot bypass a newly managed fixed fee. Programme-only course checkout checks admitted curriculum access, term release, prerequisites and prior-credit restrictions before opening payment.

## Organisation funding workflow

1. Approve the organisation’s roster and the offering’s audience.
2. Set the fee and intended payer. Organisation invoices can also sponsor named employees on an otherwise individual-paid public course.
3. Issue an invoice naming 1–500 approved active members. Select **fee per learner** or **one fixed group total**, enter the agreed amount and retain the contract reference. The issued amount, basis, participant list and fee terms are fixed.
4. Record the verified bank receipt, amount, received date and unique payment reference.
5. Allocate that receipt to the organisation’s invoice. A receipt can cover multiple invoices. Allocations cannot exceed the remaining receipt balance or invoice balance, and cannot cross organisations.
6. Full funding releases the listed places. Partial funding releases none. Unlisted employees and ineligible accounts gain no access. A zero-total invoice is labelled waived, not paid. An issued waiver is already a funding commitment and cannot be cancelled through the unallocated-invoice shortcut.

This release records administrator-confirmed organisation receipts. It does not connect directly to a bank, send invoices automatically, implement an accounting ledger or create an employer administration role. Receipt evidence must be verified through the institution’s finance process before it is recorded. Allocated invoices cannot be edited or cancelled through this screen; refunds and accounting corrections require the established reconciliation process.

Once an organisation-funded learner meets the academic requirements and certificate funding is confirmed, the background worker retries authorised course certificate creation in bounded batches. Programme certificates continue to use the existing automatic or registry-release policy and wait for configured programme fees. Already issued awards are not revoked because a later fee schedule changes.

## Individual payment

Individual course payments use the existing Paystack checkout. Admitted programme tuition and programme certificate fees now have their own checkout context and receipts. Programme-only course fees can be paid from the admitted curriculum before registration. Amounts and payer requirements come from server-held terms; client-supplied payment amounts or claims of organisation payment have no effect. Course and programme orders cannot clear one another merely because their codes match.

Online individual payment still requires `PAYMENTS_ENABLED=true`, the institution’s Paystack secret and an approved public URL. Organisation bank-receipt recording does not require online checkout to be enabled. No live payment was collected during development; acceptance testing uses an isolated local mock provider.

## Upgrade and deployment

Back up the persistent SQLite database and uploads using the existing backup workflow. Upload the complete release at the repository root, preserving the `src/` hierarchy. Replace the application source as a complete release; do not combine it with obsolete root `app/`, `components/` or `lib/` copies from an older bundle. Do not delete the persistent data directory or its uploads. Keep the repository’s existing environment secrets and disk configuration.

Use Node 22 and run `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run check:source`, then `npm run build`. The startup migration adds organisation, audience and finance records and nullable snapshots without replacing existing academic records. The source-layout guard includes every new module and rejects incomplete uploads before the production build.

After deployment, confirm all four routes on the public homepage; create a small test organisation and roster; confirm a private offering is hidden from an outsider; test a fee policy and an authorised test receipt; and verify existing transcripts and certificates. Configure and verify real AI, H5P/LTI and payment providers separately using their existing setup guides. This package does not itself push GitHub changes or deploy Render.

Older releases do not enforce organisation audience policies. If a rollback is needed, keep external access closed while restoring a compatible release and data backup; do not serve private offerings using an older application.
