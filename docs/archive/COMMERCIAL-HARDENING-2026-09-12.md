# Commercial hardening handover

This release implements the highest-impact code changes identified in the facilitator Course Studio, learner portal, academic approval, assessment and credential workflows.

## Implemented in this package

- Separate full-page Facilitator Course Studio with six explicit stages, stage completion indicators, side checks, learner preview, save-progress controls and a complete illustrative course.
- Course-manual import that retains the original upload, converts supported documents to rich readable HTML, uses detected headings to form lesson sections, preserves the protected original, and creates editable objectives, outcomes, skills, sections and starter human-marked assessment items.
- Catalogue-only course payloads for learners who are not enrolled. Full learning HTML, protected file references, activity instructions and assessment questions are released only after enrolment.
- All course and programme records are self-enrolment by policy. New and imported courses default to free enrolment and free certificates; facilitators may explicitly configure enrolment or certificate fees.
- Persistent per-lesson progress, a **Complete and continue** learner flow, a visible course progress indicator and an assessment prerequisite for required lessons.
- Assessment answer-key and rubric removal from learner responses; attempt limits; correct automatic grading; human-marking detection; marking queue; constructive feedback; final-score and resubmission decisions.
- Immutable active courses with facilitator-created controlled revisions. The existing version remains live until an administrator approves and atomically applies a quality-ready revision.
- Strict academic publication: no administrative override of failed quality checks.
- Facilitator and Provost digital-signature register with role restrictions, private storage, audit events and issuance-time signature snapshots on certificates.
- Audit records for course creation, revision, assessment, enrolment, certificate governance and signature updates.
- Cross-site mutation checks on core authoring, upload, enrolment, assessment, certificate and payment endpoints.
- Login throttling, generic credential errors, removal of the hard-coded administrator fallback, security response headers and a Render health-check path.
- Seven automated policy/security tests, a successful production Next.js build and lint with no errors.

## Required before a high-volume public launch

These items require infrastructure, external services, legal policy or institutional decisions and are not safely invented inside an application ZIP:

1. Migrate SQLite to managed PostgreSQL and protected files to private S3-compatible object storage before horizontal scaling.
2. Connect institutional SSO or verified email plus password-reset, MFA for staff, session revocation and account-recovery workflows.
3. Enable edge rate limiting/WAF, central logs, error tracking, uptime monitoring and alert ownership.
4. Add malware scanning and quarantine for all uploads; adopt identity-document retention/deletion rules and access reviews.
5. Complete a WCAG 2.2 AA accessibility audit with keyboard, screen-reader, reflow and colour-contrast testing.
6. Complete penetration testing, dependency review, privacy impact assessment, terms, data-processing agreements and incident response.
7. Productionise payments with webhook replay protection, reconciliation, refund handling, receipts, taxes and finance reporting.
8. Automate encrypted backups and complete a documented restore drill.
9. Decide interoperability scope: Open Badges 3.0/CLR, LTI 1.3, xAPI and/or SCORM import/export.
10. Run load tests against realistic enrolment, course launch, document delivery, assessment submission and certificate-generation traffic.

## Deployment checks

1. Set `AUTH_SECRET` (32+ random characters), `INITIAL_ADMIN_EMAIL`, `DATA_DIR`, `SQLITE_PATH`, `NEXT_PUBLIC_APP_URL` and `PAYSTACK_SECRET_KEY` when paid offerings exist.
2. Attach the persistent Render disk at `/var/data`.
3. Run `npm test`, `npm run lint` and `npm run build`.
4. Deploy, complete first-administrator setup, upload the Provost signature and have each facilitator upload or approve their signature.
5. Verify `/api/health` returns HTTP 200 and `status: ready`.
6. Test one free enrolment, one paid enrolment (if enabled), lesson completion, automatic marking, human marking, controlled revision approval, certificate issuance and public QR verification.
